/** Snapshot-backed region and merchant search. Source periods and nulls are retained. */
const MAX_FILE_BYTES = 6 * 1024 * 1024;
const MAX_SHOP_CHUNKS = 8;
const runtimeCaches = new WeakMap();
const requestVersions = new WeakMap();
const standaloneCache = { pointer: null, pointerUntil: 0, json: new Map() };
const diagnosticCodes = new Set([
  'INVALID_ASSET_PATH', 'POINTER_READ_FAILED', 'POINTER_INVALID_JSON', 'POINTER_INVALID_VERSION',
  'ACTIVE_R2_BINDING_MISSING', 'ACTIVE_R2_FETCH_FAILED', 'ACTIVE_R2_OBJECT_MISSING', 'ACTIVE_R2_BODY_FAILED', 'ACTIVE_R2_JSON_INVALID',
  'ASSET_BINDING_MISSING', 'ASSET_FETCH_FAILED', 'ASSET_HTTP_401', 'ASSET_HTTP_403', 'ASSET_HTTP_404', 'ASSET_HTTP_5XX', 'ASSET_HTTP_OTHER',
  'ASSET_BODY_FAILED', 'ASSET_SIZE_EXCEEDED', 'ASSET_JSON_INVALID', 'ASSET_HTML_INSTEAD_OF_JSON', 'REGION_DETAIL_MISSING', 'UNCLASSIFIED_MARKET_ERROR'
]);
class MarketDataError extends Error {
  constructor(code) { super('Market data unavailable'); this.name = 'MarketDataError'; this.diagnosticCode = code; }
}
function dataError(code) { return new MarketDataError(code); }
/** Deliberately returns only a fixed code, never source exception text or binding values. */
export function marketDiagnosticCode(error) {
  return diagnosticCodes.has(error?.diagnosticCode) ? error.diagnosticCode : 'UNCLASSIFIED_MARKET_ERROR';
}

function cacheFor(env) {
  if (!env || typeof env !== 'object') return standaloneCache;
  if (!runtimeCaches.has(env)) runtimeCaches.set(env, { pointer: null, pointerUntil: 0, json: new Map() });
  return runtimeCaches.get(env);
}

async function activeVersion(env, request) {
  if (request && requestVersions.has(request)) return requestVersions.get(request);
  const cache = cacheFor(env);
  if (cache.pointerUntil > Date.now()) {
    if (request) requestVersions.set(request, cache.pointer);
    return cache.pointer;
  }
  let version = null;
  if (env?.DB?.prepare) {
    let row;
    try {
      row = await env.DB.prepare('SELECT payload FROM market_cache WHERE key = ?').bind('active-market-version').first();
    } catch (error) {
      // A fresh installation may have no cache table. Other DB failures must not
      // silently select an older snapshot while an active release is unknown.
      if (!/no such table/i.test(String(error?.message || error))) throw dataError('POINTER_READ_FAILED');
    }
    if (row?.payload) {
      let payload;
      try { payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload; }
      catch { throw dataError('POINTER_INVALID_JSON'); }
      if (typeof payload?.version !== 'string' || !/^[A-Za-z0-9_.-]{1,100}$/.test(payload.version)) throw dataError('POINTER_INVALID_VERSION');
      version = payload.version;
    }
  }
  cache.pointer = version;
  cache.pointerUntil = Date.now() + 15000;
  if (request) requestVersions.set(request, version);
  return version;
}

/** Read the pinned active R2 release; use bundled assets only with no active version.
 * Pass the incoming request during Vite development so the asset binding retains
 * the already accepted origin. Production/RPC callers without a request may use
 * the hostname-independent assets.local fallback documented by Cloudflare.
 */
