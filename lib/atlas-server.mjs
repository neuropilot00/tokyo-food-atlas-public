import {CONNECTORS, connectionStatus, runConnector, freshness} from './provider-connectors.mjs';
import {marketApi, readMarketJson} from './market-data.mjs';

export const APP_VERSION='0.2.0-beta';
const enc=new TextEncoder();
const MAX_ITEM=256*1024,MAX_ACCOUNT=5*1024*1024,MAX_ACTIVE_ITEMS=1000,MAX_TOTAL_KEYS=5000;
const DAY_MS=86400000,CACHE_STALE_RETENTION_MS=7*DAY_MS,CACHE_CLEANUP_BATCH=500;
const stateLimits={activeItems:MAX_ACTIVE_ITEMS,totalKeysIncludingDeleted:MAX_TOTAL_KEYS,valueBytes:MAX_ACCOUNT,tombstonesRetained:true};
const OPTIONS={seoul_population:['SEOUL_HTTP_KEY_APPROVED'],kakao_places:['KAKAO_USE_APPROVED'],hotpepper_places:['HOTPEPPER_USE_APPROVED'],sbiz_stores:[]};
const json=(value,status=200,extra={})=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin',...extra}});
class ApiError extends Error{constructor(status,code,message,extra={}){super(message);this.status=status;this.code=code;this.extra=extra;}}
const fail=(status,code,message,extra)=>{throw new ApiError(status,code,message,extra);};
const parse=(s,fallback=null)=>{try{return JSON.parse(s);}catch{return fallback;}};
const changed=r=>Number(r?.meta?.changes??r?.changes??0)>0;
const id=()=>crypto.randomUUID();
const iso=n=>n?new Date(n).toISOString():null;
const byteLength=s=>enc.encode(s).length;
const safeKey=k=>/^atlas2-[A-Za-z0-9_-]{1,110}$/.test(k);
export function providerQuery(params){
  const values=Object.fromEntries(params);
  for(const name of ['lat','lng','radius','page','offset','limit'])if(params.has(name)){
    const raw=params.get(name);const number=raw.trim()?Number(raw):NaN;
    if(!Number.isFinite(number)||(['radius','page','offset','limit'].includes(name)&&!Number.isInteger(number)))fail(400,'INVALID_INPUT','좌표·반경·페이지 입력을 확인해 주세요.');
    values[name]=number;
  }
  if(values.q?.length>120||/[\u0000-\u001f]/.test(values.q||''))fail(400,'INVALID_INPUT','검색어를 120자 이내로 입력해 주세요.');
  return values;
}
const dbRequired=env=>{if(!env.DB)fail(503,'STORAGE_UNAVAILABLE','서버 저장소가 준비되지 않았습니다. 기기 기록은 보존됩니다.');return env.DB;};

export function identity(request,env){
  const userId=request.headers.get('oai-authenticated-user-id');
  if(!userId||userId.length>240)return null;
  const email=request.headers.get('oai-authenticated-user-email')||'';
  return {id:userId,displayName:'내 계정',admin:Boolean(env.ATLAS_OWNER_EMAIL&&email.toLowerCase()===env.ATLAS_OWNER_EMAIL.toLowerCase())};
}
function requireUser(request,env){const u=identity(request,env);if(!u)fail(401,'SIGN_IN_REQUIRED','로그인 후 사용할 수 있습니다.');return u;}
function checkAccount(request,user){const expected=request.headers.get('X-Atlas-User-Id');if(expected&&expected!==user.id)fail(409,'ACCOUNT_CHANGED','로그인 계정이 바뀌었습니다. 화면을 다시 열어 주세요.');}
function protectWrite(request){
  const origin=request.headers.get('origin');
  if(request.headers.get('sec-fetch-site')==='cross-site'||(origin&&origin!==new URL(request.url).origin))fail(403,'ORIGIN_REJECTED','같은 사이트에서 다시 요청해 주세요.');
}
async function readText(request,max=MAX_ITEM+4096){
  const length=Number(request.headers.get('content-length'));
  if(Number.isFinite(length)&&length>max)fail(413,'PAYLOAD_TOO_LARGE','입력 용량을 줄여 주세요.');
  if(!request.body)return '';
  const reader=request.body.getReader(),parts=[];let bytes=0;
  while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>max){await reader.cancel();fail(413,'PAYLOAD_TOO_LARGE','입력 용량을 줄여 주세요.');}parts.push(value);}
  const all=new Uint8Array(bytes);let at=0;for(const part of parts){all.set(part,at);at+=part.byteLength;}return new TextDecoder().decode(all);
}
async function bodyJson(request,max=MAX_ITEM+4096){
  if(!request.headers.get('content-type')?.toLowerCase().includes('application/json'))fail(415,'JSON_REQUIRED','JSON 형식으로 요청해 주세요.');
  const data=parse(await readText(request,max));
  if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'INVALID_JSON','요청 형식을 확인해 주세요.');return data;
}
async function digest(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof value==='string'?enc.encode(value):value)),x=>x.toString(16).padStart(2,'0')).join('');}
function base64(bytes){let s='';for(const b of new Uint8Array(bytes))s+=String.fromCharCode(b);return btoa(s);}
function unbase64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
async function encryptionKey(env){
  if(!env.ATLAS_ENCRYPTION_KEY)fail(503,'ENCRYPTION_UNAVAILABLE','API 키 보관을 위한 서버 암호화 설정이 필요합니다.');
  let bytes;try{bytes=unbase64(env.ATLAS_ENCRYPTION_KEY);}catch{fail(503,'ENCRYPTION_UNAVAILABLE','서버 암호화 설정을 확인해 주세요.');}
  if(bytes.length!==32)fail(503,'ENCRYPTION_UNAVAILABLE','서버 암호화 설정을 확인해 주세요.');
  return crypto.subtle.importKey('raw',bytes,{name:'AES-GCM'},false,['encrypt','decrypt']);
}
export async function encryptCredential(value,owner,provider,env){
  const iv=crypto.getRandomValues(new Uint8Array(12)),key=await encryptionKey(env);
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(owner+'\n'+provider)},key,enc.encode(value));
  return {ciphertext:base64(ciphertext),iv:base64(iv)};
}
export async function decryptCredential(row,env){
  const key=await encryptionKey(env);
  try{return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unbase64(row.iv),additionalData:enc.encode(row.owner+'\n'+row.provider)},key,unbase64(row.ciphertext)));}
  catch{fail(503,'CREDENTIAL_UNAVAILABLE','암호화된 키를 열 수 없습니다. 연결 설정에서 키를 다시 저장해 주세요.');}
}
async function rate(env,user,bucket,max=120,windowMs=60000){
  if(!env.DB)return;
  const now=Date.now(),key=bucket+':'+(user?.id||'guest')+':'+Math.floor(now/windowMs);
  const r=await env.DB.prepare('INSERT INTO rate_limits (key,hits,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1 RETURNING hits').bind(key,now+windowMs).first();
  if(r?.hits>max)fail(429,'RATE_LIMIT','잠시 후 다시 시도해 주세요.',{retryAfterSeconds:Math.ceil(windowMs/1000)});
  if(r?.hits===1&&Math.random()<.02)await env.DB.prepare('DELETE FROM rate_limits WHERE key IN (SELECT key FROM rate_limits WHERE expires_at<? LIMIT 500)').bind(now).run();
}
const rowValue=row=>row?{key:row.key,value:row.deleted?null:parse(row.value_json),version:row.version,updatedAt:iso(row.updated_at),deleted:Boolean(row.deleted)}:null;
async function readState(db,user,key){return rowValue(await db.prepare('SELECT key,value_json,version,updated_at,deleted FROM user_values WHERE owner=? AND key=?').bind(user.id,key).first());}

