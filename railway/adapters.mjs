import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,writeFileSync,openSync,closeSync,fsyncSync,linkSync,unlinkSync} from 'node:fs';
import {join,resolve,sep} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
export function database(path,migration){
 const sql=new DatabaseSync(path);sql.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;');
 sql.exec('CREATE TABLE IF NOT EXISTS atlas_schema(version INTEGER PRIMARY KEY)');
 if(!sql.prepare('SELECT version FROM atlas_schema WHERE version=1').get()){
  sql.exec('BEGIN IMMEDIATE');try{sql.exec(readFileSync(migration,'utf8'));sql.exec('INSERT INTO atlas_schema VALUES(1);COMMIT');}catch(e){sql.exec('ROLLBACK');throw e;}
 }
 function statement(query,args=[]){const run=()=>{const r=sql.prepare(query).run(...args);return {success:true,meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};};return {bind:(...values)=>statement(query,values),first:async()=>sql.prepare(query).get(...args)??null,all:async()=>({results:sql.prepare(query).all(...args),success:true}),run:async()=>run(),_run:run};}
 return {prepare:statement,batch:async statements=>{sql.exec('BEGIN IMMEDIATE');try{const out=statements.map(s=>s._run());sql.exec('COMMIT');return out;}catch(e){sql.exec('ROLLBACK');throw e;}},close:()=>sql.close()};
}
export function bucket(root){
 mkdirSync(root,{recursive:true,mode:0o700});
 const path=key=>join(root,createHash('sha256').update(key).digest('hex')+'.json');
 function get(key){try{const r=JSON.parse(readFileSync(path(key),'utf8'));if(r.key!==key)throw Error('Object key mismatch');return {size:Buffer.byteLength(r.body),customMetadata:r.customMetadata,text:async()=>r.body};}catch(e){if(e.code==='ENOENT')return null;throw e;}}
 return {get:async key=>get(key),head:async key=>get(key),put:async(key,body,options={})=>{
  // The application only writes immutable release objects. Refuse overwrites.
  if(options.onlyIf?.etagDoesNotMatch!=='*')throw Error('Immutable object write required');
  const temp=join(root,'.pending-'+randomUUID());let fd;try{fd=openSync(temp,'wx',0o600);writeFileSync(fd,JSON.stringify({key,body:String(body),customMetadata:options.customMetadata||{}}));fsyncSync(fd);closeSync(fd);fd=undefined;linkSync(temp,path(key));const directory=openSync(root,'r');try{fsyncSync(directory);}finally{closeSync(directory);}return {key};}catch(e){if(e.code==='EEXIST')return null;throw e;}finally{if(fd!==undefined)closeSync(fd);try{unlinkSync(temp);}catch(e){if(e.code!=='ENOENT')throw e;}}
 }};
}
export function assets(root){const base=resolve(root);return {fetch:async request=>{let path;try{path=decodeURIComponent(new URL(request.url).pathname);}catch{return new Response('Invalid path',{status:400});}const target=resolve(base,'.'+path);if(!target.startsWith(base+sep)||path.split('/').some(x=>x.startsWith('.')))return new Response('Not found',{status:404});try{return new Response(readFileSync(target));}catch{return new Response('Not found',{status:404});}}};}
