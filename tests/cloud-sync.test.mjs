import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('../public/cloud-sync.js', import.meta.url), 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const namespace = id => 'atlas-cloud:v1:' + encodeURIComponent(id === null ? 'guest' : 'user:' + id);
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

class MemoryStorage {
  data = new Map();
  failWrites = false;
  failReads = false;
  get length() { return this.data.size; }
  key(index) { return [...this.data.keys()][index] ?? null; }
  getItem(key) { if (this.failReads) throw new Error('Storage read failed'); return this.data.get(key) ?? null; }
  setItem(key, value) {
    if (this.failWrites) throw new Error('QuotaExceededError');
    this.data.set(String(key), String(value));
  }
  removeItem(key) { this.data.delete(key); }
}

function mockServer() {
  const users = new Map();
  const s = {
    account: 'A', storageAvailable: true, online: true, calls: [], hook: null,
    rows(id = s.account) {
      if (!users.has(id)) users.set(id, new Map());
      return users.get(id);
    },
    remote(key, value, { account = s.account, deleted = false } = {}) {
      const previous = s.rows(account).get(key);
      const row = { key, value: deleted ? null : plain(value), version: (previous?.version ?? 0) + 1, updatedAt: '2026-10-24T10:00:00.000Z', deleted };
      s.rows(account).set(key, row);
      return plain(row);
    },
    mutations() { return s.calls.filter(c => c.method === 'PUT' || c.method === 'DELETE'); },
    async fetch(path, options = {}) {
      const call = {
        path, method: options.method ?? 'GET', headers: options.headers,
        body: options.body === undefined ? undefined : JSON.parse(options.body),
        credentials: options.credentials,
      };
      s.calls.push(call);
      if (!s.online) throw new Error('Network unavailable');
      const override = s.hook ? await s.hook(call) : undefined;
      if (override) return override;
      if (path === '/api/me') return json(s.account === null ? { authenticated: false, storageAvailable: true } : { authenticated: true, user: { id: s.account, displayName: '사용자 ' + s.account }, admin: false, storageAvailable: s.storageAvailable });
      if (s.account === null) return json({ error: 'UNAUTHENTICATED' }, 401);
      if (call.headers['X-Atlas-User-Id'] !== s.account) return json({ error: 'ACCOUNT_CHANGED' }, 403);
      if (path === '/api/state' && call.method === 'GET') return json({ items: [...s.rows().values()].map(plain) });
      if (path.startsWith('/api/state/')) {
        const key = decodeURIComponent(path.slice('/api/state/'.length));
        const previous = s.rows().get(key);
        const version = previous?.version ?? 0;
        if (version !== call.body.expectedVersion) return json({ error: 'VERSION_CONFLICT', current: previous ?? { key, value: null, version: 0, deleted: true, updatedAt: null } }, 409);
        if (call.method !== 'PUT' && call.method !== 'DELETE') return json({ error: 'METHOD' }, 405);
        const row = s.remote(key, call.body.value, { deleted: call.method === 'DELETE' });
        return json(row);
      }
      return json({ error: 'NOT_FOUND' }, 404);
    },
  };
  return s;
}

function browser(server = mockServer(), storage = new MemoryStorage()) {
  let nextTimer = 1;
  const timers = new Map(), listeners = new Map(), events = [];
  const context = {
    localStorage: storage, navigator: { onLine: true }, AbortController,
    fetch: server.fetch,
    CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init.detail; } },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    dispatchEvent(event) {
      events.push(event);
      for (const listener of listeners.get(event.type) ?? []) listener(event);
      return true;
    },
    setTimeout(callback, delay) { const id = nextTimer++; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  };
  context.window = context;
  vm.runInNewContext(source, context, { filename: 'cloud-sync.js' });
  return {
    api: context.AtlasCloud, server, storage, timers, events, context,
    dispatch(type) { context.dispatchEvent({ type }); },
    runNextTimer() {
      const chosen = [...timers.entries()].sort((a, b) => a[1].delay - b[1].delay)[0];
      if (!chosen) return false;
      timers.delete(chosen[0]); chosen[1].callback(); return true;
    },
  };
}

