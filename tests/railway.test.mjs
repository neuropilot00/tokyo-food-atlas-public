import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer,settings} from '../railway/server.mjs';
import {bucket,database} from '../railway/adapters.mjs';
const dir=mkdtempSync(join(tmpdir(),'atlas-railway-test-'));
const config={ATLAS_OWNER_EMAIL:'test@example.invalid',ATLAS_OWNER_PASSWORD:'UNIT_TEST_ONLY_PASSWORD_123456',ATLAS_OWNER_ID:'test-owner',ATLAS_ENCRYPTION_KEY:Buffer.alloc(32,7).toString('base64'),ATLAS_PUBLIC_ORIGIN:'http://127.0.0.1:3000',ATLAS_LOCAL_TEST:'1',ATLAS_DATA_DIR:dir};
const auth='Basic '+Buffer.from(config.ATLAS_OWNER_EMAIL+':'+config.ATLAS_OWNER_PASSWORD).toString('base64');
let server;
async function start(){server=createServer(config);await new Promise(r=>server.listen(0,'127.0.0.1',r));return 'http://127.0.0.1:'+server.address().port;}
async function stop(){await new Promise(r=>server.close(r));}
try{
 for(const key of ['ATLAS_OWNER_PASSWORD','ATLAS_OWNER_ID','ATLAS_OWNER_EMAIL','ATLAS_ENCRYPTION_KEY','ATLAS_DATA_DIR','ATLAS_PUBLIC_ORIGIN'])assert.throws(()=>settings({...config,[key]:''}));
 assert.throws(()=>settings({...config,ATLAS_LOCAL_TEST:'0'}));
 let base=await start();const call=(path,options={})=>fetch(base+path,{...options,headers:{Authorization:auth,...options.headers}});
 assert.equal((await fetch(base+'/healthz')).status,200);
 for(const path of ['/','/app.js','/api/me','/api/state'])assert.equal((await fetch(base+path,{headers:{'oai-authenticated-user-id':'victim'}})).status,401);
 assert.equal((await call('/api/me',{headers:{Authorization:'Basic '+Buffer.from('bad:bad').toString('base64')}})).status,401);
 const me=await (await call('/api/me',{headers:{'oai-authenticated-user-id':'victim','oai-authenticated-user-email':'victim@example.invalid'}})).json();assert.equal(me.user.id,'railway:test-owner');assert.equal(me.admin,true);
 assert.equal((await call('/api/state',{headers:{'X-Atlas-User-Id':'victim'}})).status,409);
 assert.equal((await call('/api/state',{headers:{Origin:'https://evil.invalid'}})).status,403);
 let r=await call('/api/state/atlas2-plan',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({value:{note:'persist me'},expectedVersion:0})});assert.equal(r.status,201);
 assert.equal((await call('/')).status,200);assert.match(await (await call('/')).text(),/viewport/);assert.equal((await call('/app.js')).status,200);assert.equal((await call('/%2eenv')).status,404);
 const status=await (await call('/api/status')).json();assert.equal(status.storage.database,true);assert.equal(status.storage.objects,true);
 await stop();base=await start();assert.equal((await (await call('/api/state')).json()).items[0].value.note,'persist me');await stop();server=null;
 const objects=bucket(join(dir,'object-test'));assert.ok(await objects.put('releases/test/a.json','{}',{onlyIf:{etagDoesNotMatch:'*'},customMetadata:{sha256:'a'}}));assert.equal(await objects.put('releases/test/a.json','other',{onlyIf:{etagDoesNotMatch:'*'}}),null);assert.equal(await (await objects.get('releases/test/a.json')).text(),'{}');assert.equal((await objects.head('releases/test/a.json')).customMetadata.sha256,'a');assert.equal(await objects.get('missing'),null);
 const db=database(join(dir,'batch.sqlite'),new URL('../drizzle/0000_chief_leader.sql',import.meta.url));await assert.rejects(db.batch([db.prepare('INSERT INTO atlas_schema VALUES(2)'),db.prepare('INSERT INTO no_table VALUES(1)')]));assert.equal(await db.prepare('SELECT version FROM atlas_schema WHERE version=2').first(),null);db.close();
 console.log('PASS Railway: fail-closed config, owner authentication, spoof rejection, cross-origin rejection, UI/assets, state persistence after restart, immutable objects, transactional rollback');
}finally{if(server?.listening)await stop();rmSync(dir,{recursive:true,force:true});}