async function stateApi(request,env,path,user){
  user=user||requireUser(request,env);checkAccount(request,user);const db=dbRequired(env);
  if(path==='/api/state'&&request.method==='GET'){
    // The write path caps all keys, including tombstones, at 5,000. Never return
    // a partial snapshot: a missing tombstone can resurrect an offline edit.
    const result=await db.prepare('SELECT key,value_json,version,updated_at,deleted FROM user_values WHERE owner=? ORDER BY updated_at ASC,key ASC').bind(user.id).all();
    return json({items:result.results.map(rowValue),limits:stateLimits});
  }
  const key=decodeURIComponent(path.slice('/api/state/'.length));
  if(!safeKey(key))fail(400,'INVALID_KEY','저장 항목 이름을 확인해 주세요.');
  if(!['PUT','DELETE'].includes(request.method))fail(405,'METHOD_NOT_ALLOWED','지원하지 않는 요청입니다.');
  const body=await bodyJson(request),expected=body.expectedVersion;
  if(!Number.isSafeInteger(expected)||expected<0)fail(400,'VERSION_REQUIRED','저장 버전 정보가 필요합니다.');
  const deleting=request.method==='DELETE';
  if(!deleting&&!Object.hasOwn(body,'value'))fail(400,'VALUE_REQUIRED','저장할 값이 필요합니다.');
  const value=deleting?null:JSON.stringify(body.value),bytes=deleting?0:byteLength(value),now=Date.now();
  if(bytes>MAX_ITEM)fail(413,'ITEM_LIMIT','이 항목은 256KB까지 저장할 수 있습니다.');
  let result;
  if(expected===0){
    result=await db.prepare('INSERT INTO user_values (owner,key,value_json,version,updated_at,deleted,bytes) SELECT ?,?,?,1,?,?,? WHERE (SELECT COUNT(*) FROM user_values WHERE owner=?)<? AND (?=1 OR ((SELECT COUNT(*) FROM user_values WHERE owner=? AND deleted=0)<? AND (SELECT COALESCE(SUM(bytes),0) FROM user_values WHERE owner=?)+?<=?)) ON CONFLICT(owner,key) DO NOTHING').bind(user.id,key,value,now,deleting?1:0,bytes,user.id,MAX_TOTAL_KEYS,deleting?1:0,user.id,MAX_ACTIVE_ITEMS,user.id,bytes,MAX_ACCOUNT).run();
  }else{
    // Deletion must remain possible even at a quota. Updating an active key
    // consumes no new slot; restoring a tombstone must recheck the active cap.
    result=await db.prepare('UPDATE user_values SET value_json=?,version=version+1,updated_at=?,deleted=?,bytes=? WHERE owner=? AND key=? AND version=? AND (?=1 OR ((deleted=0 OR (SELECT COUNT(*) FROM user_values WHERE owner=? AND deleted=0)<?) AND (SELECT COALESCE(SUM(bytes),0) FROM user_values WHERE owner=? AND key<>?)+?<=?))').bind(value,now,deleting?1:0,bytes,user.id,key,expected,deleting?1:0,user.id,MAX_ACTIVE_ITEMS,user.id,key,bytes,MAX_ACCOUNT).run();
  }
  const current=await readState(db,user,key);
  if(!changed(result)){
    if((current&&current.version!==expected)||(!current&&expected>0))fail(409,'VERSION_CONFLICT','다른 기기에서 변경한 기록이 있습니다.',{current});
    const usage=await db.prepare('SELECT COUNT(*) AS totalKeys,COALESCE(SUM(CASE WHEN deleted=0 THEN 1 ELSE 0 END),0) AS activeItems,COALESCE(SUM(bytes),0) AS valueBytes FROM user_values WHERE owner=?').bind(user.id).first();
    const reason=!current&&usage.totalKeys>=MAX_TOTAL_KEYS?'TOTAL_KEY_LIMIT':!deleting&&(!current||current.deleted)&&usage.activeItems>=MAX_ACTIVE_ITEMS?'ACTIVE_ITEM_LIMIT':'VALUE_BYTES_LIMIT';
    const message=reason==='TOTAL_KEY_LIMIT'?'삭제 기록을 포함한 서로 다른 저장 키 5,000개 한도입니다. 삭제 버전은 오프라인 기기의 복원을 막기 위해 보존하므로 일반 삭제로 이 한도는 줄지 않습니다. 기존 키를 재사용하거나 기록을 내보내 주세요.':reason==='ACTIVE_ITEM_LIMIT'?'사용 중인 저장 항목 1,000개 한도입니다. 불필요한 항목을 삭제하면 새 항목을 저장할 여유가 생깁니다. 삭제 버전은 계속 보존됩니다.':'사용 중인 기록 값의 합계는 5MB까지 저장할 수 있습니다. 큰 기록을 줄이거나 불필요한 항목을 삭제해 주세요. 삭제 버전은 계속 보존됩니다.';
    fail(413,'ACCOUNT_STORAGE_LIMIT',message,{reason,usage,limits:stateLimits});
  }
  return json(current,deleting?200:expected===0?201:200);
}

