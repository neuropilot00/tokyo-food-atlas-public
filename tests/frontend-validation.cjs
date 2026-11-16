'use strict';
// Integration regressions for null money, country isolation, and evidence metadata.
// DOM stand-ins exercise deployed handlers; this is not a browser layout test.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const store=new Map(),nodes=new Map(),listeners={};let showLive=false;
const clone=v=>JSON.parse(JSON.stringify(v));
const node=id=>{if(!nodes.has(id))nodes.set(id,{id,dataset:{},innerHTML:'',textContent:'',value:'',open:false,disabled:false,scrollTop:0,classList:{add(){},remove(){},toggle(){}},setAttribute(){},close(){this.open=false},showModal(){this.open=true},scrollIntoView(){},querySelector(){return null}});return nodes.get(id);};
const window={AtlasCloud:{get(k,f){return store.has(k)?clone(store.get(k)):f},set(k,v){store.set(k,clone(v));return true},status(){return{mode:'local'}},conflicts(){return[]}},addEventListener(){},scrollTo(){}};
const sandbox={window,console,URL,URLSearchParams,Intl,Number,JSON,Date,Math,Blob,setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},history:{replaceState(){}},location:{hash:'',reload(){}},document:{visibilityState:'visible',querySelector(selector){return (['#beta-shops','#sync-details'].includes(selector)||(selector==='#beta-live'&&!showLive))?null:node(selector)},querySelectorAll(){return[]},addEventListener(type,fn){(listeners[type]||=[]).push(fn)}},FormData:class{constructor(form){this.data=form.inputs}get(key){return this.data[key]??''}},inputData:JSON.parse(fs.readFileSync(path.join(root,'public/data.json'),'utf8')),inputCompetition:JSON.parse(fs.readFileSync(path.join(root,'public/competition.json'),'utf8'))};
vm.createContext(sandbox);
for(const f of ['domain.js','recommend.js'])vm.runInContext(fs.readFileSync(path.join(root,'public',f),'utf8'),sandbox);
sandbox.AtlasDomain=window.AtlasDomain;sandbox.AtlasRecommend=window.AtlasRecommend;
vm.runInContext(fs.readFileSync(path.join(root,'public/app.js'),'utf8').replace(/\ninitialize\(\);\s*$/,''),sandbox);
vm.runInContext(fs.readFileSync(path.join(root,'public/beta-ui.js'),'utf8'),sandbox);
const run=s=>vm.runInContext(s,sandbox);
run(`DATA=inputData;COMPETITION=inputCompetition;for(const c of Object.values(DATA.countries))c.areas=c.areas.map(normalizeArea);state.country='KR';loadCountry();window.AtlasBeta.init({state:()=>state,data:()=>DATA,competition:()=>COMPETITION,country:C,area:A,storage,esc,nf,money,shortMoney,link,safeUrl,openDialog,toast,render,navigate,allProperties});`);
function addManual(inputs){const button={dataset:{beta:'add-property'}};for(const fn of listeners.click)fn({target:{closest(selector){return selector==='[data-beta]'?button:null}}});const form=node('#manual-property-form');form.inputs=inputs;form.onsubmit({preventDefault(){},target:form});return run(`storage.get('properties-'+state.country,[])[0]`);}
const partial=addManual({title:'부분 비용 검증',address:'테스트 주소',rent:'1500000',management:'',deposit:'',transfer:'0'});
assert.equal(partial.rent,1500000);assert.equal(partial.management,null);assert.equal(partial.deposit,null);assert.equal(partial.transfer,0);
sandbox.propertyId=partial.id;
run(`applyProperty(propertyId);calculateFinance();`);
assert.equal(run('state.finance.rent'),1500000);
assert.equal(run('state.finance.management'),null);
assert.equal(run('state.finance.deposit'),null);
assert.equal(run('state.finance.transfer'),0);
assert.equal(run('financeResult.valid'),false);
assert.equal(run('financeResult.initialCash'),null,'Unknown deposit must not become a partial cash total');
assert.equal(run('financeResult.budgetRemaining'),null);
assert.equal(node('#save-scenario').disabled,true);
assert.match(run('appliedPropertyNotice()'),/미확인·입력 필요: 관리비 · 보증금/);
assert.match(run('appliedPropertyNotice()'),/기존 계획 가정을 유지/);
run(`state.finance.management=0;state.finance.deposit=20000000;calculateFinance();`);
assert.equal(run('financeResult.valid'),true,'Explicit zero management is a valid user assumption');
assert.match(run('appliedPropertyNotice()'),/직접 입력·수정한 값: 관리비 · 보증금/);
const originalFitout=run('state.finance.fitout');
assert.equal(originalFitout,25000000,'Applying a property must retain separately labeled planning inputs');
run(`state.country='JP';loadCountry();state.profile.totalBudget=15000000;calculateRecommendations();`);
assert.equal(run('recommendation.currency'),'JPY');
assert.ok(run(`recommendation.candidates.every(c=>c.assumptions.currency==='JPY')`));
assert.ok(run(`recommendation.candidates.every(c=>c.reasons.filter(x=>x.includes('현금')).every(x=>x.includes('엔')&&!x.includes('원')))`));
assert.equal(run('state.finance.management'),20000,'Korean zero assumption must not enter Japanese state');
run(`applyProperty('jp-404586');calculateFinance();`);
assert.equal(run('state.finance.rent'),660000);assert.equal(run('state.finance.management'),0);assert.equal(run('state.finance.deposit'),null);assert.equal(run('state.finance.transfer'),null);
assert.equal(run('money(state.finance.rent)'),'¥660,000');
assert.equal(run('financeResult.valid'),false);
run(`state.finance.deposit=1000000;state.finance.transfer=0;calculateFinance();saveFinance();`);
assert.equal(run('financeResult.valid'),true);
const beforeExtra=run('financeResult.fixed');
run(`C().properties=C().properties.filter(p=>p.id!=='jp-404586');calculateFinance();`);
assert.equal(run('financeResult.fixed'),beforeExtra,'An applied source snapshot must preserve known additional monthly charges');
assert.equal(run('savedItems()[0].propertyRecord.additionalMonthly'),1100);
run(`state.country='KR';loadCountry();`);
assert.equal(run('state.finance.rent'),1500000);assert.equal(run('state.finance.management'),0);assert.equal(run('state.finance.deposit'),20000000);
assert.equal(run('money(state.finance.rent)'),'₩1,500,000');
const profile={totalBudget:150000000,daypart:'allday',experience:'new',service:'any'};
const recommend=window.AtlasRecommend.recommend,area=sandbox.inputData.countries.KR.areas[0];
const baseline=recommend({country:'KR',area,profile});
const competition={reporting_quarter:'20262',industries:[{code:'CS100001',name:'한식',available:true,reported_store_count:3,closures:4,recommendation_eligible:false,quality_flags:['closure_count_exceeds_reported_store_count']},{code:'CS100008',name:'분식',available:false,reported_store_count:null}]};
const reviewed=recommend({country:'KR',area,profile,competition});
assert.deepEqual(clone(reviewed.candidates.map(c=>[c.id,c.score])),clone(baseline.candidates.map(c=>[c.id,c.score])));
const evidence=reviewed.candidates.find(c=>c.id==='takeout').competitionEvidence;
assert.equal(evidence.usedInScore,false);assert.equal(evidence.rows[0].requiresReview,true);assert.equal(evidence.rows[0].reportedStoreCount,3);assert.equal(evidence.rows[1].available,false);assert.equal(evidence.rows[1].reportedStoreCount,null);
sandbox.reviewed=reviewed;run(`recommendation=reviewed;candidateDetails('takeout');`);
assert.match(node('#dialog-body').innerHTML,/원자료 검토 필요/);assert.match(node('#dialog-body').innerHTML,/원자료 행 없음/);assert.match(node('#dialog-body').innerHTML,/2026년 2분기/);
// A selected lazy region must survive a cold data reload and saved-plan restore.
sandbox.lazyRegion={id:'KR-ADONG-26230560',name:'전포1동',country:'KR',province:'부산광역시',district:'부산진구',lat:35.153,lng:129.06,residents:{total:12000,groups:{first:1000,'20-39':5000,'40-59':4000,'60+':2000},date:'test snapshot',sourceAgeLabel:'0–19세'},workers:null,flow:null};
run(`C().areas.push(normalizeArea(lazyRegion));chooseArea(lazyRegion.id);`);
assert.equal(store.get('atlas2-area-snapshot-KR').id,'KR-ADONG-26230560');
sandbox.freshData=JSON.parse(fs.readFileSync(path.join(root,'public/data.json'),'utf8'));
run(`DATA=freshData;for(const c of Object.values(DATA.countries))c.areas=c.areas.map(normalizeArea);loadCountry();`);
assert.equal(run('state.area'),'KR-ADONG-26230560');assert.equal(run('A().name'),'전포1동');assert.equal(run('state.restoreAreaId'),null);
assert.equal(run(`ageLabel('first')`),'0–19세');
run(`state.profile.totalBudget=80000000;state.finance={...defaults.KR};state.property=null;state.propertyRecord=null;calculateFinance();saveFinance();`);
const saved=run('savedItems()[0]');assert.equal(saved.areaRecord.id,'KR-ADONG-26230560');
sandbox.freshData=JSON.parse(fs.readFileSync(path.join(root,'public/data.json'),'utf8'));sandbox.restorePlanId=saved.id;
store.delete('atlas2-area-snapshot-KR');store.delete('atlas2-area-record-KR');
run(`DATA=freshData;for(const c of Object.values(DATA.countries))c.areas=c.areas.map(normalizeArea);loadPlan(restorePlanId);`);
assert.equal(run('A().id'),'KR-ADONG-26230560');assert.equal(run('A().name'),'전포1동');assert.equal(run('state.restoreAreaId'),null);
assert.equal(store.get('atlas2-area-snapshot-KR').id,'KR-ADONG-26230560');
console.log('PASS: lazy-region cold reload and saved-plan snapshot restore; source-specific first age label.');
console.log('PASS: manual property blank/null versus explicit zero; invalid calculation/save blocking; source versus edited assumptions; KR/JPY state and money isolation; preserved applied extra-charge snapshot; flagged/missing competition evidence with unchanged ranking.');