test('bootstrap uses only current account; legacy keys are not imported automatically', async () => {
  const b = browser();
  b.server.remote('atlas2-saved', [{ id: 'remote-A' }]);
  b.storage.setItem('atlas2-saved', JSON.stringify([{ id: 'legacy' }]));
  b.storage.setItem('atlas2-profile', JSON.stringify({ budget: 100 }));
  await b.api.init();
  assert.deepEqual(plain(b.api.get('atlas2-saved', [])), [{ id: 'remote-A' }]);
  assert.equal(b.api.get('atlas2-profile', null), null);
  assert.equal(b.api.user.id, 'A');
  assert.equal(b.api.status().mode, 'cloud');
  assert.equal(b.api.status().pending, 0);
  assert.ok(b.api.status().lastSynced);
  assert.equal(b.server.mutations().length, 0);
  assert.equal(JSON.parse(b.storage.getItem('atlas2-saved'))[0].id, 'legacy');
  assert.ok(b.storage.getItem(namespace('A')));
  assert.equal(b.events.some(e => e.detail?.accountChanged), false, 'First account selection must not trigger an app reload');
  assert.ok(b.server.calls.every(c => c.credentials === 'same-origin'));
});

test('set is synchronous, clones data, and CAS synchronizes the durable outbox', async () => {
  const b = browser(); await b.api.init();
  const input = { budget: 35000000, country: 'KR' };
  assert.equal(b.api.set('profile', input), true);
  input.budget = 1;
  assert.equal(b.api.get('atlas2-profile').budget, 35000000);
  const read = b.api.get('profile'); read.budget = 2;
  assert.equal(b.api.get('profile').budget, 35000000);
  assert.equal(b.api.status().pending, 1);
  assert.equal(JSON.parse(b.storage.getItem(namespace('A'))).entries['atlas2-profile'].dirty, true);
  await b.api.sync();
  assert.equal(b.server.rows('A').get('atlas2-profile').value.budget, 35000000);
  assert.equal(b.server.mutations()[0].body.expectedVersion, 0);
  assert.equal(b.server.mutations()[0].headers['X-Atlas-User-Id'], 'A');
  assert.equal(b.api.status().pending, 0);
});

test('failed local write returns false and never invents a saved value or server mutation', async () => {
  const b = browser(); await b.api.init();
  assert.equal(b.api.set('profile', { budget: 100 }), true); await b.api.sync();
  const before = b.server.mutations().length;
  b.storage.failWrites = true;
  assert.equal(b.api.set('profile', { budget: 999 }), false);
  assert.equal(b.api.get('profile').budget, 100);
  assert.equal(b.api.status().pending, 0);
  assert.equal(b.api.status().mode, 'offline');
  assert.match(b.api.status().message, /실패/);
  await b.api.sync();
  assert.equal(b.server.mutations().length, before);
  b.storage.failWrites = false;
  assert.equal(b.api.set('profile', { budget: 200 }), true);
  await b.api.sync();
  assert.equal(b.server.rows('A').get('atlas2-profile').value.budget, 200);
});

test('invalid JSON values are rejected without queuing corrupt financial data', async () => {
  const b = browser(); await b.api.init();
  for (const value of [undefined, NaN, Infinity, { budget: Infinity }, { unknown: undefined }, 1n, () => 1]) assert.equal(b.api.set('finance', value), false);
  const cyclic = {}; cyclic.self = cyclic;
  assert.equal(b.api.set('finance', cyclic), false);
  assert.equal(b.api.set('', 1), false);
  assert.equal(b.api.set('outside/server/key', 1), false);
  assert.equal(b.api.set('x'.repeat(111), 1), false);
  assert.equal(b.api.status().pending, 0);
  assert.equal(b.server.mutations().length, 0);
});

test('offline queue persists through reload and resumes only after identity confirmation', async () => {
  const b = browser(); await b.api.init();
  b.context.navigator.onLine = false; b.dispatch('offline');
  assert.equal(b.api.set('saved', [{ id: 'offline' }]), true);
  await b.api.sync();
  assert.equal(b.api.status().mode, 'offline');
  assert.equal(b.api.status().pending, 1);
  assert.equal(b.server.mutations().length, 0);
  const fresh = browser(b.server, b.storage);
  fresh.context.navigator.onLine = false;
  await fresh.api.init();
  assert.equal(fresh.api.user, null, 'An offline start must not guess the previous user');
  assert.deepEqual(plain(fresh.api.get('saved', [])), []);
  fresh.context.navigator.onLine = true; fresh.dispatch('online');
  assert.ok([...fresh.timers.values()].some(t => t.delay === 0));
  await fresh.api.sync();
  assert.equal(fresh.api.user.id, 'A');
  assert.equal(fresh.server.rows('A').get('atlas2-saved').value[0].id, 'offline');
  assert.equal(fresh.api.status().pending, 0);
});

