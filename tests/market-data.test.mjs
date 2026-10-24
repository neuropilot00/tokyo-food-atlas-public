import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { marketApi, readMarketJson, haversineMetres } from '../lib/market-data.mjs';

const assetRoot = new URL('../public/', import.meta.url);
const env = { ASSETS: { async fetch(request) {
  try { return new Response(await readFile(new URL(new URL(request.url).pathname.slice(1), assetRoot)), { headers: { 'content-type': 'application/json' } }); }
  catch { return new Response('Not found', { status: 404 }); }
} } };
async function get(path) {
  const response = await marketApi(new Request(`https://atlas.test${path}`), env);
  return { response, data: response ? await response.json() : null };
}
const checks = [];
async function check(name, fn) { await test(name, fn); checks.push(name); }

await check('input bounds and missing values return HTTP 400', async () => {
  for (const path of ['/api/regions?country=US', '/api/shops?lat=&lng=127', '/api/shops?lng=127', '/api/shops?lat=nan&lng=127', '/api/shops?lat=37&lng=127&radius=2001', '/api/shops?lat=37&lng=127&limit=101']) assert.equal((await get(path)).response.status, 400, path);
});
await check('existing Seoul core population is preserved', async () => {
  const { data } = await get('/api/regions?country=KR&q=성수동카페거리');
  const area = data.regions.find(a => a.id === '3110131');
  assert.equal(area.residents.total, 2191); assert.equal(area.workers.total, 4421); assert.equal(area.flow.total, 1130942);
  assert.equal(data.provinces.length, 16);
});
await check('nationwide residents join by code while worker and flow metrics remain null', async () => {
  const { data } = await get('/api/regions?country=KR&q=부산&province=26&limit=20');
  assert(data.regions.length); assert(data.regions.every(a => a.provinceCode === '26'));
  assert(data.regions.every(a => a.residents.total > 0 && a.workers.total === null && a.flow === null));
  assert(data.regions.every(a => a.coverage.customerAge === false));
  for (const area of data.regions) {
    assert.equal(area.residents.censusMonth, '2026-09');
    assert.equal(area.residents.sourceAgeLabel, '0–19세');
    assert.equal(Object.values(area.residents.groups).reduce((a,b)=>a+b,0),area.residents.total);
    assert.equal(area.sourcePeriod, '2026-06-30');
  }
  const exact=(await get('/api/regions?country=KR&id=KR-ADONG-26230550')).data.regions[0];
  assert.equal(exact.name,'초읍동'); assert.equal(exact.residents.total,21301);
  assert.equal(exact.residents.sourceCode,'2623055000');
  assert.equal(exact.residents.sourceUrl,'https://jumin.mois.go.kr/ageStatMonth.do');
  assert.match(exact.residents.definition,/외국인 제외/);
});
await check('unmatched administrative code stays null and coverage separates geography levels', async () => {
  const area=(await get('/api/regions?country=KR&id=KR-ADONG-27710380')).data.regions[0];
  assert.equal(area.name,'구지면'); assert.equal(area.residents.total,null); assert.equal(area.residents.groups,null);
  assert.equal(area.coverage.residents,false); assert.equal(area.residents.missingReason,'administrative_code_not_in_resident_source');
  const status=(await get('/api/market/status')).data;
  assert.equal(status.coverage.KR.administrativeResidents.byLevel.administrative_dong.matched,3556);
  assert.equal(status.coverage.KR.administrativeResidents.missingRegions,1);
  assert.equal(status.coverage.KR.foodStoreRecords,840255);
  assert.equal(status.coverage.KR.physicalOutletDeduplication,false);
});
await check('existing Japan core population and coordinate provenance survive expansion', async () => {
  const { data } = await get('/api/regions?country=JP&q=햐쿠닌초');
  const area = data.regions.find(a => a.id === 'hyakunin1');
  assert.equal(area.residents.total, 3531); assert.equal(area.workers.total, 5023); assert.equal(area.flow, null);
  assert.equal(area.legacyCoordinates.lat, 35.6996); assert.equal(area.coordinateMetadata.coordinate_source, 'Geolonia japanese-addresses-v2');
  assert.equal(data.provinces.length, 47);
});
await check('Japan nationwide search supports Korean alias and unconnected null metrics', async () => {
  const { data } = await get('/api/regions?country=JP&q=오사카&limit=20');
  assert(data.regions.length); assert(data.regions.every(a => a.residents.total === null));
  assert(data.regions.every(a => a.workers.total === null && a.coverage.shops === false));
});
await check('Seongsu 500m cafe search returns actual source records with unknown customer age', async () => {
  const { data } = await get('/api/shops?country=KR&lat=37.5445&lng=127.0557&radius=500&category=cafe&limit=10');
  assert(data.total > 0); assert(data.shops.every(s => s.categoryCode === 'I21201'));
  assert.equal(data.countUnit,'source_food_business_record'); assert.equal(data.physicalOutletDeduplication,false);
  for (const s of data.shops) { assert(s.distanceMeters <= 500); assert.equal(s.customerAge, null); assert.equal(s.currentOperation, 'unverified'); assert.equal(s.sourcePeriod, '2026-06-30'); }
});
await check('radius query crosses district boundaries and paginates without duplicate IDs', async () => {
  const base = '/api/shops?country=KR&lat=37.5686&lng=126.9828&radius=500&limit=5';
  const a = (await get(base)).data, b = (await get(base + '&offset=5')).data;
  assert(a.coverage.checkedChunks.includes('11110')); assert(a.coverage.checkedChunks.includes('11140'));
  assert.equal(a.total, b.total); assert(a.pagination.hasMore); assert.equal(a.pagination.nextOffset, 5);
  assert(!a.shops.some(s => b.shops.some(t => t.id === s.id)));
  assert(Math.abs(haversineMetres(37.5,127,37.5,127)) < 0.01);
});
await check('representative non-Seoul test points resolve nationwide stores', async () => {
  for (const [lat,lng] of [[35.1577,129.0594],[35.8693,128.5961],[35.1498,126.9163],[36.3507,127.3788],[33.489,126.49]]) {
    const {data}=await get(`/api/shops?lat=${lat}&lng=${lng}&limit=3`); assert(data.total>0); assert(data.shops.every(s=>s.distanceMeters<=500));
  }
});
await check('missing competition row remains null; unavailable geography returns HTTP 404', async () => {
  const {data}=await get('/api/market/competition?areaId=3110131');
  assert.equal(data.areas.length,1); assert.equal(data.areas[0].industries.find(x=>x.key==='chicken').reported_store_count,null);
  assert.equal((await get('/api/market/competition?areaId=KR-ADONG-26110510')).response.status,404);
});
await check('JP merchant lookup delegates to credential-backed provider route', async () => {
  assert.equal((await get('/api/shops?country=JP&lat=35.7&lng=139.7')).response,null);
});
await check('active R2 release never mixes missing assets with packaged snapshot', async () => {
  let assetCalled = false;
  const activeEnv = { DB: { prepare() { return { bind() { return { async first() { return { payload: JSON.stringify({version:'test-release'}) }; } }; } }; } }, BUCKET: { async get(){return null;} }, ASSETS: { async fetch(){assetCalled=true;return new Response('{}');} } };
  await assert.rejects(readMarketJson('manifest.json',activeEnv)); assert.equal(assetCalled,false);
  const response=await marketApi(new Request('https://atlas.test/api/market/status'),activeEnv); assert.equal(response.status,503);
});
await check('unknown route delegates and unsupported methods return HTTP 405', async () => {
  assert.equal((await get('/api/unrelated')).response,null);
  const response=await marketApi(new Request('https://atlas.test/api/regions',{method:'POST'}),env); assert.equal(response.status,405);
});
await check('bounded chunk search explicitly reports partial totals', async () => {
  let chunksRead = 0;
  const index = { sourcePeriod:'2026-06-30', sourceUrl:'https://www.data.go.kr/data/15083033/fileData.do', categories:[], districts:Array.from({length:9},(_,i)=>({code:String(i),name:'fixture',provinceName:'fixture',bbox:[126.9,37.4,127.1,37.6],centroid:{lat:37.5,lon:127},chunk:`districts/${i}.json`})) };
  const boundedEnv = { ASSETS:{async fetch(request){
    const path=new URL(request.url).pathname;
    if(path.endsWith('search-index.json')) return Response.json(index);
    chunksRead++;
    return Response.json({columns:['id','name','branchName','categoryCode','categoryName','lat','lon','address','lotAddress','administrativeDongCode','administrativeDongName','legalDongCode','legalDongName','floor'],stores:[[path,'fixture',null,'I21201','카페',37.5,127,'fixture',null,null,null,null,null,null]]});
  }} };
  const response=await marketApi(new Request('https://atlas.test/api/shops?lat=37.5&lng=127'),boundedEnv);
  const data=await response.json();
  assert.equal(chunksRead,8); assert.equal(data.total,8); assert.equal(data.totalIsExact,false); assert.equal(data.coverage.truncatedByChunkLimit,true); assert.equal(data.coverage.candidateChunkCount,9);
});
await check('unresolved Tokyo representative points remain null', async () => {
  const index=JSON.parse(await readFile(new URL('market/regions/JP.json',assetRoot),'utf8'));
  const unresolved=index.regions.find(a=>a.lat===null&&a.province==='東京都');
  assert(unresolved);
  const {data}=await get(`/api/regions?country=JP&province=130001&limit=50&q=${encodeURIComponent(unresolved.name)}`);
  const area=data.regions.find(a=>a.id===unresolved.id);
  assert(area); assert.equal(area.lat,null); assert.equal(area.lng,null); assert.equal(area.coordinateMetadata.match_method,'unresolved');
});
await check('asset binding retains the accepted request origin without forwarding query or credentials', async () => {
  let called = false;
  const originEnv = { ASSETS: { async fetch(assetRequest) {
    called = true;
    assert.equal(assetRequest.url, 'https://accepted.example:444/market/manifest.json');
    assert.equal(assetRequest.headers.get('authorization'), null);
    assert.equal(assetRequest.headers.get('cookie'), null);
    return Response.json({version:'fixture',coverage:{},regions:{},limitations:[]});
  } } };
  const request = new Request('https://accepted.example:444/api/market/status?privateQuery=SYNTHETIC', {headers:{authorization:'Bearer SYNTHETIC',cookie:'session=SYNTHETIC'}});
  const response = await marketApi(request, originEnv);
  assert.equal(response.status,200); assert(called);
});
await check('production RPC asset reads without a request retain the documented fallback origin', async () => {
  const rpcEnv = {ASSETS:{async fetch(request){assert.equal(request.url,'https://assets.local/market/manifest.json');return Response.json({version:'fixture'});}}};
  assert.equal((await readMarketJson('manifest.json',rpcEnv)).version,'fixture');
});
await check('exact region ID lookup restores selections independently of search filters', async () => {
  const {data}=await get('/api/regions?country=KR&id=KR-ADONG-26230550&q=ignored&province=ignored');
  assert.equal(data.total,1); assert.equal(data.regions[0].id,'KR-ADONG-26230550');
  assert.equal((await get('/api/regions?country=JP&id=KR-ADONG-26230550')).data.total,0);
  assert.equal((await get('/api/regions?country=KR&id=nonexistent-region')).data.total,0);
  assert.equal((await get('/api/regions?country=KR&id=../manifest')).response.status,400);
  assert.equal((await get('/api/regions?country=KR&id=')).response.status,400);
});
console.log(JSON.stringify({passed:checks.length,checks}));
