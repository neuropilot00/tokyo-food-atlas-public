'use client';
import {useEffect,useRef} from 'react';
import {shell} from './ui-shell';
declare global {interface Window {__atlasLoaded?:boolean;__atlasBootCompleted?:boolean;AtlasCloud?:{init:()=>Promise<unknown>}}}
export default function AtlasApp(){
 const host=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!host.current||host.current.querySelector('#main'))return;
  // The DOM app owns this subtree. Keeping it outside React's innerHTML prop
  // prevents an RSC refresh from replacing live forms with the initial shell.
  host.current.innerHTML=shell;
  if(window.__atlasLoaded){window.location.reload();return;}
  window.__atlasLoaded=true;
  const script=(src:string)=>new Promise<void>((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=()=>resolve();s.onerror=reject;document.body.appendChild(s);});
  (async()=>{await script('/cloud-sync.js');await window.AtlasCloud?.init();await script('/domain.js');await script('/recommend.js');await script('/app.js');window.__atlasBootCompleted=true;})().catch(()=>{
   const main=document.getElementById('main');if(main)main.innerHTML='<div class="empty-state"><h2>앱을 불러오지 못했습니다.</h2><p>연결을 확인하고 다시 열어 주세요.</p><button class="button" onclick="location.reload()">다시 불러오기</button></div>';
  });
 },[]);
 return <><div id="atlas-root" ref={host}/><noscript>상권 Atlas를 사용하려면 브라우저의 JavaScript를 켜 주세요.</noscript></>;
}
