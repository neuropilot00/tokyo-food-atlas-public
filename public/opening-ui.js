(function(root){
'use strict';
let ui,plan,lastResult,saveError=false;
const key='opening-plan-KR-v1';
const clone=v=>JSON.parse(JSON.stringify(v));
const el=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const won=n=>Number.isFinite(n)?Math.round(n).toLocaleString('ko-KR')+'원':'미확인';
const man=n=>Number.isFinite(n)?(n/10000).toLocaleString('ko-KR',{maximumFractionDigits:1})+'만원':'미확인';
const fixed=(n,d=1)=>Number.isFinite(n)?n.toFixed(d):'미확인';
const duration=n=>Number.isFinite(n)?n.toFixed(2)+'개월':'미확인';
const clients=n=>Number.isFinite(n)?Math.ceil(n)+'명':'미확인';
const sections=[
 {title:'계약 전',items:[['building','일반음식점 신고 가능 여부','용도·면적·층수·정화조·관할 위생부서 확인'],['exhaust','배기 경로와 임대인 동의','덕트·급기·옥상/외벽 경로·냄새 민원 조건을 서면 확인'],['lease','임대차와 인수 범위','VAT·관리비·권리금·인수 집기·원상복구 범위 확인'],['quotes','같은 공사 범위로 견적 3곳','포함/제외 공사·추가금 조건·공정별 지급·하자 책임 확인']]},
 {title:'공사·채용',items:[['facility','배기·가스·전기·소방 점검','기존 시설 재사용 가능 여부와 검사·보험 적용 확인'],['staff','직원 근로계약과 근무표','휴게·휴무·주휴·준비/마감·추가근무·대체인력 비용 확인'],['yield','갈매기살 매입과 수율','공급가·정선 손실·중량·반찬·숯/가스·폐기까지 메뉴별 원가 확인'],['cash','운영자금 별도 확보','공사 예비비와 운영자금을 분리하고 주별 현금흐름 확인']]},
 {title:'개점 전',items:[['permit','교육·건강진단·영업신고','관할 안내에 따라 필요한 서류·검사·신고 완료'],['test','설비 시운전과 검수','만석 화력·흡배기·냉장 온도·누수·전력·소방 동선 점검'],['soft','시범 영업','입장부터 제공·추가주문·계산·테이블 정리까지 시간 기록'],['demand','현장 수요와 가격 검증','목표 고객 수를 채울 수 있는지 시간대별 동선·경쟁점 조사']]}
];
function numberField(label,path,value,scale=1,unit='',extra=''){
 const shown=Number.isFinite(value)?String(Number((value/scale).toFixed(6))):'';
 return '<label class="op-field"><span>'+esc(label)+'</span><span class="op-input"><input type="number" inputmode="decimal" min="0" step="any" data-op="'+esc(path)+'" data-scale="'+scale+'" value="'+shown+'" '+extra+'><small>'+esc(unit)+'</small></span></label>';
}
function selectField(label,path,value,options){
 return '<label class="op-field"><span>'+esc(label)+'</span><select data-op="'+esc(path)+'">'+options.map(o=>'<option value="'+esc(o[0])+'" '+(String(value)===String(o[0])?'selected':'')+'>'+esc(o[1])+'</option>').join('')+'</select></label>';
}
function textField(label,path,value,placeholder=''){
 return '<label class="op-field"><span>'+esc(label)+'</span><input type="text" data-op="'+esc(path)+'" value="'+esc(value||'')+'" placeholder="'+esc(placeholder)+'" maxlength="500"></label>';
}
function header(n,title,sub){return '<div class="op-section-head"><span class="op-step">'+n+'</span><div><h2>'+title+'</h2><p>'+sub+'</p></div></div>';}
function load(){
 if(saveError&&plan)return;
 const stored=ui.storage.get(key,null);
 plan=stored&&stored.schemaVersion===1?stored:root.AtlasOpeningPlan.createExample();
 plan.verification=plan.verification||{};
 plan.propertyNotes=plan.propertyNotes||{};
}
function persist(){
 plan.updatedAt=new Date().toISOString();
 saveError=!ui.storage.set(key,plan);
 const n=el('#op-save-state');
 if(n)n.textContent=saveError?'저장 실패 · 현재 화면에서 내보내기 가능':'이 기기에 저장 · 계정 연결 상태는 상단에서 확인';
 return !saveError;
}
function setPath(path,value){
 const parts=path.split('.');
 if(parts.some(k=>['__proto__','prototype','constructor'].includes(k)))return;
 let obj=plan;
 for(let i=0;i<parts.length-1;i++){if(obj[parts[i]]===undefined)obj[parts[i]]={};obj=obj[parts[i]];}
 obj[parts.at(-1)]=value;
}
function costCards(){
 return plan.costs.map((c,i)=>'<article class="op-cost"><div class="op-cost-top"><div><span class="op-kind">'+(c.kind==='deposit'?'잠기는 현금':c.kind==='capex'?'공사·설비':c.kind==='preopen'?'영업 시작 전':c.kind==='inventory'?'초기 재고':'개점 부대비')+'</span><h3>'+esc(c.label)+'</h3></div>'+numberField(c.label+' 금액','costs.'+i+'.amount',c.amount,10000,'만원')+'</div><div class="op-pair">'+selectField('부가세 기준','costs.'+i+'.vatMode',c.vatMode,[['included','포함한 현금액'],['excluded','별도 · 세율 입력'],['none','부가세 가산 없음'],['unknown','미확인']])+selectField('금액 근거','costs.'+i+'.quoteStatus',c.quoteStatus,[['assumption','계획 가정'],['quote','받은 견적'],['confirmed','직접 확인']])+'</div>'+(c.vatMode==='excluded'?numberField('부가세 가산율','costs.'+i+'.vatRate',c.vatRate,.01,'%'):'')+'<details class="op-note"><summary>견적·포함 범위 메모</summary>'+textField('업체·확인일·포함/제외 항목','costs.'+i+'.note',c.note,'예: 배기 공사는 설비 견적에 포함')+'</details></article>').join('');
}
function staffCards(){
 return plan.staff.map((s,i)=>{
 const inactive=s.onlyMode==='manager'&&plan.operationMode!=='manager';
 let fields=numberField('인원','staff.'+i+'.count',s.count,1,'명','step="1"')+selectField('급여 방식','staff.'+i+'.payType',s.payType,[['monthly','월급'],['hourly','시급']]);
 fields+=s.payType==='monthly'?numberField('1인 세전 월급','staff.'+i+'.monthlyPay',s.monthlyPay,10000,'만원'):numberField('기본 시급','staff.'+i+'.hourlyPay',s.hourlyPay,1,'원');
 fields+=numberField('1인 주 실근로','staff.'+i+'.weeklyHours',s.weeklyHours,1,'시간');
 fields+=numberField('주휴 유급시간 가정','staff.'+i+'.weeklyPaidRestHours',s.weeklyPaidRestHours,1,'시간');
 return '<article class="op-staff '+(inactive?'is-inactive':'')+'"><div class="op-staff-top"><h3>'+esc(s.role)+'</h3><button type="button" class="text-button" data-op-remove="'+i+'" aria-label="'+esc(s.role)+' 직원 행 삭제">삭제</button></div><span class="badge '+(inactive?'gray':'')+'">'+(s.onlyMode==='manager'?'직원 운영 모드에서 합산':'두 운영 모드에 포함')+'</span><div class="op-form-grid">'+textField('직군','staff.'+i+'.role',s.role)+fields+'</div><p class="op-staff-total" data-staff-result="'+esc(s.id)+'"></p></article>';
 }).join('');
}
function checklist(){
 return sections.map(s=>'<section class="op-phase"><h3>'+s.title+'</h3>'+s.items.map(([id,title,note])=>'<label class="op-check"><input type="checkbox" data-op-check="'+id+'" '+(plan.verification[id]?.done?'checked':'')+'><span><b>'+title+'</b><small>'+note+'</small></span></label><input class="op-check-note" data-op="verification.'+id+'.note" value="'+esc(plan.verification[id]?.note||'')+'" placeholder="확인일·근거 또는 남은 작업" aria-label="'+title+' 확인 근거" maxlength="500">').join('')+'</section>').join('');
}
function render(){
 load();
 if(ui.country()!=='KR')return '<section class="card empty-state"><h1>한국 개점 계획</h1><p>강남권 갈매기살 고깃집의 원화 예산 계획입니다.<br>상단 국가를 한국으로 바꾸면 이어서 볼 수 있습니다.</p><button class="button secondary" data-nav="discover">일본 업종 찾기</button></section>';
 return '<div class="op-page"><section class="op-hero"><div class="eyebrow">GANGNAM · OPENING PLAN</div><div class="op-title-row"><div><span class="op-concept">갈매기살 고깃집 · 개점 설계</span><h1>2억원으로,<br>개점부터 운영까지.</h1></div><span class="op-plan-stamp">BUDGET<br><b>200M</b><small>KRW · 기준안</small></span></div><p>직원, 인테리어, 배기·주방 설비와 운영자금까지.<br>견적을 바꾸면 총예산과 버틸 수 있는 기간을 함께 계산합니다.</p><div class="op-truth"><span>요청 기준: 강남권 · 갈매기살 · 총예산 2억원</span><span>아래 평수·급여·공사비·매출은 수정 가능한 계획 가정입니다.</span></div></section><div id="op-overview" aria-live="polite"></div><div class="op-toolbar"><div class="op-mode" role="group" aria-label="운영 방식"><button data-op-mode="owner" class="'+(plan.operationMode==='owner'?'active':'')+'">대표 상근</button><button data-op-mode="manager" class="'+(plan.operationMode==='manager'?'active':'')+'">직원 운영</button></div><button class="button secondary small" data-op-action="save">계획 저장</button></div><p class="op-save-state" id="op-save-state">'+(saveError?'저장 실패 · 내보내기로 현재 계획을 보관하세요.':plan.updatedAt?'저장된 개점 계획 · 계정 연결 상태는 상단에서 확인':'계획 예시 · 저장하면 계정별 기록으로 보관합니다.')+'</p><nav class="op-jumps" aria-label="개점 계획 항목"><a href="#op-budget">전체 예산</a><a href="#op-staff">직원</a><a href="#op-monthly">월 운영</a><a href="#op-property">매물·견적</a><a href="#op-ready">개점 준비</a></nav><div class="op-content"><section id="op-budget" class="op-section">'+header('01','돈이 어디에 들어가는지','기존 음식점 25평 안팎 · 32석을 검토하는 예시입니다. 도면과 시설 상태는 미확인입니다.')+'<div class="op-form-grid op-basics">'+numberField('조달 가능한 총예산','budget',plan.budget,10000,'만원')+selectField('개점연도 가정','openingYear',plan.openingYear,[['','미정'],['2026','2026년'],['2027','2027년']])+'</div><div class="op-cost-grid">'+costCards()+'</div><div class="op-reserves"><div>'+numberField('공사 예비비 · 별도 보관','contingency',plan.contingency,10000,'만원')+'<p>추가 공사와 견적 오차 대응용입니다. 운영자금에 중복 합산하지 않습니다.</p></div><div>'+numberField('개점 후 운영준비금','reserve',plan.reserve,10000,'만원')+'<p>월세·직원·대표 인출 등 개점 이후 현금 지출용입니다.</p></div></div><p class="op-footnote">보증금은 월 비용이 아닌 잠기는 현금입니다. 권리금에 포함된 설비는 별도 설비비에서 빼고, 초기 재고는 매달 고정비에 다시 넣지 않습니다. 부가세 환급 예상액은 조달액에서 미리 차감하지 않습니다.</p></section><section id="op-staff" class="op-section">'+header('02','직원을 넣고, 실제 월 부담까지','급여는 채용 시세를 검증한 값이 아닙니다. 직원 휴무·휴게와 대표 업무시간을 포함한 근무표가 필요합니다.')+'<div id="op-payroll-summary" class="op-panel"></div><div class="op-staff-grid">'+staffCards()+'</div><button class="button secondary small" data-op-action="add-staff">+ 직원 행 추가</button><div class="op-form-grid op-rate-fields">'+numberField('사업주 보험 등 준비율','payroll.insuranceReserveRate',plan.payroll.insuranceReserveRate,.01,'%')+numberField('퇴직급여 월 적립 계획률','payroll.retirementReserveRate',plan.payroll.retirementReserveRate,.01,'%')+numberField('시급직 월 환산 주수','payroll.weeksPerMonth',plan.payroll.weeksPerMonth,1,'주')+'</div><p class="op-footnote">두 비율은 법정 단일요율이 아닌 자금계획입니다. 실제 가입·산정기준, 주휴·연장·야간·휴일근로와 퇴직급여는 근로조건에 따라 확인합니다. 대표 인출은 직원 급여와 별도입니다.</p></section><section id="op-monthly" class="op-section">'+header('03','매출이 없을 때와 손익분기','월세·관리비·객단가는 부가세를 포함한 납부액과 결제액으로 입력하세요. 실제 세금 정산은 별도입니다. 기타 고정지출에는 직원 비용·대표 인출·개점 전 같은 기간에 선납한 금액을 중복 넣지 마세요.')+'<div class="op-form-grid">'+numberField('월세 납부액 · VAT 포함','monthly.rent',plan.monthly.rent,10000,'만원')+numberField('월 관리비 납부액','monthly.management',plan.monthly.management,10000,'만원')+numberField('월 공과금 기본분','monthly.utilities',plan.monthly.utilities,10000,'만원')+numberField('기타 월 고정지출','monthly.otherFixed',plan.monthly.otherFixed,10000,'만원')+numberField('대표 월 인출 · 생활비 등','monthly.ownerDraw',plan.monthly.ownerDraw,10000,'만원')+numberField('월 대출 원금 상환','monthly.debtPrincipal',plan.monthly.debtPrincipal,10000,'만원')+numberField('대표 인출 후 목표 월 잉여','monthly.targetSurplus',plan.monthly.targetSurplus,10000,'만원')+numberField('확보할 무매출 운영기간','targetReserveMonths',plan.targetReserveMonths,1,'개월')+'</div><details class="op-expand" open><summary>객단가·원가·좌석 가정</summary><div class="op-form-grid">'+numberField('1인 총 결제액','sales.ticket',plan.sales.ticket,1,'원')+numberField('월 영업일','sales.days',plan.sales.days,1,'일')+numberField('좌석','sales.seats',plan.sales.seats,1,'석')+numberField('하루 좌석 회전','sales.turns',plan.sales.turns,1,'회')+numberField('평균 착석률 가정','sales.occupancy',plan.sales.occupancy,.01,'%')+numberField('식재료 매입·폐기 비율','sales.foodRate',plan.sales.foodRate,.01,'%')+numberField('기타 매출 연동 지출 비율','sales.otherVariableRate',plan.sales.otherVariableRate,.01,'%')+numberField('별도 세금 준비율 가정','sales.taxReserveRate',plan.sales.taxReserveRate,.01,'%')+numberField('하루 고객 영업시간','sales.openHours',plan.sales.openHours,1,'시간')+numberField('평균 테이블 이용시간','sales.visitMinutes',plan.sales.visitMinutes,1,'분')+'</div><p class="op-footnote">세금 준비율은 실제 부가세·소득세·법인세율이나 납부세액이 아닙니다. 수익성 확정에는 세무 검토가 필요합니다. 식재료에는 정선 손실·반찬·폐기를 포함하고, 공과금 기본분과 매출 연동분을 중복 넣지 마세요. 영업시간·체류시간이 비어 있으면 회전 수를 검증할 수 없습니다.</p></details><div id="op-monthly-results" aria-live="polite"></div><div id="op-scenarios"></div></section><section id="op-property" class="op-section">'+header('04','실제 매물과 견적으로 바꾸기','금액만 맞아도 배기·용도·소방 조건이 해결되지 않으면 개점할 수 없습니다.')+'<div class="op-property-layout"><div class="op-panel"><span class="badge amber">매물 검색 상한 · 시세 아님</span><h3>기존 음식점 시설 활용</h3><p id="op-property-assumptions"></p><p class="op-footnote">현재 공실이나 이 조건의 매물이 확보됐다는 뜻은 아닙니다. 전체 철거·신규 덕트 공사는 별도 견적이 필요합니다.</p><button class="button secondary small" data-op-action="import-property">등록한 매물 금액 가져오기</button><button class="text-button" data-nav="places">매물 직접 등록 화면 →</button></div><div class="op-form-grid">'+textField('검토 매물 주소','propertyNotes.address',plan.propertyNotes.address,'아직 계약 매물 미정')+textField('견적 기준일·원문 URL','propertyNotes.source',plan.propertyNotes.source,'확인한 자료의 주소 또는 날짜')+textField('배기·시설·공사 특이사항','propertyNotes.facilities',plan.propertyNotes.facilities,'공용 덕트, 전기 증설, 냄새 배출 경로 등')+textField('임대료·권리금 포함 범위','propertyNotes.lease',plan.propertyNotes.lease,'VAT, 관리비 항목, 인수 집기 목록')+'</div></div></section><section id="op-ready" class="op-section">'+header('05','개점 전 확인할 것','체크는 대표님의 확인 기록입니다. 서류·현장·전문가 검토를 자동으로 인증하지 않습니다.')+'<div id="op-check-progress"></div><div class="op-phase-grid">'+checklist()+'</div></section><section class="op-section op-end"><div><h2>가정을 바꾸고, 계획을 남기세요.</h2><p>초기 예산·직원 명세·VAT 구분·확인 기록까지 함께 저장합니다.</p></div><div class="button-row"><button class="button" data-op-action="save">계획 저장</button><button class="button secondary" data-op-action="export">계획 JSON 내보내기</button><button class="button secondary" data-op-action="print">인쇄 / PDF</button></div><details class="op-expand"><summary>확정 조건만 남겨 새 계획 작성</summary><p>현재 계획은 먼저 내보내 주세요. 새 계획은 강남권·갈매기살·예산2억원 외 입력을 비웁니다.</p><button class="button secondary small" data-op-action="empty">빈 계획으로 전환</button><button class="button secondary small" data-op-action="example">2억원 예시 다시 불러오기</button></details><div class="op-source-links"><h3>공식 확인 자료</h3><a href="https://www.moel.go.kr/news/enews/report/enewsView.do?news_seq=18144" target="_blank" rel="noopener noreferrer">2026 최저임금 · 고용노동부 ↗</a><a href="https://www.moel.go.kr/news/enews/report/enewsView.do?news_seq=19744" target="_blank" rel="noopener noreferrer">2027 최저임금 · 고용노동부 ↗</a><a href="https://health.gangnam.go.kr/web/hygiene/report/food/sub01.do" target="_blank" rel="noopener noreferrer">강남구 일반음식점 신고 ↗</a><a href="https://www.seocho.go.kr/site/seocho/ex/bbs/View.do?bcIdx=390695&amp;cbIdx=443" target="_blank" rel="noopener noreferrer">서초구 영업신고 안내 ↗</a></div><p class="op-footnote">금액과 직원 구성은 계획 예시입니다. 채용·견적·수요·허가가 확보되어 개점이 확정된 상태는 아닙니다.</p></section></div></div>';
}
function metric(label,value,note=''){return '<div class="op-metric"><span>'+label+'</span><strong>'+value+'</strong>'+(note?'<small>'+note+'</small>':'')+'</div>';}
function issueText(issue){
 const path=String(issue.path||''),field=document.querySelector('[data-op="'+path.replace(/\[(\d+)\]/g,'.$1')+'"]');
 const label=field?.closest('label')?.querySelector('span')?.textContent||({operationMode:'운영 방식',openingYear:'개점연도',staff:'직원 명세','sales.totalVariableRate':'변동비·세금 준비율 합계'}[path])||'계산 입력';
 return path?String(issue.message||'입력을 확인하세요.').split(path).join(label):String(issue.message||'입력을 확인하세요.');
}
function capacityVisual(m,c){
 const planned=c.plannedCustomersPerDay,required=m.ownerBepCustomersPerDay,maximum=c.maxCustomersPerDay;
 if(![planned,required,maximum].every(Number.isFinite))return '<div class="notice">좌석·영업일·객단가를 입력하면 필요한 고객 수를 그림으로 비교합니다.</div>';
 const scale=Math.max(planned,required,maximum,1);
 const rows=[['가정한 방문 고객',planned,'#28634c'],['대표 인출 충당 필요',required,'#d5ac64'],['좌석 처리 상한',maximum,'#9aada0']];
 return '<section class="op-customer-chart" aria-label="하루 고객 수 비교"><h3>하루 몇 명이 와야 할까요?</h3>'+rows.map(([label,n,color])=>'<div class="atlas-compare-row"><div><span>'+label+'</span><b>'+fixed(n,1)+'명 / 일</b></div><div class="atlas-compare-track"><i style="width:'+(n/scale*100)+'%;background:'+color+'"></i></div></div>').join('')+'<p class="op-footnote">예상 방문객이 아닌 입력 가정의 비교입니다. 처리 상한도 대기·정리·직원 동선을 별도로 검증해야 합니다.</p></section>';
}
function resultRow(label,value){return '<div class="op-result-row"><span>'+label+'</span><b>'+value+'</b></div>';}
function summary(r){
 const i=r.initial||{},run=r.runway||{},ready=Number.isFinite(i.totalAllocated),over=Number.isFinite(i.budgetDifference)&&i.budgetDifference<0;
 const checked=plan.costs.filter(c=>c.quoteStatus!=='assumption').length;
 let blocks='<div class="op-status '+(over?'danger':'')+'"><span class="op-status-dot"></span><b>'+(over?'총예산 '+man(-i.budgetDifference)+' 초과':!ready?'미입력·부가세 기준 확인 필요':'계획상 예산 내 · 견적 확인 필요')+'</b><span>견적·직접 확인 '+checked+'/'+plan.costs.length+'항목</span></div>';
 blocks+='<div class="op-metrics">'+metric('총 배정액',man(i.totalAllocated),over?'추가 자금 또는 항목 조정 필요':(Number.isFinite(i.budgetDifference)?'미배정 '+man(Math.max(0,i.budgetDifference)):'미확인 항목 포함'))+metric('예산 내 배정 가능한 운영자금',man(i.fundedReserve),'공사 예비비 별도')+metric('매출 0원 버틸 기간',duration(run.months),'대표 인출·직원 적립 포함 가정')+'</div>';
 const segments=[['보증금',i.depositLocked,'deposit'],['개점 지출',Number.isFinite(i.costCash)?i.costCash-i.depositLocked:null,'setup'],['공사 예비',i.contingency,'contingency'],['운영 준비',i.reserve,'reserve']];
 if(ready&&i.totalAllocated>0)blocks+='<div class="op-budget-bar" aria-label="예산 배분">'+segments.map(([name,n,c])=>'<span class="'+c+'" style="width:'+Math.max(0,n/i.totalAllocated*100)+'%" title="'+name+' '+man(n)+'"></span>').join('')+'</div><div class="op-budget-legend">'+segments.map(([name,n,c])=>'<span><i class="'+c+'"></i>'+name+' <b>'+man(n)+'</b></span>').join('')+'</div>';
 if(run.reachesTarget===false)blocks+='<div class="notice amber"><b>'+fixed(run.targetMonths,1)+'개월 운영목표까지 '+man(run.shortfall)+' 부족합니다.</b><p>공사비 또는 운영 조건을 바꾸거나 추가 재원을 확보해야 합니다. 공사 예비비를 운영자금으로 중복 계산하지 않았습니다.</p></div>';
 const problems=[...(r.errors||[]).map(issueText),...(r.missing||[]).map(issueText)];
 if(problems.length)blocks+='<div class="op-validation" role="status"><b>입력을 확인해 주세요</b><ul>'+problems.slice(0,7).map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>'+(problems.length>7?'<span>그 외 '+(problems.length-7)+'개 항목 미확인</span>':'')+'</div>';
 const critical=(r.warnings||[]).filter(w=>['BELOW_WAGE_REFERENCE','CAPACITY_BELOW_OWNER_BEP','TURN_TIME_CONFLICT','SALARY_HOURS_UNVERIFIED','NO_ACTIVE_STAFF'].includes(w.code));
 if(critical.length)blocks+='<details class="op-warning-list" open><summary>근무·수용 조건 확인 '+critical.length+'건</summary><ul>'+critical.map(w=>'<li>'+esc(w.message)+'</li>').join('')+'</ul></details>';
 return blocks;
}
function update(){
 if(!el('#op-overview'))return;
 const r=root.AtlasOpeningPlan.calculate(plan);lastResult=r;
 el('#op-overview').innerHTML=summary(r);
 const cashFor=id=>r.initial?.rows?.find(c=>c.id===id)?.cash;
 el('#op-property-assumptions').innerHTML='25평 안팎 / '+fixed(plan.sales.seats,0)+'석 검토<br>보증금 '+man(cashFor('deposit'))+' / 권리금 현금액 '+man(cashFor('transfer'))+'<br>월세 납부액 '+man(plan.monthly.rent)+' 가정';
 const s=r.staff||{};
 el('#op-payroll-summary').innerHTML='<div class="op-metrics compact">'+metric('직원 세전급여',man(s.wageBase))+metric('보험·퇴직 준비',man((s.insuranceReserve??NaN)+(s.retirementReserve??NaN)))+metric('직원 월 현금계획',man(s.totalCash))+'</div><p>대표 생활비 인출 '+man(plan.monthly.ownerDraw)+'은 아래 월 지출에서 별도 반영합니다.</p>';
 document.querySelectorAll('[data-staff-result]').forEach(n=>{const row=(s.rows||[]).find(x=>x.id===n.dataset.staffResult);n.textContent=row?(row.active===false?'현재 모드에서 제외':('세전 '+man(row.wageBase)+' + 준비 '+man((row.insuranceReserve??NaN)+(row.retirementReserve??NaN))+' = 월 '+man(row.totalCash))):'현재 모드에서 제외';});
 const m=r.monthly||{},c=r.capacity||{},run=r.runway||{};
 el('#op-monthly-results').innerHTML='<div class="op-finance-result"><div class="op-metrics">'+metric('매출 0원 월 지출',man(m.zeroRevenueBurn),'대표 인출·원금·적립 포함')+metric('대표 인출까지 충당',clients(m.ownerBepCustomersPerDay)+'/일','세금 준비율 반영 현금 기준')+metric('목표 잉여까지 필요한 고객',clients(m.targetBepCustomersPerDay)+'/일','월 잉여 '+man(plan.monthly.targetSurplus)+' 가정')+'</div>'+capacityVisual(m,c)+'<div class="op-result-grid"><div>'+resultRow('영업 고정 현금지출',man(m.businessFixedCash))+resultRow('대표 월 인출',man(m.ownerDraw))+resultRow('대출 원금 상환',man(m.debtPrincipal))+resultRow('필요 운영준비금',man(run.requiredReserve))+'</div><div>'+resultRow('입력 좌석·회전의 월 결제액',man(m.revenue))+resultRow('매출 연동 지출·세금 준비',man((m.variableCosts??NaN)+(m.taxReserve??NaN)))+resultRow('대표 인출·원금 후 잔여현금',man(m.afterDebtSurplus))+resultRow('필요 월 결제액 · 대표 인출 포함',man(m.ownerBepRevenue))+'</div></div><p class="op-footnote">위 결제액은 좌석 × 회전 × 착석률 × 객단가 × 영업일로 계산한 가정이며 수요 예측이 아닙니다. 잔여현금은 회계상 영업이익·세후 순이익이 아닙니다. 세금 준비금의 실제 정산과 초기 투자금 회수는 별도입니다.</p><div class="op-capacity '+(c.ownerCapacityFeasible===false||c.turnsExceedHours?'danger':'')+'"><b>좌석으로 처리할 수 있는가</b><span>100% 착석 상한 '+fixed(c.maxCustomersPerDay,0)+'명/일 · 입력 착석률 고객 '+fixed(c.plannedCustomersPerDay,1)+'명/일</span><span>대표 인출 충당에 필요한 착석률 '+(Number.isFinite(c.ownerRequiredOccupancy)?fixed(c.ownerRequiredOccupancy*100,1)+'%':'미확인')+'</span><span>'+(c.turnsExceedHours?'영업시간·체류시간으로 가능한 회전 수를 초과했습니다.':Number.isFinite(c.maxTurnsByHours)?'영업시간 기준 회전 상한 '+fixed(c.maxTurnsByHours,1)+'회 · 대기·정리시간은 추가 확인':'영업시간·체류시간 미입력: 회전 수의 현실성은 미검증입니다.')+'</span></div></div>';
 let table='<div class="op-panel op-scenario"><h3>대표 상근과 직원 운영 비교</h3><p>급여·공사비는 같게 두고, 직원 운영은 점장 행을 추가합니다. 대표 인출은 두 모드 모두 유지됩니다.</p><div class="op-table-scroll"><table><thead><tr><th>운영안</th><th>월 현금 소진</th><th>무매출 기간</th><th>필요 고객/일</th></tr></thead><tbody>';
 for(const [k,label]of [['owner','대표 상근'],['manager','직원 운영']]){const x=r.modes?.[k];table+='<tr><th>'+label+'</th><td>'+man(x?.monthly?.zeroRevenueBurn)+'</td><td>'+duration(x?.runway?.months)+'</td><td>'+clients(x?.monthly?.ownerBepCustomersPerDay)+'</td></tr>';}
 table+='</tbody></table></div></div>';
 const stressed=clone(plan);stressed.costs.forEach(x=>{if(x.kind==='capex'&&Number.isFinite(x.amount))x.amount*=1.2;});if(Number.isFinite(stressed.monthly.rent))stressed.monthly.rent+=1000000;
 const grossStress=root.AtlasOpeningPlan.calculate(stressed),extra=Number.isFinite(grossStress.initial.costCash)&&Number.isFinite(r.initial.costCash)?Math.max(0,grossStress.initial.costCash-r.initial.costCash):null;
 const used=Number.isFinite(extra)&&Number.isFinite(plan.contingency)?Math.min(extra,plan.contingency):null;if(Number.isFinite(used))stressed.contingency=plan.contingency-used;
 const sr=root.AtlasOpeningPlan.calculate(stressed);
 table+='<div class="op-stress"><span class="badge amber">조건 악화 시험</span><h3>공사·설비 +20%, 월세 +100만원이면</h3><div class="op-metrics compact">'+metric('총예산 초과',Number.isFinite(sr.initial?.budgetDifference)?man(Math.max(0,-sr.initial.budgetDifference)):'미확인')+metric('배정 가능한 운영자금',man(sr.initial?.fundedReserve))+metric('버틸 기간',duration(sr.runway?.months))+'</div><p>추가 공사비 '+man(extra)+'에 공사 예비비 '+man(used)+'을 먼저 사용한 가정입니다. 남는 공사 예비비는 '+man(stressed.contingency)+'입니다. 예비비를 넘는 금액만큼 운영자금이 줄어들며, 이 시험은 현재 계획을 덮어쓰지 않습니다.</p></div>';
 el('#op-scenarios').innerHTML=table;
 updateChecks();
}
function updateChecks(){
 const total=sections.flatMap(s=>s.items).length,done=sections.flatMap(s=>s.items).filter(([id])=>plan.verification?.[id]?.done).length;
 if(el('#op-check-progress'))el('#op-check-progress').innerHTML='<div class="op-progress"><span>직접 확인 '+done+' / '+total+'</span><progress max="'+total+'" value="'+done+'"></progress><b>'+(done===total?'기록 완료 · 실제 서류·견적 최종 검토 필요':'미확인 '+(total-done)+'개')+'</b></div>';
}
function refresh(){persist();ui.render();}
function exportPlan(){
 const report={format:'atlas-opening-plan-v1',exportedAt:new Date().toISOString(),plan:clone(plan),calculation:root.AtlasOpeningPlan.calculate(plan)};
 const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='gangnam-galmaegisal-opening-plan.json';a.click();root.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function importProperty(){
 const properties=ui.allProperties().filter(p=>p.manual);
 if(!properties.length){ui.toast('매물 & 손익에서 실제 매물 정보를 먼저 등록해 주세요.');ui.navigate('places');return;}
 ui.openDialog('등록 매물의 비용 가져오기','<form id="op-import-form" class="stack-form"><p>등록된 원문 금액의 부가세 기준을 확인해 주세요. 미확인 금액은 현재 계획을 유지하고, 현금 납부액으로 환산합니다.</p><label>매물<select name="property">'+properties.map((p,i)=>'<option value="'+i+'">'+esc(p.title)+'</option>').join('')+'</select></label><label>월세·관리비 원문 기준<select name="monthlyVat" required><option value="">확인 후 선택</option><option value="included">부가세 포함 납부액</option><option value="excluded">부가세 별도 · 10% 추가 계획</option></select></label><label>권리금 원문 기준<select name="transferVat" required><option value="">확인 후 선택</option><option value="included">세금 포함 현금액</option><option value="excluded">세금 별도 · 10% 추가 계획</option><option value="none">세금 가산 없음 확인</option><option value="unknown">미확인</option></select></label><button class="button wide">계획에 적용</button></form>');
 el('#op-import-form').onsubmit=e=>{e.preventDefault();const form=new FormData(e.target),p=properties[Number(form.get('property'))];if(!p)return;const factor=form.get('monthlyVat')==='excluded'?1.1:1;for(const field of ['rent','management'])if(Number.isFinite(p[field]))plan.monthly[field]=Math.round(p[field]*factor);for(const field of ['deposit','transfer']){const c=plan.costs.find(x=>x.id===field);if(c&&Number.isFinite(p[field])){c.amount=p[field];c.vatMode=field==='deposit'?'none':String(form.get('transferVat'));c.quoteStatus='quote';c.note=(p.title||'')+' · '+(p.sourceDate||'확인일 미입력')+' · '+(p.source||'');}}plan.propertyNotes.address=p.localTitle||'';plan.propertyNotes.source=p.source||'';plan.propertyNotes.lease=p.taxNote||p.note||'';plan.propertyRef={id:p.id,title:p.title,importedAt:new Date().toISOString()};el('#detail-dialog').close();refresh();ui.toast('확인한 매물 금액을 적용했습니다. 달라진 예산과 운영기간을 확인하세요.');};
}
function init(context){
 ui=context;
 if(!document.querySelector('link[data-opening-style]')){const link=document.createElement('link');link.rel='stylesheet';link.href='/opening.css';link.dataset.openingStyle='true';document.head.appendChild(link);}
 document.addEventListener('input',e=>{
  const t=e.target;if(!t.dataset.op||!el('.op-page'))return;
  let value=t.value;
  if(t.type==='number')value=t.value.trim()===''?null:Number(t.value)*Number(t.dataset.scale||1);
  if(t.tagName==='SELECT')return;
  setPath(t.dataset.op,value);persist();update();
 });
 document.addEventListener('change',e=>{
  const t=e.target;if(!el('.op-page'))return;
  if(t.dataset.opCheck){const id=t.dataset.opCheck;plan.verification[id]={...(plan.verification[id]||{}),done:t.checked,checkedAt:t.checked?new Date().toISOString():null};persist();updateChecks();return;}
  if(t.dataset.op&&t.tagName==='SELECT'){setPath(t.dataset.op,t.dataset.op==='openingYear'?(t.value?Number(t.value):null):t.value);if(t.dataset.op.endsWith('.payType')||t.dataset.op.endsWith('.vatMode'))refresh();else{persist();update();}}
 });
 document.addEventListener('click',e=>{
  const t=e.target.closest('[data-op-mode],[data-op-action],[data-op-remove],.op-jumps a');if(!t||!el('.op-page'))return;
  if(t.matches('.op-jumps a')){e.preventDefault();const target=document.getElementById(t.getAttribute('href').slice(1));target?.scrollIntoView({behavior:'smooth',block:'start'});return;}
  if(t.dataset.opMode){plan.operationMode=t.dataset.opMode;refresh();return;}
  if(t.dataset.opRemove!==undefined){const old=clone(plan.staff);plan.staff.splice(Number(t.dataset.opRemove),1);refresh();ui.openDialog('직원 행을 삭제했습니다','<p>이번 변경을 되돌릴 수 있습니다.</p><button class="button wide" id="op-undo-staff">되돌리기</button>');el('#op-undo-staff').onclick=()=>{plan.staff=old;el('#detail-dialog').close();refresh();};return;}
  switch(t.dataset.opAction){
   case 'save':if(persist())ui.toast('개점 계획을 저장했습니다. 상단에서 계정 동기화 상태를 확인하세요.');else ui.toast('저장하지 못했습니다. 계획을 내보내 보관해 주세요.');break;
   case 'export':exportPlan();break;
   case 'print':root.print();break;
   case 'import-property':importProperty();break;
   case 'add-staff':plan.staff.push({id:'custom-'+Date.now(),role:'추가 직원',count:1,payType:'monthly',monthlyPay:null,hourlyPay:null,weeklyHours:null,weeklyPaidRestHours:null,onlyMode:'both'});refresh();el('#op-staff').scrollIntoView({block:'start'});break;
   case 'empty':case 'example':{const prior=clone(plan);plan=t.dataset.opAction==='empty'?root.AtlasOpeningPlan.createEmpty():root.AtlasOpeningPlan.createExample();plan.verification={};plan.propertyNotes={};refresh();ui.openDialog('새 계획을 불러왔습니다','<p>기존 내용으로 되돌릴 수 있습니다. 내보낸 파일은 유지됩니다.</p><button class="button wide" id="op-undo-plan">이전 계획으로 되돌리기</button>');el('#op-undo-plan').onclick=()=>{plan=prior;el('#detail-dialog').close();refresh();};break;}
  }
 });
}
root.AtlasOpeningUI={init,render,afterRender:update};
})(window);

