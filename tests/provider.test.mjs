import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {connectionStatus,runConnector,parseSeoulPopulation,parseSbizStores,parseKakaoPlaces,parseHotpepperPlaces,parseKstTimestamp} from '../lib/provider-connectors.mjs';

// The only captured success fixture is an actual official Seoul sample response.
// Other JSON fixtures below are synthetic schema checks, not live-provider tests.
const fixture=JSON.parse(await readFile(new URL('./fixtures/seoul-public-sample-2026-10-24.json',import.meta.url),'utf8'));
const fetchedAt='2026-10-24T10:10:03.160Z';
const parsed=parseSeoulPopulation(fixture,{fetchedAt,requestedArea:'POI009',sample:true});
assert.equal(parsed.status,'ok');
assert.equal(parsed.data.populationMin,32000);
assert.equal(parsed.data.populationMax,34000);
assert.equal(parsed.observedAt,'2026-10-24T09:40:00.000Z');
assert.equal(parsed.freshness,'delayed');
assert.equal(parsed.live,false,'A thirty minute old observation must not be called fresh live data');
assert.equal(parsed.data.forecastsIncluded,false);
assert.equal(parsed.data.customerAge,null);
assert.equal(parseKstTimestamp('2026-02-30 18:40'),null);
assert.equal(parseKstTimestamp('2026-10-24 24:01'),null);
assert.equal(parseSeoulPopulation(fixture,{fetchedAt,requestedArea:'POI001'}).reasonCode,'AREA_MISMATCH');
const future=parseSeoulPopulation(fixture,{fetchedAt:'2026-10-23T10:00:00Z'});
assert.equal(future.freshness,'clock_error');assert.equal(future.live,false);
const missing=structuredClone(fixture);missing.CITYDATA.LIVE_PPLTN_STTS[0].AREA_PPLTN_MIN=' ';
assert.equal(parseSeoulPopulation(missing,{fetchedAt}).status,'error');
const noAge=structuredClone(fixture);noAge.CITYDATA.LIVE_PPLTN_STTS[0].PPLTN_RATE_10='';
assert.equal(parseSeoulPopulation(noAge,{fetchedAt}).data.agePercentages.PPLTN_RATE_10,null);

let calls=0,request;
const fetchFixture=async(url,options)=>{calls++;request={url,options};return new Response(JSON.stringify(fixture),{headers:{'content-type':'application/json'}});};
assert.equal((await runConnector('seoul_population',{area:'POI001'},{},{fetchImpl:fetchFixture})).status,'blocked');
assert.equal(calls,0,'No key must not trigger a query outside the official sample scope');
const ok=await runConnector('seoul_population',{area:'POI009'},{},{fetchImpl:fetchFixture,now:()=>fetchedAt});
assert.equal(ok.status,'ok');assert.equal(request.options.redirect,'error');
assert.ok(request.url.startsWith('http://openapi.seoul.go.kr:8088/sample/json/citydata/'));
assert.equal((await runConnector('seoul_population',{area:'POI001'},{SEOUL_API_KEY:'TOPSECRET'},{fetchImpl:fetchFixture})).reasonCode,'UPSTREAM_HTTP_REVIEW_REQUIRED');
const metadata=connectionStatus({SEOUL_API_KEY:'TOPSECRET',KAKAO_REST_API_KEY:'TOPSECRET',HOTPEPPER_API_KEY:'TOPSECRET'});
assert.ok(!JSON.stringify(metadata).includes('TOPSECRET'));
assert.ok(metadata.every(x=>x.status!=='connected'&&x.status!=='live'));
assert.equal(metadata.find(x=>x.id==='hotpepper_places').reasonCode,'BUSINESS_TERMS_REVIEW_REQUIRED');
const html=await runConnector('seoul_population',{}, {}, {fetchImpl:async()=>new Response('<html>Busy</html>')});
assert.equal(html.reasonCode,'NON_JSON_RESPONSE');
const upstream=await runConnector('seoul_population',{}, {}, {fetchImpl:async()=>new Response(JSON.stringify({RESULT:{CODE:'ERROR-500'}}))});
assert.equal(upstream.status,'error');assert.equal(upstream.live,false);
const err=await runConnector('seoul_population',{area:'POI001'},{SEOUL_API_KEY:'TOPSECRET',SEOUL_HTTP_KEY_APPROVED:'true'},{fetchImpl:async(url)=>{throw Error(url);}});
assert.ok(!JSON.stringify(err).includes('TOPSECRET'));
const huge=await runConnector('seoul_population',{}, {}, {maxBytes:10,fetchImpl:async()=>new Response('01234567890123456789')});
assert.equal(huge.reasonCode,'RESPONSE_TOO_LARGE');
assert.equal((await runConnector('constructor')).reasonCode,'UNKNOWN_PROVIDER');
assert.equal((await runConnector('property_feed')).status,'blocked');
assert.equal((await runConnector('docomo_population')).status,'blocked');
assert.equal((await runConnector('kakao_places',{lat:37,lng:127},{KAKAO_REST_API_KEY:'x'})).status,'blocked');
assert.equal((await runConnector('sbiz_stores',{lat:37,lng:127,radius:2001},{SBIZ_API_KEY:'x'})).reasonCode,'INVALID_INPUT');
assert.equal((await runConnector('sbiz_stores',{lat:37,lng:127,category:'cafe'},{SBIZ_API_KEY:'x'},{fetchImpl:async()=>{throw Error('Unsupported category must never call the provider');}})).reasonCode,'INVALID_INPUT');
const sbiz= parseSbizStores({header:{resultCode:'00'},body:{stdrYm:'202609',totalCount:1,pageNo:1,numOfRows:100,items:[{bizesId:'test',bizesNm:'가상 스키마 테스트',lat:'37.5',lon:'127.0'}]}},{fetchedAt});
assert.equal(sbiz.status,'ok');assert.equal(sbiz.observedAt,null);assert.equal(sbiz.observedPeriod,'202609');assert.equal(sbiz.live,false);
const kakao=parseKakaoPlaces({meta:{total_count:1,pageable_count:1,is_end:true},documents:[{id:'test',place_name:'가상 스키마 테스트',x:'127',y:'37',place_url:'javascript:alert(1)'}]},{fetchedAt});
assert.equal(kakao.data.items[0].sourceUrl,null);assert.equal(kakao.live,false);assert.equal(kakao.observedAt,null);
const hp=parseHotpepperPlaces({results:{results_available:1,shop:[{id:'test',name:'Schema test',budget:{name:'3001～4000円'}}]}},{fetchedAt});
assert.equal(hp.data.items[0].price,null);assert.equal(hp.data.items[0].listedBudgetLabel,'3001～4000円');assert.equal(hp.live,false);

