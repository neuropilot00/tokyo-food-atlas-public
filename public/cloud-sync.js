(function (root) {
  'use strict';

  // Values and their outbox state are committed in one localStorage write.
  // Anonymous, legacy and each authenticated account are separate namespaces.
  // Account credentials are never stored by this bridge.
  var FORMAT = 1, PREFIX = 'atlas-cloud:v1:', GUEST = 'guest';
  var owner = GUEST, bucket = emptyBucket(), currentUser = null, admin = false;
  var storageAvailable = false, identityEstablished = false, initialized = false;
  var initialization = null, flight = null, rerun = false, timer = null, timerAt = 0;
  var retryAttempt = 0, offline = false, diskError = false, corruptRaw = null;
  var persistedRaw = null, diskReadFailed = false;
  var message = '기기 저장소를 준비하고 있습니다.', generation = 0;
  var listenersInstalled = false;

  function emptyBucket() { return { format: FORMAT, entries: {}, lastSynced: null }; }
  function stamp() { return new Date().toISOString(); }
  function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function logicalKey(k) {
    if (typeof k !== 'string' || !k || k.length > 200 || /[\u0000-\u001f]/.test(k)) throw new Error('INVALID_KEY');
    var normalized = k.indexOf('atlas2-') === 0 ? k : 'atlas2-' + k;
    if (!/^atlas2-[A-Za-z0-9_-]{1,110}$/.test(normalized)) throw new Error('INVALID_KEY');
    return normalized;
  }
  function clone(value) {
    var text = JSON.stringify(value, function (_k, v) {
      if (typeof v === 'undefined' || typeof v === 'function' || typeof v === 'symbol' || typeof v === 'bigint' || (typeof v === 'number' && !Number.isFinite(v))) throw new Error('NON_JSON_VALUE');
      return v;
    });
    if (text === undefined) throw new Error('NON_JSON_VALUE');
    return JSON.parse(text);
  }
  function physicalKey(id) { return PREFIX + encodeURIComponent(id); }
  function countPending() { return Object.values(bucket.entries).filter(function (e) { return e.dirty; }).length; }
  function countConflicts() { return Object.values(bucket.entries).filter(function (e) { return e.conflict; }).length; }
  function status() {
    return {
      mode: countConflicts() ? 'conflict' : (offline || diskError || corruptRaw !== null) ? 'offline' : currentUser && storageAvailable ? 'cloud' : 'local',
      pending: countPending(), lastSynced: bucket.lastSynced || null, message: message,
      conflictCount: countConflicts(), authenticated: !!currentUser, storageAvailable: storageAvailable, admin: admin,
    };
  }
  function emit(extra) {
    if (typeof root.dispatchEvent !== 'function' || typeof root.CustomEvent !== 'function') return;
    root.dispatchEvent(new root.CustomEvent('atlas-sync-change', { detail: Object.assign(status(), { userId: currentUser ? currentUser.id : null }, extra || {}) }));
  }
  function failLocal(text) { diskError = true; message = text; emit(); return false; }
  function loadBucket(id) {
    var raw;
    corruptRaw = null; diskError = false; diskReadFailed = false; persistedRaw = null;
    try { raw = root.localStorage.getItem(physicalKey(id)); persistedRaw = raw; }
    catch (_e) { diskError = true; diskReadFailed = true; message = '기기 저장소를 읽지 못했습니다. 새로고침한 뒤 다시 저장해 주세요.'; return emptyBucket(); }
    if (!raw) return emptyBucket();
    try {
      var data = JSON.parse(raw);
      if (data.format !== FORMAT || !data.entries || typeof data.entries !== 'object' || Array.isArray(data.entries)) throw new Error('FORMAT');
      Object.keys(data.entries).forEach(function (k) {
        var e = data.entries[k];
        if (logicalKey(k) !== k || !e || !Number.isInteger(e.version) || e.version < 0 || !Number.isInteger(e.revision) || e.revision < 0 || typeof e.deleted !== 'boolean' || typeof e.dirty !== 'boolean') throw new Error('ENTRY');
        if (!e.deleted && !own(e, 'value')) throw new Error('VALUE');
      });
      return data;
    } catch (_e) { corruptRaw = raw; message = '기기 기록 형식을 읽지 못했습니다. 대기 기록을 내보낸 뒤 복구해 주세요.'; return emptyBucket(); }
  }
  function commit(next, extra) {
    if (corruptRaw !== null) return failLocal('손상된 기기 기록을 덮어쓰지 않았습니다. 대기 기록을 내보내 주세요.');
    if (diskReadFailed) return failLocal('기존 기기 기록을 읽지 못해 덮어쓰지 않았습니다. 새로고침한 뒤 다시 저장해 주세요.');
    try {
      var currentRaw = root.localStorage.getItem(physicalKey(owner));
      if (currentRaw !== persistedRaw) {
        // A second tab must not overwrite a newer account outbox with its old
        // whole-bucket snapshot. Metadata-only changes are safe to refresh.
        var current = currentRaw ? JSON.parse(currentRaw) : emptyBucket();
        if (current.format !== FORMAT || JSON.stringify(current.entries) !== JSON.stringify(bucket.entries)) return failLocal('다른 탭에서 기기 기록이 바뀌어 덮어쓰지 않았습니다. 대기 기록을 내보내거나 새로고침한 뒤 다시 저장해 주세요.');
      }
      var raw = JSON.stringify(next);
      root.localStorage.setItem(physicalKey(owner), raw); persistedRaw = raw;
    }
    catch (_e) { return failLocal('기기 저장에 실패했습니다. 저장 공간·브라우저 설정을 확인하고 현재 대기 기록을 내보내 주세요.'); }
    bucket = next; diskError = false; emit(extra); return true;
  }
  function normalizedUser(me) {
    if (!me || me.authenticated !== true || !me.user || typeof me.user.id !== 'string' || !me.user.id || /[\r\n]/.test(me.user.id)) return null;
    return { id: me.user.id, displayName: typeof me.user.displayName === 'string' ? me.user.displayName : '' };
  }
  function useIdentity(me) {
    var user = normalizedUser(me), nextOwner = user ? 'user:' + user.id : GUEST;
    var previousId = currentUser ? currentUser.id : null;
    var changed = owner !== nextOwner, notifyChange = identityEstablished && changed;
    if (changed || !identityEstablished) { owner = nextOwner; bucket = loadBucket(owner); generation++; }
    currentUser = user; admin = !!(user && me.admin === true); storageAvailable = !!(user && me.storageAvailable === true);
    identityEstablished = true;
    if (!diskError && corruptRaw === null) message = user ? storageAvailable ? '계정 기록을 동기화하고 있습니다.' : '이 계정의 서버 저장소가 아직 연결되지 않아 기기에 보관합니다.' : '로그인하지 않은 기기 기록입니다. 다른 계정으로 자동 전송하지 않습니다.';
    emit({ accountChanged: notifyChange, previousUserId: previousId });
  }
  function clearTimer() { if (timer !== null) root.clearTimeout(timer); timer = null; timerAt = 0; }
  function schedule(delay) {
    if (!initialized) return;
    if (flight) { rerun = true; return; }
    var due = Date.now() + delay;
    if (timer !== null && timerAt <= due) return;
    clearTimer(); timerAt = due;
    timer = root.setTimeout(function () { timer = null; timerAt = 0; sync(); }, delay);
  }
  function scheduleRetry() {
    if (root.navigator && root.navigator.onLine === false) return;
    var delay = Math.min(60000, 1000 * Math.pow(2, Math.min(retryAttempt++, 6)));
    schedule(delay);
  }
  async function request(path, method, body, expectedUserId) {
    var controller = typeof root.AbortController === 'function' ? new root.AbortController() : null;
    var abortTimer = controller ? root.setTimeout(function () { controller.abort(); }, 12000) : null;
    var headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    // This is an account-consistency guard, not authentication. The server must
    // compare it with the authenticated subject before reading/writing state.
    if (expectedUserId) headers['X-Atlas-User-Id'] = expectedUserId;
    try {
      var response = await root.fetch(path, { method: method || 'GET', credentials: 'same-origin', cache: 'no-store', redirect: 'error', headers: headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller ? controller.signal : undefined });
      var data;
      try { data = await response.json(); }
      catch (_e) { return { ok: false, status: response.status, error: 'INVALID_RESPONSE' }; }
      return { ok: response.ok, status: response.status, data: data, error: data && data.error };
    } catch (_e) { return { ok: false, status: 0, error: 'NETWORK_ERROR' }; }
    finally { if (abortTimer !== null) root.clearTimeout(abortTimer); }
  }
  function remoteRow(row, expectedKey) {
    if (row === null || row === undefined) return expectedKey ? { key: expectedKey, value: null, deleted: true, version: 0, updatedAt: null } : null;
    if (!row || typeof row.key !== 'string' || !Number.isInteger(row.version) || row.version < 0) return null;
    var k;
    try { k = logicalKey(row.key); } catch (_e) { return null; }
    if (expectedKey && k !== expectedKey) return null;
    var deleted = row.deleted === true;
    if (!deleted && !own(row, 'value')) return null;
    try { return { key: k, value: deleted ? null : clone(row.value), deleted: deleted, version: row.version, updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : null }; }
    catch (_e) { return null; }
  }
  function entryFromRemote(row, revision) { return { value: row.value, deleted: row.deleted, version: row.version, updatedAt: row.updatedAt, localUpdatedAt: null, revision: revision || 0, dirty: false, conflict: null }; }
  function conflictFor(row) { return { kind: 'server', remote: row, detectedAt: stamp() }; }
  function mergeRemote(items) {
    if (!Array.isArray(items)) return false;
    var rows = items.map(function (r) { return remoteRow(r); });
    if (rows.some(function (r) { return !r; })) return false;
    var next = clone(bucket), remoteChangedKeys = [];
    rows.forEach(function (row) {
      var local = next.entries[row.key];
      if (!local) {
        next.entries[row.key] = entryFromRemote(row, 0);
        if (!row.deleted) remoteChangedKeys.push(row.key);
      }
      else if (local.dirty) {
        if (row.version > local.version) local.conflict = conflictFor(row);
      } else if (row.version >= local.version) {
        if (local.deleted !== row.deleted || (!row.deleted && JSON.stringify(local.value) !== JSON.stringify(row.value))) remoteChangedKeys.push(row.key);
        next.entries[row.key] = entryFromRemote(row, local.revision);
      }
    });
    // Consumers that retain their own form state must reload these clean keys
    // before a later set(); otherwise an old form can overwrite a new base.
    return commit(next, remoteChangedKeys.length ? { remoteDataChanged: true, remoteChangedKeys: remoteChangedKeys } : undefined);
  }
  function reportRequestFailure(result) {
    if (result.status === 401) {
      useIdentity({ authenticated: false }); offline = false;
      message = '로그인이 만료되었거나 로그아웃되었습니다. 이전 계정의 대기 기록은 해당 계정에 보존했습니다.';
      emit(); return false;
    }
    offline = true;
    message = result.error === 'ACCOUNT_CHANGED' ? '계정이 변경되어 이전 계정의 전송을 중단했습니다. 다시 확인합니다.' : result.status === 413 ? '기록이 서버의 허용 크기를 넘습니다. 기기 대기열은 보존했습니다.' : '서버 연결에 실패했습니다. 변경은 이 계정의 기기 대기열에 남아 있습니다.';
    emit(); return true;
  }

  async function performSync() {
    if (root.navigator && root.navigator.onLine === false) { offline = true; message = '오프라인입니다. 변경은 기기에 보관하고 온라인 복귀 후 재시도합니다.'; emit(); return { retry: false }; }
    var me = await request('/api/me');
    if (!me.ok) {
      if (me.status === 401) { useIdentity({ authenticated: false }); offline = false; emit(); return { retry: false }; }
      offline = true;
      if (!identityEstablished) { bucket = loadBucket(GUEST); owner = GUEST; }
      message = '계정을 확인하지 못해 다른 계정의 기록을 불러오거나 전송하지 않았습니다.'; emit(); return { retry: true };
    }
    useIdentity(me.data); offline = false;
    if (!currentUser || !storageAvailable || corruptRaw !== null) { emit(); return { retry: false }; }
    var userId = currentUser.id, cycle = generation;
    var incoming = await request('/api/state', 'GET', undefined, userId);
    if (cycle !== generation) return { retry: false };
    if (!incoming.ok) return { retry: reportRequestFailure(incoming) && incoming.status !== 413 };
    if (!mergeRemote(incoming.data && incoming.data.items)) {
      if (!diskError) { offline = true; message = '서버 기록 형식이 올바르지 않아 기존 기록을 유지했습니다.'; emit(); }
      return { retry: !diskError };
    }
    var writes = 0;
    while (writes < 32) {
      var k = Object.keys(bucket.entries).find(function (name) { return bucket.entries[name].dirty && !bucket.entries[name].conflict; });
      if (!k) break;
      var snapshot = clone(bucket.entries[k]), method = snapshot.deleted ? 'DELETE' : 'PUT';
      var payload = snapshot.deleted ? { expectedVersion: snapshot.version } : { value: snapshot.value, expectedVersion: snapshot.version };
      var result = await request('/api/state/' + encodeURIComponent(k), method, payload, userId); writes++;
      if (cycle !== generation || !currentUser || currentUser.id !== userId) return { retry: false };
      if (result.status === 409 && result.error === 'VERSION_CONFLICT') {
        var current = remoteRow(result.data.current, k);
        if (!current) { offline = true; message = '충돌 응답 형식을 확인할 수 없어 대기 기록을 유지했습니다.'; emit(); return { retry: true }; }
        var conflicted = clone(bucket);
        if (conflicted.entries[k]) { conflicted.entries[k].conflict = conflictFor(current); conflicted.entries[k].dirty = true; }
        if (!commit(conflicted)) return { retry: false };
        continue;
      }
      if (!result.ok) return { retry: reportRequestFailure(result) && result.status !== 413 && result.status !== 400 };
      var acknowledged = remoteRow(result.data, k);
      if (!acknowledged || acknowledged.version <= snapshot.version || (snapshot.deleted && !acknowledged.deleted)) {
        offline = true; message = '서버 저장 확인 응답이 올바르지 않아 대기 기록을 보존했습니다.'; emit(); return { retry: true };
      }
      var next = clone(bucket), latest = next.entries[k];
      if (!latest) return { retry: true };
      if (latest.revision === snapshot.revision) next.entries[k] = entryFromRemote(acknowledged, latest.revision);
      else { latest.version = acknowledged.version; latest.updatedAt = acknowledged.updatedAt; latest.dirty = true; }
      if (!commit(next)) return { retry: false };
    }
    retryAttempt = 0; offline = false;
    if (!countPending()) {
      var completed = clone(bucket); completed.lastSynced = stamp();
      if (!commit(completed)) return { retry: false };
      message = '이 계정의 기록을 동기화했습니다.';
    } else if (countConflicts()) message = '서로 다른 변경이 있습니다. 원격 또는 기기 내용을 직접 선택하기 전에는 덮어쓰지 않습니다.';
    else message = '남은 변경을 동기화하고 있습니다.';
    emit(); return { retry: false, more: Object.values(bucket.entries).some(function (e) { return e.dirty && !e.conflict; }) };
  }

  function sync() {
    if (flight) { rerun = true; return flight; }
    clearTimer();
    var outcome = { retry: false };
    flight = (async function () {
      try { outcome = await performSync(); }
      catch (_e) { offline = true; message = '동기화 중 오류가 발생했습니다. 기기 대기 기록은 유지됩니다.'; emit(); outcome = { retry: true }; }
      return status();
    })().finally(function () {
      flight = null;
      var again = rerun; rerun = false;
      if (outcome.retry) scheduleRetry();
      else if ((again || outcome.more) && currentUser && storageAvailable && !diskError && Object.values(bucket.entries).some(function (e) { return e.dirty && !e.conflict; })) schedule(100);
    });
    return flight;
  }
  function installListeners() {
    if (listenersInstalled || typeof root.addEventListener !== 'function') return;
    listenersInstalled = true;
    root.addEventListener('online', function () { offline = false; retryAttempt = 0; schedule(0); emit(); });
    root.addEventListener('offline', function () { offline = true; clearTimer(); message = '오프라인입니다. 변경은 기기에 보관합니다.'; emit(); });
  }
  function init() {
    if (initialization) return initialization;
    initialized = true; bucket = loadBucket(GUEST); installListeners();
    initialization = sync().then(function () { return status(); });
    return initialization;
  }
  function get(k, fallback) {
    try { var entry = bucket.entries[logicalKey(k)]; return !entry || entry.deleted ? fallback : clone(entry.value); }
    catch (_e) { return fallback; }
  }
  function writeLocal(k, value, deleted) {
    var name, cleanValue;
    try { name = logicalKey(k); cleanValue = deleted ? null : clone(value); }
    catch (_e) { message = '저장할 키 또는 값이 JSON 형식에 맞지 않습니다. 변경을 저장하지 않았습니다.'; emit(); return false; }
    var next = clone(bucket), old = next.entries[name];
    next.entries[name] = {
      value: cleanValue, deleted: !!deleted, version: old ? old.version : 0,
      updatedAt: old ? old.updatedAt : null, localUpdatedAt: stamp(),
      revision: old ? old.revision + 1 : 1, dirty: true, conflict: old ? old.conflict || null : null,
    };
    if (!commit(next)) return false;
    message = currentUser && storageAvailable ? '기기에 저장했습니다. 서버 동기화를 기다립니다.' : '이 기기에 저장했습니다. 다른 계정으로 자동 전송하지 않습니다.';
    emit(); if (currentUser && storageAvailable) schedule(400); return true;
  }
  function set(k, value) { return writeLocal(k, value, false); }
  function remove(k) { return writeLocal(k, null, true); }
  function conflicts() {
    return Object.entries(bucket.entries).filter(function (pair) { return pair[1].conflict; }).map(function (pair) {
      var k = pair[0], e = pair[1];
      return clone({ key: k, kind: e.conflict.kind, baseVersion: e.version,
        local: { value: e.value, deleted: e.deleted, updatedAt: e.localUpdatedAt }, remote: e.conflict.remote,
        detectedAt: e.conflict.detectedAt });
    });
  }
  function resolveConflict(k, choice) {
    var name;
    try { name = logicalKey(k); } catch (_e) { return false; }
    var e = bucket.entries[name];
    if (!e || !e.conflict || !['remote', 'local'].includes(choice)) return false;
    var next = clone(bucket), remote = e.conflict.remote;
    if (choice === 'remote') next.entries[name] = entryFromRemote(remote, e.revision + 1);
    else { next.entries[name].version = remote.version; next.entries[name].updatedAt = remote.updatedAt; next.entries[name].revision++; next.entries[name].dirty = true; next.entries[name].conflict = null; }
    if (!commit(next)) return false;
    message = choice === 'remote' ? '원격 내용을 선택했습니다.' : '기기 내용을 선택했습니다. 원격 최신 버전을 조건으로 다시 저장합니다.';
    emit(); if (currentUser && storageAvailable) schedule(0); return true;
  }
  async function importLegacy() {
    await init(); await sync();
    if (!currentUser) return { ok: false, imported: 0, skipped: [], message: '가져올 계정에 로그인한 뒤 다시 실행해 주세요.' };
    var imports = {}, skipped = [], invalid = [], next = clone(bucket);
    try {
      for (var i = 0; i < root.localStorage.length; i++) {
        var k = root.localStorage.key(i);
        if (!k || k.indexOf('atlas2-') !== 0) continue;
        try { imports[logicalKey(k)] = JSON.parse(root.localStorage.getItem(k)); }
        catch (_e) { invalid.push(k); }
      }
      // Explicitly requested import can also bring this device's anonymous work.
      // Logging in alone never performs this step. Existing account keys win.
      var rawGuest = root.localStorage.getItem(physicalKey(GUEST));
      if (rawGuest) {
        var guest = JSON.parse(rawGuest);
        if (guest.format === FORMAT && guest.entries) Object.entries(guest.entries).forEach(function (pair) {
          var name = logicalKey(pair[0]), entry = pair[1];
          if (entry.deleted) delete imports[name]; else imports[name] = clone(entry.value);
        });
      }
    } catch (_e) { return { ok: false, imported: 0, skipped: [], message: '기존 기기 기록을 읽지 못했습니다. 원본은 그대로 두었습니다.' }; }
    var imported = 0;
    Object.entries(imports).forEach(function (pair) {
      var k = pair[0], value;
      if (own(next.entries, k)) { skipped.push(k); return; }
      try { value = clone(pair[1]); } catch (_e) { invalid.push(k); return; }
      next.entries[k] = { value: value, deleted: false, version: 0, updatedAt: null, localUpdatedAt: stamp(), revision: 1, dirty: true, conflict: null }; imported++;
    });
    if (!commit(next)) return { ok: false, imported: 0, skipped: skipped, invalid: invalid, message: message };
    message = imported + '개 기존 항목을 이 계정의 기기 대기열로 가져왔습니다. 기존 계정의 같은 키 ' + skipped.length + '개는 덮어쓰지 않았습니다.';
    emit(); if (storageAvailable && imported) schedule(0);
    return { ok: true, imported: imported, skipped: skipped, invalid: invalid, message: message };
  }
  function exportPending() {
    var result = { format: 'atlas-pending-v1', exportedAt: stamp(), accountId: currentUser ? currentUser.id : null, owner: owner, status: status(), items: [] };
    Object.entries(bucket.entries).forEach(function (pair) {
      var k = pair[0], e = pair[1];
      if (e.dirty || e.conflict) result.items.push(clone({ key: k, value: e.value, deleted: e.deleted, expectedVersion: e.version, updatedAt: e.localUpdatedAt, conflict: e.conflict || null }));
    });
    if (corruptRaw !== null) result.unparsedLocalBackup = corruptRaw;
    return result;
  }
  var api = { init: init, get: get, set: set, remove: remove, delete: remove, status: status, sync: sync,
    importLegacy: importLegacy, resolveConflict: resolveConflict, conflicts: conflicts, exportPending: exportPending };
  Object.defineProperty(api, 'user', { enumerable: true, get: function () { return currentUser ? clone(currentUser) : null; } });
  root.AtlasCloud = Object.freeze(api);
})(typeof window !== 'undefined' ? window : globalThis);
