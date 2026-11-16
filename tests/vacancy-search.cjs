const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('public/app.js','utf8');
const fn=source.slice(source.indexOf('function tokyoVacancySearch()'),source.indexOf('function openPropertyDiscovery()'));
const ctx={state:{country:'JP'}};vm.createContext(ctx);vm.runInContext(fn,ctx);
const html=vm.runInContext('tokyoVacancySearch()',ctx);
assert.match(html,/https:\/\/akitenpo\.tokyo\/search\//);assert.match(html,/noopener noreferrer/);assert.match(html,/자동 수집·실시간 연동이 아니며/);assert.match(html,/현재 공실은 미확인/);assert.match(html,/data-beta="add-property"/);
ctx.state.country='KR';assert.equal(vm.runInContext('tokyoVacancySearch()',ctx),'');
assert.match(source,/propertyWorkflow\(\)\+tokyoVacancySearch\(\)/);
console.log('Tokyo vacancy search link checks passed');