test('network failure retains pending data and schedules exponential rather than immediate retries', async () => {
  const b = browser(); await b.api.init();
  b.api.set('finance', { rent: 1500000 });
  b.server.online = false;
  await b.api.sync();
  assert.equal(b.api.status().mode, 'offline');
  assert.equal(b.api.status().pending, 1);
  assert.equal(b.api.exportPending().items[0].value.rent, 1500000);
  assert.ok([...b.timers.values()].some(t => t.delay === 1000));
  await b.api.sync();
  assert.ok([...b.timers.values()].some(t => t.delay === 2000));
  b.server.online = true; await b.api.sync();
  assert.equal(b.api.status().pending, 0);
  assert.equal(b.api.status().mode, 'cloud');
});

test('account changes keep each account queue isolated and emit an app memory reset signal', async () => {
  const b = browser(); await b.api.init();
  b.api.set('saved', [{ id: 'A-private' }]);
  b.server.account = 'B';
  b.server.remote('atlas2-saved', [{ id: 'B-private' }]);
  await b.api.sync();
  assert.equal(b.api.user.id, 'B');
  assert.equal(b.api.get('saved')[0].id, 'B-private');
  assert.equal(b.server.rows('B').get('atlas2-saved').value[0].id, 'B-private');
  assert.equal(b.server.mutations().length, 0, 'A outbox must not be sent to B');
  assert.equal(JSON.parse(b.storage.getItem(namespace('A'))).entries['atlas2-saved'].dirty, true);
  assert.ok(b.events.some(e => e.detail?.accountChanged === true && e.detail.previousUserId === 'A' && e.detail.userId === 'B'));
  b.server.account = 'A'; await b.api.sync();
  assert.equal(b.server.rows('A').get('atlas2-saved').value[0].id, 'A-private');
  assert.equal(b.api.status().pending, 0);
});

test('guest work stays private until an explicit import; account collision is preserved', async () => {
  const b = browser(); b.server.account = null;
  b.storage.setItem('atlas2-profile', JSON.stringify({ budget: 77 }));
  b.storage.setItem('atlas2-broken', 'not-json');
  await b.api.init();
  b.api.set('saved', [{ id: 'guest' }]);
  b.api.set('prefs', { country: 'JP' });
  b.server.account = 'A'; b.server.remote('atlas2-saved', [{ id: 'account-A' }]);
  await b.api.sync();
  assert.equal(b.api.get('prefs', null), null);
  assert.equal(b.api.get('profile', null), null);
  const imported = await b.api.importLegacy();
  assert.equal(imported.ok, true);
  assert.equal(imported.imported, 2);
  assert.deepEqual(plain(imported.skipped), ['atlas2-saved']);
  assert.deepEqual(plain(imported.invalid), ['atlas2-broken']);
  assert.equal(b.api.get('saved')[0].id, 'account-A');
  assert.equal(b.api.get('prefs').country, 'JP');
  assert.equal(b.api.get('profile').budget, 77);
  assert.equal(JSON.parse(b.storage.getItem('atlas2-profile')).budget, 77, 'Import leaves legacy original intact');
  await b.api.sync();
  assert.equal(b.server.rows('A').get('atlas2-prefs').value.country, 'JP');
});

test('newer remote data conflicts with dirty local data until explicit local resolution', async () => {
  const b = browser(); b.server.remote('atlas2-finance', { rent: 100 });
  await b.api.init(); b.api.set('finance', { rent: 200 });
  b.server.remote('atlas2-finance', { rent: 300 });
  await b.api.sync();
  assert.equal(b.api.status().mode, 'conflict');
  assert.equal(b.server.mutations().length, 0);
  const conflict = b.api.conflicts()[0];
  assert.equal(conflict.local.value.rent, 200);
  assert.equal(conflict.remote.value.rent, 300);
  assert.equal(conflict.remote.version, 2);
  assert.equal(b.api.resolveConflict('finance', 'local'), true);
  await b.api.sync();
  assert.equal(b.server.mutations()[0].body.expectedVersion, 2);
  assert.equal(b.server.rows('A').get('atlas2-finance').value.rent, 200);
  assert.equal(b.api.status().pending, 0);
  assert.equal(b.api.conflicts().length, 0);
});