// Synthetic request/response checks: no real Hot Pepper account or network call.
// Official keyword/start/count semantics: https://webservice.recruit.co.jp/doc/hotpepper/reference.html
const hpEnv={HOTPEPPER_API_KEY:'UNIT_TEST_ONLY_NOT_REAL_KEY',HOTPEPPER_USE_APPROVED:true};
const hpParams={lat:35.69,lng:139.70,radius:500,page:2};
let hpCalls=0,hpRequest;
const hpFetch=async(url,options)=>{hpCalls++;hpRequest={url:new URL(url),options};return new Response(JSON.stringify({results:{results_available:45,results_returned:1,results_start:31,shop:[{id:'schema-only',name:'架空スキーマ検証'}]}}),{headers:{'content-type':'application/json'}});};
const searched=await runConnector('hotpepper_places',{...hpParams,q:'  新宿 ラーメン & bar  ',category:''},hpEnv,{fetchImpl:hpFetch});
assert.equal(searched.status,'ok');
assert.equal(hpRequest.url.searchParams.get('keyword'),'新宿 ラーメン & bar');
assert.equal(hpRequest.url.searchParams.get('start'),'31');
assert.equal(hpRequest.url.searchParams.get('count'),'30');
assert.equal(hpRequest.url.searchParams.get('key'),hpEnv.HOTPEPPER_API_KEY);
assert.equal(hpRequest.url.searchParams.has('q'),false);
assert.equal(hpRequest.url.searchParams.has('category'),false);
assert.equal(hpRequest.options.redirect,'error');
assert.equal(searched.data.pagination.start,31);
for(const q of [undefined,'','   ']){
  assert.equal((await runConnector('hotpepper_places',{...hpParams,q,category:'all'},hpEnv,{fetchImpl:hpFetch})).status,'ok');
  assert.equal(hpRequest.url.searchParams.has('keyword'),false,'Empty keywords must be omitted, not sent as an active filter');
}
assert.equal((await runConnector('hotpepper_places',{...hpParams,q:'가'.repeat(120)},hpEnv,{fetchImpl:hpFetch})).status,'ok');
for(const patch of [{q:'가'.repeat(121)},{q:'line\nbreak'},{q:'tab\tbreak'},{q:'bad\u007f'},{q:'bad\u0085'},{q:null},{q:42},{q:{}},{category:'cafe'},{category:'FD6'},{category:'G001'},{category:42}]){
  const count=hpCalls;
  const invalid=await runConnector('hotpepper_places',{...hpParams,...patch},hpEnv,{fetchImpl:hpFetch});
  assert.equal(invalid.reasonCode,'INVALID_INPUT',JSON.stringify(patch));
  assert.equal(hpCalls,count,'Invalid or unsupported filters must not trigger an unfiltered provider call');
}
console.log('PASS: captured Seoul population/time, stale/future/missing distinctions, sample scope, no-key/terms blocking, secret redaction, no redirects, body cap, input limits, synthetic POI schemas, and Hot Pepper keyword/unsupported-filter validation.');
console.log(JSON.stringify({verifiedFixture:{provider:parsed.provider,area:parsed.data.areaCode,observedAt:parsed.observedAt,fetchedAt:parsed.fetchedAt,freshness:parsed.freshness},testMode:'offline replay; no live-provider request is made by this test',capturedExternalResponse:'official unauthenticated Seoul POI009 sample only'},null,2));
