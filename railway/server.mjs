import http from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,timingSafeEqual} from 'node:crypto';
import {database,bucket,assets} from './adapters.mjs';
import {handleApi} from '../lib/atlas-server.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const hash=value=>createHash('sha256').update(value).digest();
export function settings(e){
 if(!e.ATLAS_OWNER_PASSWORD||e.ATLAS_OWNER_PASSWORD.length<24)throw Error('ATLAS_OWNER_PASSWORD must contain at least 24 characters');
 if(!/^[A-Za-z0-9_-]{3,80}$/.test(e.ATLAS_OWNER_ID||''))throw Error('ATLAS_OWNER_ID is required and must remain stable');
 if(!e.ATLAS_OWNER_EMAIL||!/^[^\s@]+@[^\s@]+$/.test(e.ATLAS_OWNER_EMAIL))throw Error('ATLAS_OWNER_EMAIL is required');
 if(!e.ATLAS_PUBLIC_ORIGIN)throw Error('ATLAS_PUBLIC_ORIGIN is required');
 const url=new URL(e.ATLAS_PUBLIC_ORIGIN);if(url.origin!==e.ATLAS_PUBLIC_ORIGIN||url.username||url.password)throw Error('Use a canonical origin');
 if(url.protocol!=='https:'&&!(e.ATLAS_LOCAL_TEST==='1'&&url.hostname==='127.0.0.1'))throw Error('HTTPS is required');
 if(!e.ATLAS_ENCRYPTION_KEY||Buffer.from(e.ATLAS_ENCRYPTION_KEY,'base64').length!==32)throw Error('A stable 32-byte ATLAS_ENCRYPTION_KEY is required');
 if(!e.ATLAS_DATA_DIR)throw Error('ATLAS_DATA_DIR must point to a persistent volume');
 return {...e,origin:url.origin};
}
export function authorized(header,c){
 if(typeof header!=='string'||header.length>4096||!header.startsWith('Basic '))return false;
 const text=Buffer.from(header.slice(6),'base64').toString('utf8'),split=text.indexOf(':');
 return split>0&&timingSafeEqual(hash(text.slice(0,split)),hash(c.ATLAS_OWNER_EMAIL))&&timingSafeEqual(hash(text.slice(split+1)),hash(c.ATLAS_OWNER_PASSWORD));
}
export function createServer(config){
 const c=settings(config);mkdirSync(c.ATLAS_DATA_DIR,{recursive:true,mode:0o700});
 const DB=database(resolve(c.ATLAS_DATA_DIR,'atlas.sqlite'),resolve(ROOT,'drizzle/0000_chief_leader.sql'));
 const env={...c,DB,BUCKET:bucket(resolve(c.ATLAS_DATA_DIR,'objects')),ASSETS:assets(resolve(ROOT,'public'))};
 const shell=JSON.parse(readFileSync(resolve(ROOT,'app/ui-shell.ts'),'utf8').replace(/^export const shell = /,'').trim().replace(/;$/,''));
 const scripts=['domain.js','property-compare.js','recommend.js','opening-plan.js','opening-ui.js','app.js'];
 const html='<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="robots" content="noindex,nofollow"><title>상권 Atlas</title><link rel="icon" href="/icon.svg"><link rel="stylesheet" href="/railway-shell.css"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/opening.css"><link rel="stylesheet" href="https://unpkg.com/maplibre-gl@6.15.0/dist/maplibre-gl.css"></head><body>'+shell+'<script src="/cloud-sync.js"></script><script>(async()=>{await window.AtlasCloud.init();for(const src of '+JSON.stringify(scripts)+'){await new Promise((ok,no)=>{const s=document.createElement("script");s.src="/"+src;s.onload=ok;s.onerror=no;document.body.appendChild(s);});}})().catch(()=>{document.getElementById("main").textContent="앱을 불러오지 못했습니다. 새로고침해 주세요."});</script></body></html>';
 const server=http.createServer(async(req,res)=>{
  const send=async response=>{res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));};
  try{
   // Only readiness is public; no user data/config is returned.
   if(req.url==='/healthz'&&req.method==='GET'){await DB.prepare('SELECT 1').first();res.writeHead(200,{'Content-Type':'text/plain'});res.end('ok');return;}
   res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('X-Frame-Options','DENY');
   if(!authorized(req.headers.authorization,c)){res.writeHead(401,{'WWW-Authenticate':'Basic realm="Atlas Private", charset="UTF-8"'});res.end('Authentication required');return;}
   const url=new URL(req.url,c.origin);if(url.origin!==c.origin){res.writeHead(400);res.end();return;}
   if(req.headers.origin&&req.headers.origin!==c.origin){res.writeHead(403);res.end();return;}
   if(req.headers['sec-fetch-site']==='cross-site'){res.writeHead(403);res.end();return;}
   if(url.pathname.startsWith('/api/')){
    const headers=new Headers();for(const [key,value] of Object.entries(req.headers)){if(value!==undefined&&!key.startsWith('oai-')&&!['authorization','host','connection','transfer-encoding'].includes(key))headers.set(key,String(value));}
    // Browser-supplied identity headers are never trusted. The server derives one owner.
    headers.set('oai-authenticated-user-id','railway:'+c.ATLAS_OWNER_ID);headers.set('oai-authenticated-user-email',c.ATLAS_OWNER_EMAIL);
    let body; if(!['GET','HEAD'].includes(req.method)){const chunks=[];let length=0;for await(const part of req){length+=part.length;if(length>7*1024*1024){res.writeHead(413);res.end();return;}chunks.push(part);}body=Buffer.concat(chunks);}
    await send(await handleApi(new Request(url,{method:req.method,headers,body}),env));return;
   }
   if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
   if(url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(req.method==='HEAD'?'':html);return;}
   if(url.pathname==='/railway-shell.css'){res.writeHead(200,{'Content-Type':'text/css'});res.end(readFileSync(resolve(ROOT,'app/globals.css')));return;}
   const response=await env.ASSETS.fetch(new Request(url));const types={'.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};response.headers.set('Content-Type',types[extname(url.pathname)]||'application/octet-stream');await send(response);
  }catch{res.writeHead(500);res.end('Internal server error');}
 });server.on('close',()=>DB.close());server.requestTimeout=30000;server.headersTimeout=10000;return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const server=createServer(process.env);server.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Atlas Railway server ready'));
 for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
}
