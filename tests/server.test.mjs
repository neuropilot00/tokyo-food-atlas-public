import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {handleApi,handleMcp,encryptCredential,decryptCredential,cleanupProviderCache} from '../lib/atlas-server.mjs';

class D1{
 constructor(){this.db=new DatabaseSync(':memory:');for(const f of readdirSync(new URL('../drizzle/',import.meta.url)).filter(x=>x.endsWith('.sql')).sort())this.db.exec(readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'));}
 prepare(sql){const db=this.db;let values=[];const out={bind(...v){values=v;return out;},async first(){return db.prepare(sql).get(...values)||null;},async all(){return {results:db.prepare(sql).all(...values)};},async run(){const r=db.prepare(sql).run(...values);return {success:true,meta:{changes:Number(r.changes)}};}};return out;}
 async batch(statements){this.db.exec('BEGIN');try{const out=[];for(const s of statements)out.push(await s.run());this.db.exec('COMMIT');return out;}catch(e){this.db.exec('ROLLBACK');throw e;}}
}
class R2{
 constructor(){this.data=new Map();}
 async put(k,v,o){if(o?.onlyIf?.etagDoesNotMatch==='*'&&this.data.has(k))return null;const entry={text:async()=>v,json:async()=>JSON.parse(v),customMetadata:o?.customMetadata};this.data.set(k,entry);return entry;}
 async get(k){return this.data.get(k)||null;}
 async head(k){return this.data.get(k)||null;}
}
const makeEnv=()=>({DB:new D1(),BUCKET:new R2(),ATLAS_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64'),ATLAS_IMPORT_SECRET:'unit-test-import-secret',ATLAS_OWNER_EMAIL:'owner@example.invalid',ASSETS:{fetch:async()=>new Response(JSON.stringify({version:'test',files:[]}),{headers:{'content-type':'application/json'}})}});
function request(path,{method='GET',user='alice',email='owner@example.invalid',body,headers={}}={}){return new Request('https://atlas.example'+path,{method,headers:{...(user?{'oai-authenticated-user-id':user,'oai-authenticated-user-email':email,'X-Atlas-User-Id':user}:{}),...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});}
async function call(env,path,opts){const r=await handleApi(request(path,opts),env);return {status:r.status,data:await r.json()};}

test('unauthenticated state is rejected, visitor metadata stays public',async()=>{
 const env=makeEnv();assert.equal((await call(env,'/api/state',{user:null})).status,401);
 assert.equal((await call(env,'/api/me',{user:null})).data.authenticated,false);
 assert.equal((await call(env,'/api/me')).data.admin,true);
 assert.equal((await call(env,'/api/me',{email:'else@example.invalid'})).data.admin,false);
});
test('records are isolated by trusted identity; account guard cannot impersonate',async()=>{
 const env=makeEnv();let r=await call(env,'/api/state/atlas2-saved',{method:'PUT',body:{value:[{name:'owner private plan'}],expectedVersion:0}});assert.equal(r.status,201);assert.equal(r.data.version,1);
 r=await call(env,'/api/state',{user:'bob',email:'bob@example.invalid'});assert.equal(r.data.items.length,0);
 r=await call(env,'/api/state/atlas2-saved',{method:'PUT',user:'bob',body:{value:[],expectedVersion:1}});assert.equal(r.status,409);assert.equal(r.data.current,null);
 r=await call(env,'/api/state',{headers:{'X-Atlas-User-Id':'bob'}});assert.equal(r.status,409);assert.equal(r.data.error,'ACCOUNT_CHANGED');
 assert.equal((await call(env,'/api/state')).data.items[0].value[0].name,'owner private plan');
});
test('CAS refuses stale overwrites and tombstones protect deletes across devices',async()=>{
 const env=makeEnv();const path='/api/state/atlas2-note';
 await call(env,path,{method:'PUT',body:{value:'v1',expectedVersion:0}});
 const r=await Promise.all(['v2a','v2b'].map(value=>call(env,path,{method:'PUT',body:{value,expectedVersion:1}})));
 assert.deepEqual(r.map(x=>x.status).sort(),[200,409]);
 let del=await call(env,path,{method:'DELETE',body:{expectedVersion:2}});assert.equal(del.data.version,3);assert.equal(del.data.deleted,true);
 assert.equal((await call(env,path,{method:'PUT',body:{value:'stale resurrection',expectedVersion:2}})).status,409);
 del=await call(env,'/api/state');assert.equal(del.data.items[0].deleted,true);
});
test('cross-origin writes and excessive item size are rejected',async()=>{
 const env=makeEnv();assert.equal((await call(env,'/api/state/atlas2-x',{method:'PUT',body:{value:1,expectedVersion:0},headers:{Origin:'https://evil.invalid'}})).status,403);
 assert.equal((await call(env,'/api/state/atlas2-x',{method:'PUT',body:{value:'x'.repeat(256*1024),expectedVersion:0}})).status,413);
 assert.equal((await call(env,'/api/state/atlas2-x',{method:'PUT',body:{value:1,expectedVersion:-1}})).status,400);
 assert.equal((await call(env,'/api/state')).data.items.length,0);
});
test('credential ciphertext is per owner/provider, settings never return plaintext',async()=>{
 const env=makeEnv(),secret='TEST_PROVIDER_KEY_never_return';
 const c=await encryptCredential(secret,'alice','sbiz_stores',env);assert.ok(!c.ciphertext.includes(secret));
 assert.equal(await decryptCredential({...c,owner:'alice',provider:'sbiz_stores'},env),secret);
 await assert.rejects(()=>decryptCredential({...c,owner:'bob',provider:'sbiz_stores'},env));
 let r=await call(env,'/api/connectors/sbiz_stores',{method:'PUT',body:{key:secret}});assert.equal(r.status,200);assert.equal(r.data.status,'unverified');
 r=await call(env,'/api/connectors');assert.ok(!JSON.stringify(r.data).includes(secret));assert.equal(r.data.providers.find(x=>x.id==='sbiz_stores').status,'ready_to_verify');
 r=await call(env,'/api/connectors',{user:'bob'});assert.equal(r.data.providers.find(x=>x.id==='sbiz_stores').credentialConfigured,false);
 const raw=env.DB.db.prepare('SELECT * FROM connector_credentials').get();assert.ok(!JSON.stringify(raw).includes(secret));
 assert.equal((await call(env,'/api/connectors/property_feed',{method:'PUT',body:{key:secret}})).status,409);
});
test('import staging is privileged, immutable and activates only complete releases',async()=>{
 const env=makeEnv(),opts={user:null,headers:{'X-Atlas-Import-Secret':env.ATLAS_IMPORT_SECRET}};
 assert.equal((await call(env,'/api/ops/import/start',{method:'POST',user:null,body:{version:'release-test',expectedCount:2}})).status,403);
 await call(env,'/api/ops/import/start',{...opts,method:'POST',body:{version:'release-test',expectedCount:2}});
 assert.equal((await call(env,'/api/ops/import/commit',{...opts,method:'POST',body:{version:'release-test'}})).status,409);
 const content={version:'test',items:[]},raw=JSON.stringify(content);
 const manifest={version:'test',files:[{path:'kr-food/region-index.json',sha256:createHash('sha256').update(raw).digest('hex'),bytes:Buffer.byteLength(raw)}]};
 for(const [path,body] of [['manifest.json',manifest],['kr-food/region-index.json',content]]){
  const r=await call(env,'/api/ops/import/file?version=release-test&path='+path,{...opts,method:'PUT',body});assert.equal(r.status,200);
 }
 assert.equal((await call(env,'/api/ops/import/file?version=release-test&path=manifest.json',{...opts,method:'PUT',body:{different:true}})).status,409);
 const r=await call(env,'/api/ops/import/commit',{...opts,method:'POST',body:{version:'release-test'}});assert.equal(r.data.status,'active');
 const active=JSON.parse(env.DB.db.prepare("SELECT payload FROM market_cache WHERE key='active-market-version'").get().payload);assert.equal(active.version,'release-test');
 assert.equal((await call(env,'/api/ops/import/file?version=release-test&path=../escape.json',{...opts,method:'PUT',body:{x:1}})).status,400);
});
test('MCP discovery is stateless, data tools require caller identity',async()=>{
 const env=makeEnv();let r=await handleMcp(request('/mcp',{method:'POST',user:null,body:{jsonrpc:'2.0',id:1,method:'server/discover'}}),env);let d=await r.json();assert.ok(d.result.supportedVersions.includes('2026-07-28'));
 r=await handleMcp(request('/mcp',{method:'POST',user:null,body:{jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'atlas_export_my_records'}}}),env);assert.equal(r.status,401);
 r=await handleMcp(request('/mcp',{method:'POST',user:'bob',email:'bob@example.invalid',body:{jsonrpc:'2.0',id:3,method:'tools/call',params:{name:'atlas_refresh_sources'}}}),env);d=await r.json();assert.equal(d.result.isError,true);assert.ok(d.result.content[0].text.includes('OWNER_REQUIRED'));
});
test('saved false approval overrides a true native flag before any upstream request',async()=>{
 const env={...makeEnv(),SEOUL_API_KEY:'native-test-key',SEOUL_HTTP_KEY_APPROVED:'true'};
 await call(env,'/api/connectors/seoul_population',{method:'PUT',body:{key:'owner-test-key',options:{SEOUL_HTTP_KEY_APPROVED:false}}});
 const r=await call(env,'/api/connectors/seoul_population/test',{method:'POST',body:{params:{area:'POI009'}}});
 assert.equal(r.data.status,'blocked');assert.equal(r.data.reasonCode,'UPSTREAM_HTTP_REVIEW_REQUIRED');
 assert.equal((await call(env,'/api/connectors')).data.providers.find(x=>x.id==='seoul_population').status,'blocked');
});
test('GET provider coordinates are numeric and Japanese pagination advances 30 records',async()=>{
 const env={...makeEnv(),HOTPEPPER_API_KEY:'synthetic-fixture-key',HOTPEPPER_USE_APPROVED:'true'};
 const original=globalThis.fetch;let calledUrl;
 globalThis.fetch=async url=>{calledUrl=new URL(url);return new Response(JSON.stringify({results:{results_available:90,results_returned:30,results_start:31,shop:Array.from({length:30},(_,i)=>({id:'fixture-'+i,name:'Synthetic restaurant',lat:35.7,lng:139.7,urls:{pc:'https://example.invalid/fixture'},genre:{name:'fixture'}}))}}));};
 try{
  const r=await call(env,'/api/shops?country=JP&lat=35.7&lng=139.7&radius=500&offset=30');
  assert.equal(r.data.status,'ok');assert.equal(calledUrl.searchParams.get('start'),'31');assert.equal(r.data.pagination.nextOffset,60);assert.equal(r.data.pagination.hasMore,true);
  assert.equal((await call(env,'/api/provider/places?provider=hotpepper_places&lat=oops&lng=139.7')).status,400);
  assert.equal((await call(env,'/api/shops?country=JP&lat=35.7&lng=139.7&offset=1')).status,400);
 }finally{globalThis.fetch=original;}
});

test('deleting at the active-item cap frees a slot without losing the deletion version',async()=>{
 const env=makeEnv(),db=env.DB.db,now=Date.now();
 const insert=db.prepare('INSERT INTO user_values (owner,key,value_json,version,updated_at,deleted,bytes) VALUES (?,?,?,1,?,0,1)');
 db.exec('BEGIN');for(let i=0;i<1000;i++)insert.run('alice','atlas2-active-'+i,'0',now+i);db.exec('COMMIT');
 let r=await call(env,'/api/state/atlas2-new',{method:'PUT',body:{value:1,expectedVersion:0}});
 assert.equal(r.status,413);assert.equal(r.data.reason,'ACTIVE_ITEM_LIMIT');assert.equal(r.data.limits.activeItems,1000);
 r=await call(env,'/api/state/atlas2-active-0',{method:'DELETE',body:{expectedVersion:1}});
 assert.equal(r.status,200);assert.equal(r.data.deleted,true);assert.equal(r.data.version,2);
 r=await call(env,'/api/state/atlas2-new',{method:'PUT',body:{value:1,expectedVersion:0}});
 assert.equal(r.status,201);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_values WHERE owner=? AND deleted=0').get('alice').n,1000);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_values WHERE owner=?').get('alice').n,1001);
 r=await call(env,'/api/state/atlas2-active-0',{method:'PUT',body:{value:'stale offline edit',expectedVersion:1}});
 assert.equal(r.status,409);assert.equal(r.data.current.deleted,true);assert.equal(r.data.current.version,2);
 r=await call(env,'/api/state/atlas2-active-0',{method:'PUT',body:{value:'explicit restore',expectedVersion:2}});
 assert.equal(r.status,413);assert.equal(r.data.reason,'ACTIVE_ITEM_LIMIT','Restoring a tombstone must count as an active item');
 assert.equal((await call(env,'/api/state/atlas2-active-2',{method:'PUT',body:{value:'existing edit',expectedVersion:1}})).status,200,'Editing an existing active key consumes no extra slot');
 await call(env,'/api/state/atlas2-active-1',{method:'DELETE',body:{expectedVersion:1}});
 r=await call(env,'/api/state/atlas2-active-0',{method:'PUT',body:{value:'explicit restore',expectedVersion:2}});
 assert.equal(r.status,200);assert.equal(r.data.version,3);assert.equal(r.data.deleted,false);
 const full=await call(env,'/api/state');
 assert.equal(full.data.items.length,1001);
 assert.ok(full.data.items.some(x=>x.key==='atlas2-active-1'&&x.deleted&&x.version===2));
});

test('all 5,000 keys including old tombstones are returned; the total-key cap never prunes them',async()=>{
 const env=makeEnv(),db=env.DB.db,now=Date.now();
 const insert=db.prepare('INSERT INTO user_values (owner,key,value_json,version,updated_at,deleted,bytes) VALUES (?,?,?,?,?,?,?)');
 db.exec('BEGIN');
 for(let i=0;i<4999;i++)insert.run('alice','atlas2-deleted-'+i,null,7,now+i,1,0);
 insert.run('alice','atlas2-still-active','0',1,now+5000,0,1);db.exec('COMMIT');
 let r=await call(env,'/api/state/atlas2-one-too-many',{method:'PUT',body:{value:1,expectedVersion:0}});
 assert.equal(r.status,413);assert.equal(r.data.reason,'TOTAL_KEY_LIMIT');assert.equal(r.data.usage.totalKeys,5000);
 assert.match(r.data.message,/일반 삭제로 이 한도는 줄지/);
 r=await call(env,'/api/state/atlas2-still-active',{method:'DELETE',body:{expectedVersion:1}});
 assert.equal(r.status,200,'Deletion of an existing key remains possible at the total cap');
 const full=await call(env,'/api/state');
 assert.equal(full.data.items.length,5000,'The former 1,200-row cutoff must not hide deletion history');
 assert.equal(full.data.items.filter(x=>x.deleted).length,5000);
 assert.ok(full.data.items.some(x=>x.key==='atlas2-deleted-4998'&&x.version===7));
 r=await call(env,'/api/state/atlas2-deleted-4998',{method:'PUT',body:{value:'stale beyond old cutoff',expectedVersion:6}});
 assert.equal(r.status,409);assert.equal(r.data.current.deleted,true);
 r=await call(env,'/api/state/atlas2-deleted-4998',{method:'PUT',body:{value:'explicit existing-key reuse',expectedVersion:7}});
 assert.equal(r.status,200);assert.equal(r.data.version,8);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_values WHERE owner=?').get('alice').n,5000);
 assert.equal((await call(env,'/api/state',{user:'bob',email:'bob@example.invalid'})).data.items.length,0);
 assert.equal((await call(env,'/api/state/atlas2-new',{method:'PUT',user:'bob',email:'bob@example.invalid',body:{value:'separate quota',expectedVersion:0}})).status,201);
});

test('cache cleanup is bounded, daily coordinated, and preserves pointer plus the 7-day fallback window',async()=>{
 const env=makeEnv(),db=env.DB.db,now=Date.now(),day=86400000;
 const put=db.prepare('INSERT INTO market_cache (key,provider,payload,checked_at,expires_at) VALUES (?,?,?,?,?)');
 db.exec('BEGIN');
 for(let i=0;i<550;i++)put.run('provider:seoul_population:old-'+i,'seoul_population','{}',now-9*day,now-8*day);
 put.run('provider:seoul_population:within-fallback','seoul_population','{}',now-3*day,now-2*day);
 put.run('provider:seoul_population:boundary','seoul_population','{}',now-8*day,now-7*day);
 put.run('provider:seoul_population:fresh','seoul_population','{}',now,now+300000);
 // Deliberately old expiry: even malformed pointer expiry must not permit GC.
 put.run('active-market-version','atlas_import','{"version":"must-remain"}',now-30*day,now-20*day);
 put.run('non-provider-cache','atlas_import','{}',now-30*day,now-20*day);db.exec('COMMIT');
 const concurrent=await Promise.all([cleanupProviderCache(env,{now}),cleanupProviderCache(env,{now})]);
 assert.deepEqual(concurrent.map(x=>x.deleted).sort((a,b)=>a-b),[0,500]);
 assert.equal(concurrent.filter(x=>x.ran).length,1,'Different callers share a persistent daily claim');
 assert.equal(db.prepare("SELECT COUNT(*) AS n FROM market_cache WHERE key LIKE 'provider:seoul_population:old-%'").get().n,50);
 for(const key of ['active-market-version','non-provider-cache','provider:seoul_population:within-fallback','provider:seoul_population:boundary','provider:seoul_population:fresh'])assert.ok(db.prepare('SELECT key FROM market_cache WHERE key=?').get(key),key+' must remain');
 const forced=await cleanupProviderCache(env,{now,force:true});
 assert.equal(forced.deleted,50);assert.equal(forced.limit,500);
 assert.equal((await cleanupProviderCache(env,{now})).reason,'ALREADY_RAN_TODAY');
 const nextDay=await cleanupProviderCache(env,{now:now+day});
 assert.equal(nextDay.ran,true);assert.equal(nextDay.deleted,1,'The previous boundary expires only after its full seven-day window');
 assert.equal(JSON.parse(db.prepare('SELECT payload FROM market_cache WHERE key=?').get('active-market-version').payload).version,'must-remain');
});

test('provider failure serves only retained stale cache, even when an older row awaits bounded cleanup',async()=>{
 const env=makeEnv(),db=env.DB.db,now=Date.now(),day=86400000;
 await cleanupProviderCache(env,{now});
 const key='provider:seoul_population:'+createHash('sha256').update('alice:public:'+JSON.stringify({area:'POI009'})).digest('hex');
 const cached={provider:'seoul_population',status:'ok',live:true,observedAt:new Date(now-6*day).toISOString(),fetchedAt:new Date(now-6*day).toISOString(),data:{areaCode:'POI009'},warnings:[]};
 db.prepare('INSERT INTO market_cache (key,provider,payload,checked_at,expires_at) VALUES (?,?,?,?,?)').run(key,'seoul_population',JSON.stringify(cached),now-6*day,now-6*day);
 const original=globalThis.fetch;globalThis.fetch=async()=>{throw new Error('Synthetic provider outage');};
 try{
  let r=await call(env,'/api/live?area=POI009');
  assert.equal(r.data.status,'stale');assert.equal(r.data.live,false);assert.equal(r.data.cache.expired,true);
  db.prepare('UPDATE market_cache SET expires_at=? WHERE key=?').run(now-8*day,key);
  r=await call(env,'/api/live?area=POI009');
  assert.equal(r.data.status,'error');assert.equal(r.data.reasonCode,'UPSTREAM_NETWORK_ERROR');assert.equal(r.data.live,false);
  assert.equal(r.data.data,null,'An old row must not escape the fallback age limit just because GC is bounded');
  assert.ok(db.prepare('SELECT key FROM market_cache WHERE key=?').get(key),'The replay deliberately leaves the old row awaiting the next cleanup batch');
 }finally{globalThis.fetch=original;}
});

test('HTTP and MCP status preserve the incoming asset origin and report precise storage limits',async()=>{
 for(const mcp of [false,true]){
  const env=makeEnv();let origin;
  env.ASSETS.fetch=async assetRequest=>{origin=new URL(assetRequest.url).origin;return origin==='https://atlas.example'?new Response(JSON.stringify({origin,version:'origin-ok'})):new Response('Host rejected',{status:403});};
  const response=mcp?await handleMcp(request('/mcp',{method:'POST',body:{jsonrpc:'2.0',id:10,method:'tools/call',params:{name:'atlas_status'}}}),env):await handleApi(request('/api/status'),env);
  const body=await response.json(),data=mcp?body.result.structuredContent:body;
  assert.equal(origin,'https://atlas.example');assert.equal(data.market.version,'origin-ok');
  assert.equal(data.storage.activeItemLimit,1000);assert.equal(data.storage.totalKeyLimitIncludingDeleted,5000);
  assert.equal(data.storage.tombstonesRetained,true);assert.equal(data.storage.providerCacheStaleRetentionDays,7);
 }
});