export async function readMarketJson(path, env, request) {
  if (typeof path !== 'string' || !/^[A-Za-z0-9_./-]+\.json$/.test(path) || path.includes('..') || path.startsWith('/')) throw dataError('INVALID_ASSET_PATH');
  const version = await activeVersion(env, request);
  const cache = cacheFor(env);
  const key = `${version || 'bundled'}:${path}`;
  const cached = cache.json.get(key);
  if (cached && cached.expires > Date.now()) return cached.value;
  let raw = null;
  if (version) {
    if (!env?.BUCKET?.get) throw dataError('ACTIVE_R2_BINDING_MISSING');
    let object;
    try { object = await env.BUCKET.get(`releases/${version}/${path}`); }
    catch { throw dataError('ACTIVE_R2_FETCH_FAILED'); }
    if (!object) throw dataError('ACTIVE_R2_OBJECT_MISSING');
    if (object.size > MAX_FILE_BYTES) throw dataError('ASSET_SIZE_EXCEEDED');
    try { raw = await object.text(); }
    catch { throw dataError('ACTIVE_R2_BODY_FAILED'); }
  }
  if (raw === null) {
    if (!env?.ASSETS?.fetch) throw dataError('ASSET_BINDING_MISSING');
    let response;
    const assetUrl = new URL(`/market/${path}`, request?.url || 'https://assets.local');
    try { response = await env.ASSETS.fetch(new Request(assetUrl, { method: 'GET' })); }
    catch { throw dataError('ASSET_FETCH_FAILED'); }
    if (!response.ok) {
      const code = [401, 403, 404].includes(response.status) ? `ASSET_HTTP_${response.status}` : response.status >= 500 ? 'ASSET_HTTP_5XX' : 'ASSET_HTTP_OTHER';
      throw dataError(code);
    }
    const size = Number(response.headers.get('content-length'));
    if (Number.isFinite(size) && size > MAX_FILE_BYTES) throw dataError('ASSET_SIZE_EXCEEDED');
    try { raw = await response.text(); }
    catch { throw dataError('ASSET_BODY_FAILED'); }
  }
  if (new TextEncoder().encode(raw).byteLength > MAX_FILE_BYTES) throw dataError('ASSET_SIZE_EXCEEDED');
  let value;
  try { value = JSON.parse(raw); }
  catch { throw dataError(version ? 'ACTIVE_R2_JSON_INVALID' : /^\s*</.test(raw) ? 'ASSET_HTML_INSTEAD_OF_JSON' : 'ASSET_JSON_INVALID'); }
  // Large store chunks are processed one at a time and are not kept in Worker memory.
  if (!path.startsWith('kr-food/districts/')) {
    while (cache.json.size >= 12) cache.json.delete(cache.json.keys().next().value);
    cache.json.set(key, { value, expires: Date.now() + 60000 });
  }
  return value;
}

function json(value, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, max-age=30', ...extraHeaders } });
}
function failure(code, message, status = 400, extra = {}) { return json({ error: code, message, ...extra }, status); }
function norm(value) { return String(value ?? '').normalize('NFKC').toLocaleLowerCase().trim(); }
function numeric(params, key, { fallback, min, max, integer = false } = {}) {
  const raw = params.get(key);
  if (raw === null) return fallback;
  if (!raw.trim()) throw new Error(`${key} must be a number`);
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw new Error(`${key} is outside the supported range`);
  return value;
}
function countryFrom(params) {
  const country = (params.get('country') || 'KR').toUpperCase();
  if (!['KR', 'JP'].includes(country)) throw new Error('country must be KR or JP');
  return country;
}