async function credentialsFor(user,env){
  if(!user||!env.DB)return [];
  return (await env.DB.prepare('SELECT owner,provider,ciphertext,iv,options_json,updated_at,verified_at,verification FROM connector_credentials WHERE owner=?').bind(user.id).all()).results;
}
async function connectorEnv(user,env){
  const configured={};let revision='public';
  if(user){
    // Native environment credentials are operator-owned; never share a user's own keys with another account.
    if(user.admin)for(const m of Object.values(CONNECTORS))if(m.keyName&&env[m.keyName])configured[m.keyName]=env[m.keyName];
    if(user.admin)for(const names of Object.values(OPTIONS))for(const option of names)if(env[option])configured[option]=env[option];
    const rows=await credentialsFor(user,env);
    for(const row of rows){const meta=CONNECTORS[row.provider];if(!meta?.keyName)continue;configured[meta.keyName]=await decryptCredential(row,env);const opts=parse(row.options_json,{});for(const key of OPTIONS[row.provider]||[])configured[key]=opts[key]===true;revision+=':'+row.provider+':'+row.updated_at;}
  }
  return {configured,revision};
}
async function connectorList(user,env){
  const rows=await credentialsFor(user,env),configured={};
  // Presence-only inspection never decrypts a secret for a settings read.
  if(user?.admin)for(const m of Object.values(CONNECTORS))if(m.keyName&&env[m.keyName])configured[m.keyName]='configured';
  if(user?.admin)for(const names of Object.values(OPTIONS))for(const key of names)if(env[key])configured[key]=env[key];
  for(const row of rows){const meta=CONNECTORS[row.provider];if(!meta?.keyName)continue;configured[meta.keyName]='configured';const opts=parse(row.options_json,{});for(const key of OPTIONS[row.provider]||[])configured[key]=opts[key]===true;}
  return connectionStatus(configured).map(meta=>{
    const row=rows.find(r=>r.provider===meta.id),result=parse(row?.verification);
    const stale=Boolean(row?.verified_at&&Date.now()-row.verified_at>86400000);
    return {...meta,status:result?.status==='ok'&&!stale?'connected':result?.status==='error'?'error':meta.status,verifiedAt:iso(row?.verified_at),lastResult:result||null,verificationExpired:stale,options:parse(row?.options_json,{})};
  });
}
async function cachePut(env,key,provider,payload,seconds=300){
  if(!env.DB)return;
  await env.DB.prepare('INSERT INTO market_cache (key,provider,payload,checked_at,expires_at) VALUES (?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,checked_at=excluded.checked_at,expires_at=excluded.expires_at').bind(key,provider,JSON.stringify(payload),Date.now(),Date.now()+seconds*1000).run();
}
export async function cleanupProviderCache(env,{now=Date.now(),force=false}={}){
  if(!env.DB)return {ran:false,deleted:0,reason:'STORAGE_UNAVAILABLE'};
  try{
    const day=Math.floor(now/DAY_MS),lease='maintenance:provider-cache-cleanup:'+day;
    // Persistent daily claim also coordinates different Worker isolates. Explicit
    // verification/refresh jobs may run one additional bounded batch each.
    const claim=await env.DB.prepare('INSERT INTO rate_limits (key,hits,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO NOTHING').bind(lease,(day+2)*DAY_MS).run();
    if(!force&&!changed(claim))return {ran:false,deleted:0,reason:'ALREADY_RAN_TODAY'};
    const result=await env.DB.prepare("DELETE FROM market_cache WHERE key IN (SELECT key FROM market_cache WHERE key LIKE 'provider:%' AND key<>'active-market-version' AND expires_at<? ORDER BY expires_at ASC,key ASC LIMIT ?)").bind(now-CACHE_STALE_RETENTION_MS,CACHE_CLEANUP_BATCH).run();
    return {ran:true,deleted:Number(result?.meta?.changes??result?.changes??0),limit:CACHE_CLEANUP_BATCH,staleRetentionDays:7};
  }catch{
    // Maintenance failure must not erase data or conceal a valid provider result.
    console.error(JSON.stringify({event:'atlas_cache_cleanup_failed',code:'INTERNAL_ERROR'}));
    return {ran:false,deleted:0,reason:'CLEANUP_FAILED'};
  }
}
async function providerCall(provider,params,user,env,{force=false}={}){
  if(!CONNECTORS[provider])fail(404,'UNKNOWN_PROVIDER','알 수 없는 공급원입니다.');
  if(!user&&provider!=='seoul_population')fail(401,'SIGN_IN_REQUIRED','로그인 후 연결을 설정해 주세요.');
  await cleanupProviderCache(env,{force});
  const {configured,revision}=await connectorEnv(user,env);
  const allowed=CONNECTORS[provider].cacheSeconds>0;
  const key='provider:'+provider+':'+await digest((user?.id||'public')+':'+revision+':'+JSON.stringify(params));
  const cached=env.DB&&allowed?await env.DB.prepare('SELECT payload,checked_at,expires_at FROM market_cache WHERE key=?').bind(key).first():null;
  if(!force&&cached?.expires_at>Date.now()){
    const response=parse(cached.payload);if(response){const age=freshness(response.observedAt,new Date().toISOString());return {...response,...(provider==='seoul_population'?age:{}),live:response.live&&age.freshness==='fresh',cache:{hit:true,storedAt:iso(cached.checked_at)},servedAt:new Date().toISOString()};}
  }
  await rate(env,user,'upstream-minute',20);
  await rate(env,user,'upstream-day',500,86400000);
  const result=await runConnector(provider,params,configured,{timeoutMs:12000,maxBytes:4*1024*1024});
  if(result.status==='ok'&&allowed)await cachePut(env,key,provider,result,CONNECTORS[provider].cacheSeconds);
  if(user&&env.DB){
    const brief={status:result.status,reasonCode:result.reasonCode,message:result.message||null,fetchedAt:result.fetchedAt,observedAt:result.observedAt,mode:result.mode||null};
    await env.DB.prepare('UPDATE connector_credentials SET verified_at=?,verification=? WHERE owner=? AND provider=?').bind(result.status==='ok'?Date.now():null,JSON.stringify(brief),user.id,provider).run();
  }
  if(result.status!=='ok'&&cached&&cached.expires_at>=Date.now()-CACHE_STALE_RETENTION_MS){
    const previous=parse(cached.payload);
    if(previous?.status==='ok')return {...previous,...freshness(previous.observedAt,new Date().toISOString()),status:'stale',live:false,freshness:'stale',refreshError:{reasonCode:result.reasonCode,message:result.message},cache:{hit:true,expired:true,storedAt:iso(cached.checked_at)},servedAt:new Date().toISOString(),warnings:[...previous.warnings,'원천 갱신에 실패하여 이전 응답을 표시합니다.']};
  }
  return result;
}
async function connectorsApi(request,env,path,user){
  if(path==='/api/connectors'&&request.method==='GET')return json({providers:await connectorList(user,env),encryptionAvailable:Boolean(env.ATLAS_ENCRYPTION_KEY),authenticated:Boolean(user)});
  user=user||requireUser(request,env);checkAccount(request,user);const db=dbRequired(env);
  const match=/^\/api\/connectors\/([a-z_]+)(\/test)?$/.exec(path),provider=match?.[1];
  if(!provider||!CONNECTORS[provider])fail(404,'UNKNOWN_PROVIDER','알 수 없는 공급원입니다.');
  if(match[2]&&request.method==='POST'){
    const body=await bodyJson(request,16000);return json(await providerCall(provider,body.params||{},user,env,{force:true}));
  }
  if(!CONNECTORS[provider].keyName)fail(409,'CONTRACT_REQUIRED','공급 계약과 공식 연결 사양이 필요합니다. 임의 키를 저장하지 않습니다.');
  if(request.method==='PUT'){
    const body=await bodyJson(request,16000),key=typeof body.key==='string'?body.key.trim():'';
    if(key.length<4||key.length>4096||key==='sample'||/[\u0000-\u001f\u007f]/.test(key))fail(400,'INVALID_CREDENTIAL','발급받은 운영 API 키를 확인해 주세요. 공식 sample은 키 저장 없이 사용할 수 있습니다.');
    const options={};for(const name of OPTIONS[provider]||[])options[name]=body.options?.[name]===true;
    const encrypted=await encryptCredential(key,user.id,provider,env);
    await db.prepare('INSERT INTO connector_credentials (owner,provider,ciphertext,iv,options_json,updated_at,verified_at,verification) VALUES (?,?,?,?,?,?,NULL,?) ON CONFLICT(owner,provider) DO UPDATE SET ciphertext=excluded.ciphertext,iv=excluded.iv,options_json=excluded.options_json,updated_at=excluded.updated_at,verified_at=NULL,verification=excluded.verification').bind(user.id,provider,encrypted.ciphertext,encrypted.iv,JSON.stringify(options),Date.now(),'unverified').run();
    return json({saved:true,provider,status:'unverified',message:'암호화해 저장했습니다. 실제 응답 검증 후 연결 상태가 바뀝니다.'});
  }
  if(request.method==='DELETE'){
    await db.prepare('DELETE FROM connector_credentials WHERE owner=? AND provider=?').bind(user.id,provider).run();
    return json({deleted:true,provider});
  }
  fail(405,'METHOD_NOT_ALLOWED','지원하지 않는 요청입니다.');
}

