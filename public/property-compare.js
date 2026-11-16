(function(factory){'use strict';var api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(typeof window!=='undefined')window.AtlasPropertyCompare=api;})(function(){
'use strict';
const valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const sum=(a,b)=>valid(a)&&valid(b)&&Number.isFinite(a+b)?a+b:null;
function analyze(p,today=new Date()){
 const normalizedDate=String(p.sourceDate||'').replaceAll('.','-');
 const date=/^\d{4}-\d{2}-\d{2}$/.test(normalizedDate)?Date.parse(normalizedDate+'T00:00:00Z'):NaN;
 const exactDate=Number.isFinite(date)&&new Date(date).toISOString().slice(0,10)===normalizedDate;
 const age=exactDate?Math.floor((today.getTime()-date)/86400000):null;
 const base=sum(p.rent,p.management);const extra=p.additionalMonthly===undefined?0:p.additionalMonthly;
 return {monthly:sum(base,extra),upfront:sum(p.deposit,p.transfer),ageDays:age,stale:age===null||age>=30||age<0,missing:['rent','management','deposit','transfer',...(p.additionalMonthly!==undefined?['additionalMonthly']:[])].filter(k=>!valid(p[k]))};
}
function csvCell(v){let s=String(v??'');if(/^(?:\s*[=+\-@]|[\t\r])/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
function csv(properties,currency){const fields=['매물','주소','통화','월세','관리비','추가 월비용(기록된 항목)','월 임차비 합계','보증금','권리금·양도금','초기 임차현금 합계','자료 확인일','원문','검토 주의'];return '\ufeff'+[fields,...properties.map(p=>{const a=analyze(p);return[p.title,p.localTitle,currency,p.rent,p.management,p.additionalMonthly,a.monthly,p.deposit,p.transfer,a.upfront,p.sourceDate,p.source,'공실·세금·운영 허용 미확인. 공란은 0원이 아님. 공사·직원·중개료 등 제외.'];})].map(r=>r.map(csvCell).join(',')).join('\r\n');}
function open(ui){
 const all=ui.properties.slice(0,100),selected=new Set(all.slice(0,3).map((_,i)=>i));
 const esc=ui.esc,amount=n=>valid(n)?ui.money(n):'미확인';
 ui.openDialog('매물 비교 · 임차비 견적',`<p class="chart-note">같은 국가·통화의 매물을 최대 3개 비교합니다. 임차비 비교이며 전체 창업 견적이 아닙니다.</p><div id="compare-choices" class="compare-choices"></div><div id="property-comparison" aria-live="polite"></div><button class="button wide" id="compare-download">선택 매물 비교표 내려받기 (CSV)</button>`);
 const choices=document.getElementById('compare-choices'),output=document.getElementById('property-comparison');
 choices.innerHTML=all.map((p,i)=>`<label><input type="checkbox" data-compare-index="${i}" ${selected.has(i)?'checked':''}>${esc(p.title)}</label>`).join('')||'<p>먼저 검토할 매물을 등록해 주세요.</p>';
 function draw(){const rows=[...selected].map(i=>all[i]),max=Math.max(1,...rows.map(p=>analyze(p).monthly||0));output.innerHTML='<div class="property-comparison-grid">'+rows.map(p=>{const a=analyze(p);let href='';try{const u=new URL(p.source);if(['http:','https:'].includes(u.protocol))href=u.href;}catch{}return `<article class="compare-card"><span class="badge">${p.manual?'직접 등록':'공개 참고 · 공실 미확인'}</span><h3>${esc(p.title)}</h3><p>${esc(p.localTitle||'주소 미확인')}</p><strong class="compare-amount">${amount(a.monthly)}<small> / 월 임차비</small></strong><div class="compare-meter" aria-hidden="true"><i style="width:${a.monthly===null||a.monthly===0?0:Math.max(1,a.monthly/max*100)}%"></i></div><dl><dt>월세</dt><dd>${amount(p.rent)}</dd><dt>관리비</dt><dd>${amount(p.management)}</dd>${p.additionalMonthly!==undefined?`<dt>추가 월비용</dt><dd>${amount(p.additionalMonthly)}</dd>`:''}<dt>보증금</dt><dd>${amount(p.deposit)}</dd><dt>권리금·양도금</dt><dd>${amount(p.transfer)}</dd><dt>초기 임차현금</dt><dd>${amount(a.upfront)}</dd><dt>확인일</dt><dd>${esc(p.sourceDate||'미기록')}</dd></dl><p class="chart-note">${esc(p.taxNote||'세금 포함 여부 확인 필요')} · ${p.manual?'사용자 입력 기록':'원문 광고 기록, 현재 조건 재확인 필요'}</p>${a.stale?'<p class="notice amber">자료 확인일이 없거나 유효하지 않거나 30일 이상 지났습니다. 계약 전 재확인하세요.</p>':''}${a.missing.length?'<p class="chart-note">미확인 비용이 있습니다. 공란은 0원으로 계산하지 않습니다.</p>':''}${href?`<a href="${esc(href)}" target="_blank" rel="noopener noreferrer" class="button secondary">매물 원문 확인 ↗</a>`:''}</article>`;}).join('')+'</div><p class="chart-note">보증금은 회수 가능성이 있는 예치금이며 권리금과 구분됩니다. 중개료·보증회사·세금·보험·공사·인건비·운영자금 등은 제외되어 있습니다. 실제 견적과 공실은 공급자에게 확인하세요.</p>';document.getElementById('compare-download').disabled=!rows.length;}
 choices.onchange=e=>{const n=Number(e.target.dataset.compareIndex);if(!Number.isInteger(n)||!all[n])return;if(e.target.checked){if(selected.size>=3){e.target.checked=false;return;}selected.add(n);}else selected.delete(n);draw();};
 document.getElementById('compare-download').onclick=()=>{const rows=[...selected].map(i=>all[i]);const url=URL.createObjectURL(new Blob([csv(rows,ui.currency)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='atlas-property-comparison-'+ui.country+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};draw();
}
return{analyze,csv,open};
});