export function haversineMetres(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const a = Math.sin((lat2 - lat1) * rad / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin((lon2 - lon1) * rad / 2) ** 2;
  return 6371008.8 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

const searchAliases = { '도쿄': '東京都', '오사카': '大阪', '교토': '京都', '후쿠오카': '福岡', '삿포로': '札幌', '나고야': '名古屋', '요코하마': '横浜', '고베': '神戸', '신주쿠': '新宿', '시부야': '渋谷', '이케부쿠로': '池袋', '신오쿠보': '大久保', '하라주쿠': '原宿', '오쿠보': '大久保', '홋카이도': '北海道' };

async function regionSearch(request, env, params, country) {
  const limit = numeric(params, 'limit', { fallback: 20, min: 1, max: 50, integer: true });
  const requestedId = params.get('id');
  if (params.has('id') && !/^[A-Za-z0-9_-]{1,80}$/.test(requestedId || '')) return failure('INVALID_REGION_ID', 'id must be a supported region identifier');
  const q = norm(params.get('q')).slice(0, 120);
  const terms = q.split(/\s+/).filter(Boolean).map(s => norm(searchAliases[s] || s));
  const province = norm(params.get('province'));
  const index = await readMarketJson(`regions/${country}.json`, env, request);
  if (!requestedId && province && !index.provinces.some(p => [norm(p.id), norm(p.name), norm(`JP-PREF-${p.id}`)].includes(province))) return failure('INVALID_PROVINCE', 'province does not identify a supported source region');
  const candidates = index.regions.filter(r => {
    if (requestedId) return r.id === requestedId;
    if (province && ![norm(r.province), norm(r.provinceCode), norm(`JP-PREF-${r.provinceCode}`)].includes(province)) return false;
    const text = norm(r.searchText);
    return terms.every(term => text.includes(term));
  });
  if (q && !requestedId) candidates.sort((a, b) => Number(norm(b.name) === q) - Number(norm(a.name) === q) || Number(b.coverage?.flow) - Number(a.coverage?.flow) || a.name.localeCompare(b.name));
  const chosen = candidates.slice(0, limit);
  const fetched = new Map();
  const regions = [];
  for (const entry of chosen) {
    if (!fetched.has(entry.detailPath)) fetched.set(entry.detailPath, await readMarketJson(entry.detailPath, env, request));
    const detail = fetched.get(entry.detailPath).areas?.[entry.id];
    if (!detail) throw dataError('REGION_DETAIL_MISSING');
    regions.push(detail);
  }
  return json({ country, id: requestedId, q, province: params.get('province') || null, total: candidates.length, limit, regions, provinces: index.provinces, version: index.version, coverage: { resultsMayMixGeographyLevels: true, customerAge: false, sourceCoverageIsPerRegion: true } });
}

const categoryGroups = {
  korean: ['I201'], chinese: ['I202'], japanese: ['I203'], western: ['I204'],
  bakery: ['I21001', 'I21002'], fast_food: ['I21003', 'I21004', 'I21005', 'I21008', 'I21099'],
  chicken: ['I21006'], bunsik: ['I21007'], pub: ['I211'], cafe: ['I21201']
};
function categoryMatches(code, name, requested) {
  if (!requested || requested === 'all') return true;
  const groups = categoryGroups[requested];
  if (groups) return groups.some(prefix => code.startsWith(prefix));
  return code.toLowerCase() === requested || norm(name) === requested;
}

async function shopSearch(request, env, params) {
  const lat = numeric(params, 'lat', { min: -90, max: 90 });
  const lng = numeric(params, 'lng', { min: -180, max: 180 });
  if (lat === undefined || lng === undefined) return failure('INVALID_COORDINATES', 'lat and lng are required');
  const radius = numeric(params, 'radius', { fallback: 500, min: 1, max: 2000 });
  const limit = numeric(params, 'limit', { fallback: 30, min: 1, max: 100, integer: true });
  const offset = numeric(params, 'offset', { fallback: 0, min: 0, max: 10000, integer: true });
  const category = norm(params.get('category'));
  const q = norm(params.get('q')).slice(0, 120);
  const index = await readMarketJson('kr-food/search-index.json', env, request);
  if (category && category !== 'all' && !categoryGroups[category] && !index.categories.some(c => norm(c.code) === category || norm(c.name) === category)) return failure('INVALID_CATEGORY', 'category must be a supported industry key, source code, or category name');
  const latDelta = radius / 110000 * 1.02;
  const lngDelta = radius / (110000 * Math.max(0.000001, Math.abs(Math.cos(lat * Math.PI / 180)))) * 1.02;
  const box = [lng - lngDelta, lat - latDelta, lng + lngDelta, lat + latDelta];
  const candidateChunks = index.districts.filter(d => d.bbox && !(d.bbox[2] < box[0] || d.bbox[0] > box[2] || d.bbox[3] < box[1] || d.bbox[1] > box[3]));
  candidateChunks.sort((a, b) => haversineMetres(lat, lng, a.centroid.lat, a.centroid.lon) - haversineMetres(lat, lng, b.centroid.lat, b.centroid.lon));
  const chosenChunks = candidateChunks.slice(0, MAX_SHOP_CHUNKS);
  const matches = [];
  for (const district of chosenChunks) {
    const chunk = await readMarketJson(`kr-food/${district.chunk}`, env, request);
    const col = Object.fromEntries(chunk.columns.map((name, i) => [name, i]));
    for (const values of chunk.stores) {
      const slat = values[col.lat], slng = values[col.lon];
      if (!Number.isFinite(slat) || !Number.isFinite(slng)) continue;
      const code = String(values[col.categoryCode] || '');
      const cname = String(values[col.categoryName] || '');
      if (!categoryMatches(code, cname, category)) continue;
      const rawName = String(values[col.name] || '');
      const branch = values[col.branchName] || null;
      const name = branch && !rawName.includes(branch) ? `${rawName} ${branch}` : rawName;
      const address = values[col.address] || values[col.lotAddress] || null;
      if (q && !norm(`${name} ${address || ''} ${cname}`).includes(q)) continue;
      const distance = haversineMetres(lat, lng, slat, slng);
      if (distance > radius) continue;
      matches.push({ id: values[col.id], name, rawName, branchName: branch, category: cname, categoryCode: code, address, lat: slat, lng: slng, floor: values[col.floor] ?? null, districtCode: district.code, district: district.name, province: district.provinceName, neighborhood: values[col.administrativeDongName] ?? null, distanceMeters: Math.round(distance * 10) / 10, sourcePeriod: index.sourcePeriod, observedAt: index.sourcePeriod, sourceUrl: index.sourceUrl, customerAge: null, currentOperation: 'unverified' });
    }
  }
  matches.sort((a, b) => a.distanceMeters - b.distanceMeters || String(a.id).localeCompare(String(b.id)));
  const shops = matches.slice(offset, offset + limit);
  const complete = chosenChunks.length === candidateChunks.length;
  const hasMore = offset + shops.length < matches.length;
  return json({ country: 'KR', status: 'snapshot', sourcePeriod: index.sourcePeriod, observedAt: index.sourcePeriod, sourceUrl: index.sourceUrl, radius, center: { lat, lng }, customerAge: null, currentOperation: 'unverified', shops, total: matches.length, countUnit: 'source_food_business_record', physicalOutletDeduplication: false, totalIsExact: complete, pagination: { limit, offset, returned: shops.length, hasMore, nextOffset: hasMore ? offset + shops.length : null, totalIsExact: complete }, coverage: { complete, meaning: 'matching_source_records_not_unique_physical_outlets_or_all_currently_open_businesses', checkedChunks: chosenChunks.map(d => d.code), candidateChunkCount: candidateChunks.length, maxChunks: MAX_SHOP_CHUNKS, truncatedByChunkLimit: !complete, live: false, customerAge: false }, categories: index.categories });
}

async function competitionForArea(request, env, params) {
  const areaId = params.get('areaId');
  if (!areaId || !/^[A-Za-z0-9_-]{1,80}$/.test(areaId)) return failure('INVALID_AREA', 'A valid areaId is required');
  const index = await readMarketJson('competition/index.json', env, request);
  const path = index.areaPaths[areaId];
  if (!path) return failure('AGGREGATE_NOT_AVAILABLE', '이 지역의 같은 기준 음식업종 집계는 연결되지 않았습니다.', 404, { areas: [], industry_catalog: [] });
  const document = await readMarketJson(path, env, request);
  const area = document.areas.find(a => a.id === areaId);
  if (!area) return failure('AREA_NOT_FOUND', 'Area not found in the aggregate snapshot', 404);
  return json({ ...document, areas: [area] });
}

/** Called by the application's authenticated/general API dispatcher. JP shops are delegated. */
export async function marketApi(request, env, path) {
  const url = new URL(request.url);
  const route = path || url.pathname;
  const known = ['/api/regions', '/api/shops', '/api/market/status', '/api/market/competition'];
  if (!known.includes(route)) return null;
  if (request.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED', message: 'GET is required' }, 405, { Allow: 'GET' });
  try {
    if (route === '/api/market/status') {
      const manifest = await readMarketJson('manifest.json', env, request);
      return json({ status: 'snapshot_available', version: manifest.version, builtAt: manifest.builtAt, coverage: manifest.coverage, regions: manifest.regions, sourceManifest: '/market/sources.json', limitations: manifest.limitations, activeVersion: await activeVersion(env, request) });
    }
    if (route === '/api/market/competition') return await competitionForArea(request, env, url.searchParams);
    const country = countryFrom(url.searchParams);
    if (route === '/api/regions') return await regionSearch(request, env, url.searchParams, country);
    if (country === 'JP') return null;
    return await shopSearch(request, env, url.searchParams);
  } catch (error) {
    const message = String(error?.message || 'Market data unavailable');
    if (/^country must be KR or JP$/.test(message) || /^[a-zA-Z]+ (must be a number|is outside the supported range)$/.test(message)) return failure('INVALID_QUERY', message);
    return failure('MARKET_DATA_UNAVAILABLE', '자료를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.', 503, { diagnosticCode: marketDiagnosticCode(error) });
  }
}