test('a 409 race keeps both records and remote resolution respects tombstones', async () => {
  const b = browser(); b.server.remote('atlas2-saved', [{ id: 'original' }]);
  await b.api.init(); b.api.set('saved', [{ id: 'local' }]);
  let raced = false;
  b.server.hook = async call => {
    if (call.method === 'PUT' && !raced) { raced = true; b.server.remote('atlas2-saved', null, { deleted: true }); }
  };
  await b.api.sync();
  assert.equal(b.server.mutations().length, 1);
  assert.equal(b.api.status().mode, 'conflict');
  assert.equal(b.api.conflicts()[0].local.value[0].id, 'local');
  assert.equal(b.api.conflicts()[0].remote.deleted, true);
  assert.equal(b.api.resolveConflict('saved', 'remote'), true);
  assert.deepEqual(plain(b.api.get('saved', [])), []);
  await b.api.sync();
  assert.equal(b.server.mutations().length, 1, 'Choosing remote must not resurrect a deleted item');
  const restored = browser(b.server, b.storage); await restored.api.init();
  assert.equal(restored.api.get('saved', 'missing'), 'missing');
  assert.equal(restored.api.status().pending, 0);
});

test('deletes are versioned tombstones and later recreation uses the deletion version', async () => {
  const b = browser(); b.server.remote('atlas2-saved', [{ id: 'original' }]);
  await b.api.init();
  assert.equal(b.api.remove('saved'), true);
  assert.equal(b.api.get('saved', null), null);
  await b.api.sync();
  assert.equal(b.server.mutations()[0].method, 'DELETE');
  assert.equal(b.server.mutations()[0].body.expectedVersion, 1);
  assert.equal(b.server.rows('A').get('atlas2-saved').deleted, true);
  b.api.set('saved', [{ id: 'new' }]); await b.api.sync();
  assert.equal(b.server.mutations()[1].body.expectedVersion, 2);
  assert.equal(b.server.rows('A').get('atlas2-saved').version, 3);
  assert.equal(b.server.rows('A').get('atlas2-saved').deleted, false);
});

test('edits made during a PUT survive acknowledgment and are sent with the new version', async () => {
  const b = browser(); await b.api.init(); b.api.set('profile', { budget: 100 });
  const entered = deferred(), release = deferred(); let held = false;
  b.server.hook = async call => {
    if (call.method === 'PUT' && !held) { held = true; entered.resolve(); await release.promise; }
  };
  const syncing = b.api.sync(); await entered.promise;
  b.api.set('profile', { budget: 200 }); release.resolve(); await syncing;
  assert.equal(b.api.get('profile').budget, 200);
  assert.equal(b.server.rows('A').get('atlas2-profile').value.budget, 200);
  assert.deepEqual(b.server.mutations().map(c => c.body.expectedVersion), [0, 1]);
  assert.equal(b.api.status().pending, 0);
});

test('concurrent sync callers share one flight and cannot duplicate mutations', async () => {
  const b = browser(), entered = deferred(), release = deferred();
  b.server.hook = async call => { if (call.path === '/api/me') { entered.resolve(); await release.promise; } };
  const startup = b.api.init(); await entered.promise;
  const first = b.api.sync(), second = b.api.sync();
  assert.equal(first, second);
  assert.equal(b.server.calls.filter(c => c.path === '/api/me').length, 1);
  release.resolve(); await Promise.all([startup, first, second]);
  assert.equal(b.server.calls.filter(c => c.path === '/api/state').length, 1);
});

test('a mid-request account switch is blocked by expected-user guard; A queue never reaches B', async () => {
  const b = browser(); await b.api.init(); b.api.set('saved', [{ id: 'A-sensitive' }]);
  let switched = false;
  b.server.hook = async call => {
    if (call.method === 'PUT' && !switched) { switched = true; b.server.account = 'B'; }
  };
  await b.api.sync();
  assert.equal(b.server.rows('B').has('atlas2-saved'), false);
  assert.equal(b.api.status().pending, 1);
  assert.match(b.api.status().message, /계정이 변경/);
  await b.api.sync();
  assert.equal(b.api.user.id, 'B');
  assert.equal(b.api.get('saved', null), null);
  assert.equal(JSON.parse(b.storage.getItem(namespace('A'))).entries['atlas2-saved'].dirty, true);
});

test('401 during upload switches to guest while preserving the previous account queue', async () => {
  const b = browser(); await b.api.init(); b.api.set('saved', [{ id: 'A-sensitive' }]);
  b.server.hook = async call => { if (call.method === 'PUT') { b.server.account = null; return json({ error: 'UNAUTHENTICATED' }, 401); } };
  await b.api.sync();
  assert.equal(b.api.user, null);
  assert.equal(b.api.status().mode, 'local');
  assert.equal(b.api.get('saved', null), null);
  assert.equal(JSON.parse(b.storage.getItem(namespace('A'))).entries['atlas2-saved'].dirty, true);
  assert.ok(b.events.some(e => e.detail?.accountChanged && e.detail.previousUserId === 'A' && e.detail.userId === null));
});