async function status(env,user,request){
  let database=false,market=null,jobs=[];
  try{database=Boolean(env.DB&&await env.DB.prepare('SELECT 1 AS ok').first());}catch{}
  try{market=await readMarketJson('manifest.json',env,request);}catch{}
  if(database&&user)jobs=(await env.DB.prepare('SELECT id,kind,status,started_at,finished_at,result_json FROM job_runs WHERE owner=? ORDER BY started_at DESC LIMIT 10').bind(user.id).all()).results.map(r=>({id:r.id,kind:r.kind,status:r.status,startedAt:iso(r.started_at),finishedAt:iso(r.finished_at),result:parse(r.result_json)}));
  return {version:APP_VERSION,serverTime:new Date().toISOString(),authenticated:Boolean(user),storage:{database,objects:Boolean(env.BUCKET),encryptedCredentials:Boolean(env.ATLAS_ENCRYPTION_KEY),accountLimitBytes:MAX_ACCOUNT,itemLimitBytes:MAX_ITEM,activeItemLimit:MAX_ACTIVE_ITEMS,totalKeyLimitIncludingDeleted:MAX_TOTAL_KEYS,tombstonesRetained:true,providerCacheStaleRetentionDays:7},market,connectors:await connectorList(user,env),jobs,readiness:{stage:'private_beta',paidFeedsConnected:false,propertyFeedConnected:false,requires:['전국·일본 실시간 인구 공급 계약 또는 운영 키','상가 매물 표시·갱신 공급 계약','API별 이용조건·호출 한도 확인','운영 모니터링·복구 및 베타 사용자 검증'],note:'현재 연결 상태와 데이터 기준일을 확인하세요. 설정된 키만으로 상용 서비스 제공 권한이 생기지는 않습니다.'}};
}
async function refreshSources(user,env,params={}){
  if(!user?.admin)fail(403,'OWNER_REQUIRED','자료 갱신 작업은 사이트 소유자만 실행할 수 있습니다.');
  const db=dbRequired(env),runId=id(),start=Date.now();
  await db.prepare('INSERT INTO job_runs (id,owner,kind,status,started_at) VALUES (?,?,?,?,?)').bind(runId,user.id,'source_refresh','running',start).run();
  try{
    const population=await providerCall('seoul_population',{area:params.area||'POI009'},user,env,{force:true});
    const result={runId,population,snapshotPolicy:'서울 분기·전국 점포·도쿄 센서스는 기준일이 있는 스냅샷이며 이 인구 조회로 갱신되지 않습니다.'};
    await db.prepare('UPDATE job_runs SET status=?,finished_at=?,result_json=? WHERE id=? AND owner=?').bind(population.status==='ok'?'succeeded':'partial',Date.now(),JSON.stringify({population:{status:population.status,observedAt:population.observedAt,fetchedAt:population.fetchedAt,reasonCode:population.reasonCode},snapshotPolicy:result.snapshotPolicy}),runId,user.id).run();
    await db.prepare('DELETE FROM job_runs WHERE id IN (SELECT id FROM job_runs WHERE owner=? ORDER BY started_at DESC LIMIT -1 OFFSET 200)').bind(user.id).run();
    return result;
  }catch(error){await db.prepare('UPDATE job_runs SET status=?,finished_at=?,result_json=? WHERE id=? AND owner=?').bind('failed',Date.now(),JSON.stringify({error:error.code||'UPDATE_FAILED'}),runId,user.id).run();throw error;}
}
async function secureEqual(a,b){if(!a||!b)return false;const [x,y]=await Promise.all([digest(a),digest(b)]);let d=0;for(let i=0;i<x.length;i++)d|=x.charCodeAt(i)^y.charCodeAt(i);return d===0;}
async function requireImporter(request,env,user){
  if(user?.admin)return;
  if(await secureEqual(request.headers.get('X-Atlas-Import-Secret'),env.ATLAS_IMPORT_SECRET))return;
  fail(403,'OWNER_REQUIRED','인증된 자료 관리 요청이 필요합니다.');
}
const importPath=p=>typeof p==='string'&&p.length<180&&/^[A-Za-z0-9][A-Za-z0-9_./-]*\.json$/.test(p)&&!p.split('/').some(s=>s==='..'||s==='.'||s==='');
async function importApi(request,env,path,user){
  await requireImporter(request,env,user);const db=dbRequired(env);
  if(!env.BUCKET)fail(503,'OBJECT_STORAGE_UNAVAILABLE','자료 저장소가 준비되지 않았습니다.');
  await rate(env,{id:'verified-importer'},'import',1000);
  if(path==='/api/ops/import/start'&&request.method==='POST'){
    const body=await bodyJson(request,100000),version=body.version||('release-'+id());
    if(!/^[A-Za-z0-9_-]{5,100}$/.test(version)||!Number.isInteger(body.expectedCount)||body.expectedCount<1||body.expectedCount>1000)fail(400,'INVALID_IMPORT','자료 묶음 이름과 파일 수를 확인해 주세요.');
    const old=await db.prepare('SELECT id,expected_count,status FROM data_imports WHERE id=?').bind(version).first();
    if(old){if(old.expected_count!==body.expectedCount)fail(409,'IMPORT_CONFLICT','같은 자료 묶음의 파일 수가 다릅니다.');return json({version,status:old.status,resumed:true});}
    await db.prepare('INSERT INTO data_imports (id,expected_count,status,metadata_json,created_at) VALUES (?,?,?,?,?)').bind(version,body.expectedCount,'staging',JSON.stringify(body.metadata||{}),Date.now()).run();
    return json({version,status:'staging'},201);
  }
  if(path==='/api/ops/import/file'&&request.method==='PUT'){
    const url=new URL(request.url),version=url.searchParams.get('version'),path=url.searchParams.get('path');
    if(!version||!importPath(path))fail(400,'INVALID_IMPORT_PATH','자료 경로를 확인해 주세요.');
    const record=await db.prepare('SELECT id,status FROM data_imports WHERE id=?').bind(version).first();
    if(!record||record.status!=='staging')fail(409,'IMPORT_CLOSED','진행 중인 자료 묶음이 아닙니다.');
    const payload=await readText(request,6*1024*1024);if(parse(payload)===null)fail(400,'INVALID_DATA_JSON','JSON 자료를 확인해 주세요.');
    const sha=await digest(payload),existing=await db.prepare('SELECT sha256 FROM import_files WHERE import_id=? AND path=?').bind(version,path).first();
    if(existing){if(existing.sha256!==sha)fail(409,'IMMUTABLE_IMPORT','같은 자료 경로의 내용이 바뀌었습니다. 새 자료 묶음을 사용해 주세요.');return json({path,sha256:sha,stored:true,reused:true});}
    const objectKey='releases/'+version+'/'+path;
    const put=await env.BUCKET.put(objectKey,payload,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'},customMetadata:{sha256:sha}});
    if(!put){const object=await env.BUCKET.head(objectKey);if(object?.customMetadata?.sha256!==sha)fail(409,'IMMUTABLE_IMPORT','자료 저장 중 다른 내용이 감지됐습니다. 새 자료 묶음을 사용해 주세요.');}
    await db.prepare('INSERT INTO import_files (import_id,path,sha256,bytes) VALUES (?,?,?,?) ON CONFLICT(import_id,path) DO NOTHING').bind(version,path,sha,byteLength(payload)).run();
    return json({path,sha256:sha,stored:true});
  }
  if(path==='/api/ops/import/commit'&&request.method==='POST'){
    const body=await bodyJson(request,16000),record=await db.prepare('SELECT * FROM data_imports WHERE id=?').bind(body.version||'').first();
    if(!record)fail(404,'IMPORT_NOT_FOUND','자료 묶음을 찾지 못했습니다.');
    if(record.status==='active')return json({version:record.id,status:'active',reused:true});
    const uploaded=(await db.prepare('SELECT path,sha256,bytes FROM import_files WHERE import_id=?').bind(record.id).all()).results;
    const count={total:uploaded.length};
    if(count.total!==record.expected_count||!uploaded.some(f=>f.path==='manifest.json'))fail(409,'IMPORT_INCOMPLETE','모든 파일과 manifest.json이 저장된 뒤 활성화할 수 있습니다.',{expected:record.expected_count,received:count.total});
    const manifestObject=await env.BUCKET.get('releases/'+record.id+'/manifest.json');
    const manifest=manifestObject?parse(await manifestObject.text()):null;
    if(!Array.isArray(manifest?.files)||manifest.files.length+1!==record.expected_count)fail(409,'MANIFEST_INVALID','자료 목록과 업로드 파일 수가 일치해야 합니다.');
    const known=new Map(uploaded.map(f=>[f.path,f]));
    const paths=new Set();
    for(const file of manifest.files){const got=known.get(file.path);if(!importPath(file.path)||paths.has(file.path)||file.path==='manifest.json'||!got||got.sha256!==file.sha256||got.bytes!==file.bytes)fail(409,'MANIFEST_MISMATCH','자료 목록의 경로·해시·크기가 저장된 파일과 일치하지 않습니다.');paths.add(file.path);}
    const now=Date.now(),payload={version:record.id,activatedAt:iso(now),metadata:parse(record.metadata_json,{})};
    await db.batch([
      db.prepare('INSERT INTO market_cache (key,provider,payload,checked_at,expires_at) VALUES (?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,checked_at=excluded.checked_at,expires_at=excluded.expires_at').bind('active-market-version','atlas_import',JSON.stringify(payload),now,8640000000000000),
      db.prepare('UPDATE data_imports SET status=?,activated_at=? WHERE id=?').bind('active',now,record.id),
    ]);
    return json({version:record.id,status:'active',files:count.total,activatedAt:iso(now)});
  }
  if(path==='/api/ops/import/status'&&request.method==='GET'){
    const active=await db.prepare('SELECT payload FROM market_cache WHERE key=?').bind('active-market-version').first();
    const recent=(await db.prepare('SELECT id,expected_count,status,created_at,activated_at FROM data_imports ORDER BY created_at DESC LIMIT 5').all()).results;
    return json({active:parse(active?.payload),recent});
  }
  fail(404,'NOT_FOUND','요청을 찾지 못했습니다.');
}

async function feedbackApi(request,env,user){
  user=user||requireUser(request,env);const db=dbRequired(env),body=await bodyJson(request,20000);
  const message=typeof body.message==='string'?body.message.trim():'';
  if(message.length<3||message.length>4000)fail(400,'INVALID_FEEDBACK','내용을 3~4,000자로 적어 주세요.');
  const category=['bug','data','feature','other'].includes(body.category)?body.category:'other';
  await rate(env,user,'feedback',10,3600000);
  const feedbackId=id();await db.prepare('INSERT INTO beta_feedback (id,owner,message,category,created_at) VALUES (?,?,?,?,?)').bind(feedbackId,user.id,message,category,Date.now()).run();
  return json({saved:true,id:feedbackId});
}
async function exportAccount(env,user){
  const db=dbRequired(env),values=(await db.prepare('SELECT key,value_json,version,updated_at,deleted FROM user_values WHERE owner=?').bind(user.id).all()).results.map(rowValue);
  return {app:'상권 Atlas',version:APP_VERSION,exportedAt:new Date().toISOString(),items:values,credentialsIncluded:false};
}
function errorResponse(error){
  const requestId=id();
  if(error instanceof ApiError)return json({error:error.code,message:error.message,requestId,...error.extra},error.status,error.status===429?{'Retry-After':String(error.extra.retryAfterSeconds||60)}:{});
  // Never log URLs, headers, body, upstream errors or SQL values; those can contain secrets or private notes.
  console.error(JSON.stringify({event:'atlas_api_error',requestId,code:'INTERNAL_ERROR'}));
  return json({error:'INTERNAL_ERROR',message:'처리하지 못했습니다. 기록은 유지됩니다. 잠시 후 다시 시도해 주세요.',requestId},500);
}
export async function handleApi(request,env){
  try{
    const url=new URL(request.url),path=url.pathname.replace(/\/$/,''),user=identity(request,env);
    if(!['GET','HEAD'].includes(request.method))protectWrite(request);
    if(path.startsWith('/api/ops/import/'))return await importApi(request,env,path,user);
    if(path==='/api/me'&&request.method==='GET')return json({authenticated:Boolean(user),user:user?{id:user.id,displayName:user.displayName}:null,admin:Boolean(user?.admin),storageAvailable:Boolean(env.DB)});
    if(path==='/api/health'&&request.method==='GET')return json({ok:true,version:APP_VERSION});
    await rate(env,user,'api');
    if(path==='/api/state'||path.startsWith('/api/state/'))return await stateApi(request,env,path,user);
    if(path==='/api/status'&&request.method==='GET')return json(await status(env,user,request));
    if(path==='/api/connectors'||path.startsWith('/api/connectors/'))return await connectorsApi(request,env,path,user);
    if(path==='/api/live'&&request.method==='GET')return json(await providerCall('seoul_population',{area:url.searchParams.get('area')||'POI009'},user,env));
    if(path==='/api/provider/places'&&request.method==='GET'){
      const provider=url.searchParams.get('provider');if(!['sbiz_stores','kakao_places','hotpepper_places'].includes(provider))fail(400,'INVALID_PROVIDER','장소 공급원을 선택해 주세요.');
      return json(await providerCall(provider,providerQuery(url.searchParams),user,env));
    }
    if(path==='/api/shops'&&url.searchParams.get('country')==='JP'&&request.method==='GET'){
      const params=providerQuery(url.searchParams),offset=params.offset??0;
      if(offset<0||offset>2970||offset%30!==0)fail(400,'INVALID_PAGE','일본 점포 검색은 30개 단위, 최대 100페이지를 지원합니다.');
      params.page=Math.floor(offset/30)+1;
      const response=await providerCall('hotpepper_places',params,user,env);
      const items=response.data?.items||[];
      const total=response.data?.pagination?.total??null,returned=items.length;
      const more=returned>0&&Number.isFinite(total)&&offset+returned<total&&params.page<100;
      return json({...response,shops:items,items,total,pagination:{total,offset,limit:30,returned,hasMore:more,nextOffset:more?offset+30:null,truncatedByPageLimit:params.page===100&&offset+returned<total},sourcePeriod:null,customerAge:null,currentOperation:'unverified',requiredProvider:response.status==='ok'?null:'hotpepper_places',coverage:{exhaustive:false,note:'Hot Pepper 수록 점포 검색. 일본 전체 음식점 목록은 아닙니다.'}});
    }
    if(path==='/api/refresh'&&request.method==='POST')return json(await refreshSources(requireUser(request,env),env,await bodyJson(request,16000)));
    if(path==='/api/feedback'&&request.method==='POST')return await feedbackApi(request,env,user);
    if(path==='/api/account/export'&&request.method==='GET')return json(await exportAccount(env,requireUser(request,env)));
    if(path==='/api/account'&&request.method==='DELETE'){
      const u=requireUser(request,env);checkAccount(request,u);const body=await bodyJson(request,16000);
      if(body.confirmation!=='DELETE_MY_RECORDS')fail(400,'CONFIRMATION_REQUIRED','삭제 항목을 확인해 주세요.');const db=dbRequired(env);
      await db.batch([db.prepare('DELETE FROM user_values WHERE owner=?').bind(u.id),db.prepare('DELETE FROM connector_credentials WHERE owner=?').bind(u.id),db.prepare('DELETE FROM beta_feedback WHERE owner=?').bind(u.id),db.prepare('DELETE FROM job_runs WHERE owner=?').bind(u.id)]);
      return json({deleted:true,scope:'own_account_records_and_credentials'});
    }
    if(request.method==='GET'){
      const response=await marketApi(request,env,path);if(response)return response;
    }
    fail(404,'NOT_FOUND','요청을 찾지 못했습니다.');
  }catch(error){return errorResponse(error);}
}

const TOOL_DEFINITIONS=[
 {name:'atlas_status',description:'상권 Atlas 베타의 실제 데이터 범위, 출처 기준일, 연결 상태, 최근 갱신 결과를 읽습니다.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true}},
 {name:'atlas_refresh_sources',description:'사이트 소유자가 서울 실시간 인구 원천을 실제 조회하고 응답 시각과 상태를 서버에 저장합니다. 기본은 공식 광화문·덕수궁 sample. 전국 분기 스냅샷과 매물은 이 호출로 갱신되지 않습니다.',inputSchema:{type:'object',properties:{area:{type:'string',description:'공식 장소 코드 또는 이름, 기본 POI009'}},additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true}},
 {name:'atlas_search_regions',description:'한국·일본의 확보된 지역을 검색합니다. 없는 지표를 만들어내지 않습니다.',inputSchema:{type:'object',properties:{country:{type:'string',enum:['KR','JP']},q:{type:'string'},limit:{type:'integer',minimum:1,maximum:50}},required:['country'],additionalProperties:false},annotations:{readOnlyHint:true}},
 {name:'atlas_lookup_shops',description:'한국 공공 점포 스냅샷에서 좌표 주변 음식점을 찾습니다. 최신 영업 여부와 개별 가게 고객 연령은 미확인입니다.',inputSchema:{type:'object',properties:{lat:{type:'number'},lng:{type:'number'},radius:{type:'number',minimum:50,maximum:2000},limit:{type:'integer',minimum:1,maximum:50},category:{type:'string'},q:{type:'string'}},required:['lat','lng'],additionalProperties:false},annotations:{readOnlyHint:true}},
 {name:'atlas_export_my_records',description:'현재 인증된 계정의 출점 검토 기록을 읽습니다. 다른 계정 기록과 API 키는 반환하지 않습니다.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true}},
];
export async function handleMcp(request,env){
  let rpc;
  try{
    protectWrite(request);rpc=await bodyJson(request,32000);
    if(rpc.jsonrpc!=='2.0'||typeof rpc.method!=='string')return json({jsonrpc:'2.0',id:rpc.id??null,error:{code:-32600,message:'Invalid request'}},400);
    if(rpc.method==='notifications/initialized')return new Response(null,{status:202});
    let result;
    if(rpc.method==='server/discover')result={serverInfo:{name:'sangkwon-atlas-beta',version:APP_VERSION},supportedVersions:['2026-07-28'],capabilities:{tools:{}}};
    else if(rpc.method==='initialize')result={protocolVersion:'2026-07-28',serverInfo:{name:'sangkwon-atlas-beta',version:APP_VERSION},capabilities:{tools:{}}};
    else if(rpc.method==='tools/list')result={tools:TOOL_DEFINITIONS};
    else if(rpc.method==='tools/call'){
      const user=requireUser(request,env);await rate(env,user,'mcp',60);const name=rpc.params?.name,args=rpc.params?.arguments||{};let output;
      if(name==='atlas_status')output=await status(env,user,request);
      else if(name==='atlas_refresh_sources')output=await refreshSources(user,env,args);
      else if(name==='atlas_export_my_records')output=await exportAccount(env,user);
      else if(name==='atlas_search_regions'||name==='atlas_lookup_shops'){
        const url=new URL(name==='atlas_search_regions'?'/api/regions':'/api/shops',request.url);
        for(const [key,value] of Object.entries(args))url.searchParams.set(key,String(value));
        if(name==='atlas_lookup_shops')url.searchParams.set('country','KR');
        const response=await marketApi(new Request(url),env,url.pathname);output=response?await response.json():{error:'NOT_FOUND'};
      }else return json({jsonrpc:'2.0',id:rpc.id??null,error:{code:-32602,message:'Unknown tool'}});
      result={content:[{type:'text',text:JSON.stringify(output)}],isError:Boolean(output?.error),structuredContent:output};
    }else return json({jsonrpc:'2.0',id:rpc.id??null,error:{code:-32601,message:'Method not found'}});
    return json({jsonrpc:'2.0',id:rpc.id??null,result});
  }catch(error){
    const code=error instanceof ApiError?error.code:'INTERNAL_ERROR',message=error instanceof ApiError?error.message:'요청을 처리하지 못했습니다.';
    return json({jsonrpc:'2.0',id:rpc?.id??null,result:{content:[{type:'text',text:JSON.stringify({error:code,message})}],isError:true}},error instanceof ApiError&&error.status===401?401:200);
  }
}