// The live selector uses catalog IDs and gates non-sample areas on provider state.
(async()=>{
  const calls=[];let configured=false;
  sandbox.fetch=async(url,options)=>{calls.push(String(url));let body;
    if(url==='/seoul-live-areas.json')body={areas:[{code:'POI009',name:'광화문·덕수궁'},{code:'POI001',name:'강남 MICE 관광특구'}]};
    else if(url==='/api/connectors')body={providers:[{id:'seoul_population',credentialConfigured:configured,status:configured?'ready_to_verify':'sample_only'}]};
    else if(String(url).startsWith('/api/live?area=')){const code=new URL('https://test.local'+url).searchParams.get('area');body={status:'ok',mode:configured?'authenticated_api':'official_sample',live:true,observedAt:'2026-10-24T01:00:00Z',fetchedAt:'2026-10-24T01:01:00Z',ageMinutes:1,data:{areaCode:code,areaName:code==='POI009'?'광화문·덕수궁':'강남 MICE 관광특구',populationMin:100,populationMax:200,congestion:'여유',customerAge:null},warnings:[]};}
    else if(url==='/api/connectors/seoul_population/test')body={status:'ok',mode:'authenticated_api',observedAt:'2026-10-24T01:00:00Z'};
    else throw new Error('Unexpected mocked request '+url);
    return {ok:true,status:200,json:async()=>body};
  };
  showLive=true;run(`state.view='area';window.AtlasBeta.afterRender();`);
  await new Promise(resolve=>setImmediate(resolve));
  assert.match(node('#beta-live').innerHTML,/<option value="POI001"[^>]*disabled/,'Unconfigured key must not allow a different sample place');
  assert.match(node('#beta-live').innerHTML,/광화문·덕수궁/);
  assert.ok(calls.includes('/api/live?area=POI009'));
  configured=true;
  const button={dataset:{beta:'test-connector',id:'seoul_population'}};
  for(const fn of listeners.click)await fn({target:{closest(selector){return selector==='[data-beta]'?button:null}}});
  assert.doesNotMatch(node('#beta-live').innerHTML,/<option value="POI001"[^>]*disabled/);
  node('#live-area-select').onchange({target:{value:'POI001'}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.ok(calls.includes('/api/live?area=POI001'));
  assert.match(node('#beta-live').innerHTML,/강남 MICE 관광특구/);
  assert.match(node('#beta-live').innerHTML,/상권의 값으로 대체하지/);
  console.log('PASS: live catalog selection; sample-only restriction; configured-key request uses exact selected official code; displayed place and scope warning update.');
})().catch(error=>{console.error(error);process.exitCode=1;});

// Visual summaries share validated totals, retain zero/missing semantics, and expose exact labels.
run(`state.country='KR';loadCountry();state.finance={...defaults.KR};calculateFinance();`);
const visual=node('#finance-output').innerHTML;
assert.match(visual,/월 매출과 손익분기/);
assert.match(visual,/초기자금 배분/);
assert.match(visual,/실제 매출 예측이 아닙니다/);
assert.doesNotMatch(visual,/NaN|Infinity|width:-/);
run(`state.finance.deposit=null;calculateFinance();`);
assert.doesNotMatch(node('#finance-output').innerHTML,/atlas-stacked/,'Unknown cost must not produce a complete chart');
run(`state.finance={...defaults.KR,deposit:0,transfer:0,fitout:0,openingCosts:0,reserve:0};calculateFinance();`);
assert.match(node('#finance-output').innerHTML,/배정한 초기 자금이 0/);
assert.doesNotMatch(node('#finance-output').innerHTML,/NaN|Infinity/);
console.log('PASS: visual finance summaries preserve missing, zero and valid totals.');
// The four-step property workflow links existing actions rather than a dead-end guide.
const workflow=run('propertyWorkflow()');
for(const action of ['property-discovery','finance-input','finance-result','compare-properties'])assert.match(workflow,new RegExp('data-action="'+action+'"'));
assert.match(run('renderPlaces()'),/aria-label="매물 검토 순서"/);
assert.match(workflow,/자동 매물 검색·공실 확인 서비스가 아닙니다/);
run('openPropertyDiscovery()');
assert.match(node('#dialog-body').innerHTML,/data-beta="add-property"/);
assert.match(node('#dialog-body').innerHTML,/現在|현재 공실/);
let focused=false;node('#f-rent').focus=()=>{focused=true};
function workflowClick(action){const button={dataset:{action}};for(const fn of listeners.click)fn({target:{closest(selector){return selector.includes('[data-action]')?button:null}}});}
workflowClick('finance-input');assert.equal(focused,true);
workflowClick('finance-result');assert.ok(node('#finance-output').innerHTML.length>0);
let compared=false;window.AtlasPropertyCompare={open(args){compared=args.properties.length===run('allProperties().length')}};
workflowClick('compare-properties');assert.equal(compared,true);
console.log('PASS property workflow: linked candidate/input/result/comparison actions and explicit source limitations');

// Sites must load the public visual rules, not only the base globals bundle.
const siteLayout=fs.readFileSync(path.join(root,'app/layout.tsx'),'utf8');
for(const file of ['styles.css','opening.css']){
 assert.match(siteLayout,new RegExp('rel="stylesheet" href="/'+file.replace('.','\\.')+'"'));
 assert.ok(fs.existsSync(path.join(root,'public',file)));
}
assert.match(siteLayout,/href="\/opening\.css" data-opening-style="true"/);
assert.match(fs.readFileSync(path.join(root,'public/opening-ui.js'),'utf8'),/link\[data-opening-style\]/);
console.log('PASS Sites stylesheet loading: public visual styles and deduplicated opening styles');