test('corrupt local storage is exportable and is never silently overwritten', async () => {
  const b = browser(); b.storage.setItem(namespace('A'), '{incomplete');
  await b.api.init();
  assert.equal(b.api.status().mode, 'offline');
  assert.equal(b.api.set('saved', []), false);
  assert.equal(b.storage.getItem(namespace('A')), '{incomplete');
  assert.equal(b.api.exportPending().unparsedLocalBackup, '{incomplete');
  assert.equal(b.server.mutations().length, 0);
});

test('an unconfigured server keeps account-scoped local work without claiming cloud sync', async () => {
  const b = browser(); b.server.storageAvailable = false;
  await b.api.init(); b.api.set('finance', { rent: 400 }); await b.api.sync();
  assert.equal(b.api.status().mode, 'local');
  assert.equal(b.api.user.id, 'A');
  assert.equal(b.api.status().pending, 1);
  assert.equal(b.api.status().lastSynced, null);
  assert.equal(b.server.mutations().length, 0);
  assert.equal(b.api.exportPending().accountId, 'A');
});

test('conflicts do not block unrelated queued keys or create automatic overwrite loops', async () => {
  const b = browser(); b.server.remote('atlas2-conflict', 1); await b.api.init();
  b.api.set('conflict', 2); b.server.remote('atlas2-conflict', 3);
  for (let i = 0; i < 33; i++) b.api.set('key-' + i, i);
  await b.api.sync();
  assert.equal(b.api.status().mode, 'conflict');
  assert.equal(b.server.rows('A').get('atlas2-conflict').value, 3);
  assert.equal(b.server.mutations().length, 32);
  assert.equal(b.api.status().pending, 2);
  assert.ok([...b.timers.values()].some(t => t.delay === 100), 'Non-conflicting work after per-cycle write cap must still be scheduled');
  await b.api.sync();
  assert.equal(b.server.mutations().length, 33);
  assert.equal(b.api.status().pending, 1);
  assert.equal(b.api.conflicts().length, 1);
  assert.equal(b.timers.size, 0, 'Remaining conflict must wait for the user, not busy retry');
});

test('a stale second tab cannot replace a newer local outbox with its old snapshot', async () => {
  const first = browser(); await first.api.init();
  const second = browser(first.server, first.storage); await second.api.init();
  assert.equal(first.api.set('saved', [{ id: 'first-tab' }]), true);
  assert.equal(second.api.set('profile', { budget: 10 }), false);
  assert.match(second.api.status().message, /다른 탭/);
  const stored = JSON.parse(first.storage.getItem(namespace('A')));
  assert.equal(stored.entries['atlas2-saved'].value[0].id, 'first-tab');
  assert.equal(stored.entries['atlas2-saved'].dirty, true);
  assert.equal(Object.hasOwn(stored.entries, 'atlas2-profile'), false);
  await first.api.sync();
  assert.equal(first.server.rows('A').get('atlas2-saved').value[0].id, 'first-tab');
});

test('a failed initial read cannot later replace unread account data with an empty bucket', async () => {
  const first = browser(); await first.api.init(); first.api.set('saved', [{ id: 'preserved' }]);
  const original = first.storage.getItem(namespace('A'));
  first.storage.failReads = true;
  const fresh = browser(first.server, first.storage); await fresh.api.init();
  first.storage.failReads = false;
  assert.equal(fresh.api.set('saved', []), false);
  assert.equal(first.storage.getItem(namespace('A')), original);
  assert.match(fresh.api.status().message, /읽지 못해/);
});

test('remote value changes signal form rehydration; own writes and acknowledgments do not', async () => {
  const b = browser(); b.server.remote('atlas2-finance', { rent: 100 }); await b.api.init();
  b.events.length = 0;
  b.server.remote('atlas2-finance', { rent: 200 }); await b.api.sync();
  const changed = b.events.filter(e => e.detail?.remoteDataChanged);
  assert.equal(changed.length, 1);
  assert.deepEqual(plain(changed[0].detail.remoteChangedKeys), ['atlas2-finance']);
  assert.equal(b.api.get('finance').rent, 200);
  b.events.length = 0;
  b.api.set('finance', { rent: 300 }); await b.api.sync();
  assert.equal(b.events.filter(e => e.detail?.remoteDataChanged).length, 0);
  b.server.remote('atlas2-finance', null, { deleted: true }); await b.api.sync();
  assert.equal(b.events.filter(e => e.detail?.remoteDataChanged).length, 1);
  assert.equal(b.api.get('finance', null), null);
});
