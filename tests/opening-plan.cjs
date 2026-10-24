'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function load(relative) {
  const path = require.resolve(relative), module = { exports: {} }, window = {};
  vm.runInThisContext('(function(module, window) {\n' + fs.readFileSync(path, 'utf8') + '\n})', { filename: path })(module, window);
  return { api: module.exports, window };
}
const { api, window } = load('../public/opening-plan.js');
const domain = load('../public/domain.js').api;
const close = (actual, expected) => assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= Math.max(1e-7, Math.abs(expected) * 1e-12), `${actual} should equal ${expected}`);
const copy = v => JSON.parse(JSON.stringify(v));
let passed = 0;
function test(name, fn) { fn(); passed++; console.log('PASS ' + name); }

test('2억원 예시는 개점 현금·잠긴 보증금·두 준비금을 구분한다', () => {
  const p = api.createExample(), r = api.calculate(p);
  assert.equal(r.valid, true); assert.equal(r.complete, true);
  assert.equal(r.initial.costCash, 130000000);
  assert.equal(r.initial.depositLocked, 40000000);
  assert.equal(r.initial.nonDepositOpeningCash, 90000000);
  assert.equal(r.initial.totalAllocated, 200000000);
  assert.equal(r.initial.budgetDifference, 0);
  assert.equal(r.initial.fundedReserve, 60000000);
  assert.equal(r.conceptId, 'pork_galmaegisal');
  assert.equal(r.capacity.turnsValidationStatus, 'unverified');
  assert.ok(r.warnings.some(x => x.code === 'TURN_CAPACITY_UNVERIFIED'));
});

test('직원 보험·퇴직 준비금은 기본급에 각각 한 번만 더한다', () => {
  const r = api.calculate(api.createExample()), wages = 3200000 + 2800000 + 12000 * 24 * 4.345238;
  close(r.staff.wageBase, wages);
  close(r.staff.insuranceReserve, wages * .117);
  close(r.staff.retirementReserve, wages * .0833);
  close(r.staff.totalCash, wages * (1 + .117 + .0833));
  close(r.monthly.businessFixedCash, 5400000 + r.staff.totalCash);
  close(r.monthly.zeroRevenueBurn, 17103889.6813632);
  close(r.runway.months, 60000000 / 17103889.6813632);
  assert.equal(r.runway.reachesTarget, true);
});

test('점장 급여와 준비금만 추가하며 대표 인출은 유지한다', () => {
  const p = api.createExample(); p.operationMode = 'manager';
  const r = api.calculate(p), owner = r.modes.owner, manager = r.modes.manager;
  close(manager.staff.totalCash - owner.staff.totalCash, 3800000 * (1 + .117 + .0833));
  assert.equal(manager.monthly.ownerDraw, 3000000);
  close(r.monthly.zeroRevenueBurn, 21665029.6813632);
  close(r.runway.months, 60000000 / 21665029.6813632);
  close(r.runway.shortfall, 3 * 21665029.6813632 - 60000000);
  assert.equal(r.runway.reachesTarget, false);
  p.monthly.ownerDraw = 0;
  const noDraw = api.calculate(p);
  close(noDraw.monthly.zeroRevenueBurn, 18665029.6813632);
  assert.ok(noDraw.runway.months > 3);
});

test('식재료·기타 변동비와 세금 준비율은 중복되지 않는다', () => {
  const r = api.calculate(api.createExample());
  close(r.monthly.revenue, 32 * 2 * .65 * 35000 * 26);
  close(r.monthly.variableCosts, r.monthly.revenue * .38);
  close(r.monthly.taxReserve, r.monthly.revenue * .04);
  close(r.monthly.contributionRate, .58);
  close(r.monthly.businessSurplus, r.monthly.revenue * .58 - r.monthly.businessFixedCash);
  close(r.monthly.afterDebtSurplus, r.monthly.businessSurplus - 3000000);
});

test('세 가지 BEP는 각자의 현금 충당 항등식을 만족한다', () => {
  const p = api.createExample(); p.monthly.debtPrincipal = 500000;
  const r = api.calculate(p), m = r.monthly;
  close(m.cashBepRevenue * .58, m.businessFixedCash);
  close(m.ownerBepRevenue * .58, m.businessFixedCash + 3000000 + 500000);
  close(m.targetBepRevenue * .58, m.businessFixedCash + 3000000 + 500000 + 2000000);
  close(m.ownerBepCustomersPerDay * 35000 * 26, m.ownerBepRevenue);
  assert.equal(m.accountingProfit, null);
  const equivalent = domain.calculate({ rent: p.monthly.rent, management: p.monthly.management, payroll: r.staff.totalCash, otherFixed: p.monthly.utilities + p.monthly.otherFixed, depreciation: 0, variableRate: .42, ticket: p.sales.ticket, days: p.sales.days, seats: p.sales.seats, turns: p.sales.turns, occupancy: p.sales.occupancy, debtPrincipal: p.monthly.debtPrincipal, targetProfit: p.monthly.targetSurplus });
  close(equivalent.bepRevenue, m.cashBepRevenue);
  close(equivalent.revenue, m.revenue);
  close(equivalent.operatingProfit, m.businessSurplus);
});

test('VAT 포함 금액은 그대로, 별도 금액만 gross-up한다', () => {
  const p = api.createExample(), original = api.calculate(p);
  p.costs.find(x => x.id === 'interior').vatMode = 'excluded';
  const changed = api.calculate(p);
  close(changed.initial.costCash - original.initial.costCash, 2900000);
  close(changed.initial.rows.find(x => x.id === 'interior').vatAdded, 2900000);
  close(changed.initial.rows.find(x => x.id === 'equipment').cash, 20000000);
  close(changed.initial.fundedReserve, 57100000);
  close(changed.initial.budgetDifference, -2900000);
  close(changed.monthly.zeroRevenueBurn, original.monthly.zeroRevenueBurn);
});

test('미확인 견적·VAT를 0으로 합산하지 않는다', () => {
  const p = api.createExample(); p.costs[2].vatMode = 'unknown';
  let r = api.calculate(p);
  assert.equal(r.valid, true); assert.equal(r.complete, false);
  assert.equal(r.initial.status, 'incomplete');
  assert.equal(r.initial.costCash, null); assert.equal(r.initial.totalAllocated, null);
  assert.equal(r.initial.fundedReserve, null); assert.equal(r.runway.months, null);
  assert.equal(r.initial.knownCostCash, 101000000);
  p.costs[2].vatMode = 'excluded'; p.costs[2].vatRate = null;
  r = api.calculate(p); assert.equal(r.initial.costCash, null);
  p.costs[2].vatMode = 'included'; p.costs[2].amount = null;
  r = api.calculate(p); assert.equal(r.initial.costCash, null);
});

test('예산 초과 시 실제 조달 가능 준비금으로 버틸 기간을 제한한다', () => {
  const p = api.createExample(); p.budget = 160000000;
  const r = api.calculate(p);
  assert.equal(r.initial.fundedReserve, 20000000);
  assert.equal(r.initial.budgetDifference, -40000000);
  close(r.runway.months, 20000000 / r.monthly.zeroRevenueBurn);
  p.budget = 120000000;
  const belowOpening = api.calculate(p);
  assert.equal(belowOpening.initial.fundedReserve, 0);
  assert.equal(belowOpening.initial.openingFundingGap, 20000000);
  assert.equal(belowOpening.runway.months, 0);
});

test('보증금·공사 예비비·초기 재고는 월 고정비나 이중 운영준비금이 아니다', () => {
  const p = api.createExample(), original = api.calculate(p);
  p.costs.find(x => x.id === 'inventory').amount += 1000000;
  p.costs.find(x => x.id === 'deposit').amount += 1000000;
  p.contingency += 1000000;
  const r = api.calculate(p);
  close(r.monthly.zeroRevenueBurn, original.monthly.zeroRevenueBurn);
  assert.equal(r.initial.fundedReserve, 57000000);
  close(r.runway.months, 57000000 / original.monthly.zeroRevenueBurn);
  p.budget = 250000000;
  const extraBudget = api.calculate(p);
  assert.equal(extraBudget.initial.fundedReserve, 60000000);
  assert.equal(extraBudget.initial.unallocatedCash, 47000000);
});

test('영업시간과 체류시간이 입력되면 회전 상한 충돌을 드러낸다', () => {
  const p = api.createExample(); p.sales.openHours = 3; p.sales.visitMinutes = 120;
  const r = api.calculate(p);
  close(r.capacity.maxTurnsByHours, 1.5);
  assert.equal(r.capacity.turnsExceedHours, true);
  assert.equal(r.capacity.maxCustomersPerDay, 48);
  assert.equal(r.capacity.declaredMaxCustomersPerDay, 64);
  assert.equal(r.capacity.plannedCapacityFeasible, false);
  assert.ok(r.warnings.some(x => x.code === 'TURN_TIME_CONFLICT'));
  p.sales.seats = 4;
  const small = api.calculate(p);
  assert.equal(small.capacity.ownerCapacityFeasible, false);
});

test('빈 계획은 확정 조건 외 입력을 만들지 않고 부분 계산 상태를 보존한다', () => {
  const p = api.createEmpty(), r = api.calculate(p);
  assert.equal(p.budget, 200000000); assert.equal(p.country, 'KR');
  assert.equal(p.regionLabel, '강남권'); assert.equal(p.conceptId, 'pork_galmaegisal');
  assert.equal(p.openingYear, null); assert.equal(p.operationMode, null);
  assert.equal(p.monthly.rent, null); assert.equal(p.sales.ticket, null);
  assert.ok(p.costs.every(x => x.amount === null));
  assert.equal(r.valid, true); assert.equal(r.complete, false); assert.equal(r.status, 'incomplete');
  assert.equal(r.initial.totalAllocated, null);
  assert.equal(r.modes.owner.monthly.cashBepRevenue, null);
  assert.equal(r.monthly.ownerBepCustomersPerDay, null);
  assert.equal(r.runway.months, null);
});

test('지역 미입력은 전체 완료가 아니며 미선택 모드의 미입력은 선택 모드를 막지 않는다', () => {
  const p = api.createExample(); p.regionLabel = '';
  let r = api.calculate(p);
  assert.equal(r.complete, false); assert.equal(r.status, 'incomplete');
  assert.ok(r.missing.some(x => x.path === 'regionLabel'));
  p.regionLabel = '강남권'; p.staff.find(x => x.id === 'manager').monthlyPay = null;
  r = api.calculate(p);
  assert.equal(r.complete, true); assert.equal(r.modes.owner.monthly.status, 'ready');
  assert.equal(r.modes.manager.monthly.status, 'incomplete');
  p.operationMode = 'manager'; r = api.calculate(p);
  assert.equal(r.complete, false); assert.equal(r.monthly.zeroRevenueBurn, null);
});

test('해당 연도 단순 급여 참고 경고만 적용하며 법적 충족을 주장하지 않는다', () => {
  const p = api.createExample(); p.staff.find(x => x.id === 'part').hourlyPay = 10500;
  let r = api.calculate(p);
  assert.equal(r.wageReference.year, 2027);
  assert.ok(r.warnings.some(x => x.code === 'BELOW_WAGE_REFERENCE'));
  p.openingYear = 2026; r = api.calculate(p);
  assert.equal(r.wageReference.hourly, 10320);
  assert.ok(!r.warnings.some(x => x.code === 'BELOW_WAGE_REFERENCE'));
  p.openingYear = null; r = api.calculate(p);
  assert.equal(r.wageReference, null);
  assert.ok(r.warnings.some(x => x.code === 'WAGE_REFERENCE_UNAVAILABLE'));
});

test('유효하지 않은 숫자·100% 변동비·중복 ID·다른 통화는 유효 처리하지 않는다', () => {
  const variants = [
    p => { p.sales.taxReserveRate = .62; },
    p => { p.sales.ticket = Infinity; },
    p => { p.sales.days = 0; },
    p => { p.sales.occupancy = 1.1; },
    p => { p.staff[0].count = 1.5; },
    p => { p.monthly.ownerDraw = -1; },
    p => { p.costs.push(copy(p.costs[0])); },
    p => { p.currency = 'JPY'; },
    p => { p.costs[0].kind = Infinity; p.costs[0].vatMode = Infinity; },
    p => { p.sales.ticket = '35000'; },
    p => { p.sales.seats = Number.MAX_SAFE_INTEGER; p.sales.turns = Number.MAX_VALUE; }
  ];
  for (const mutate of variants) {
    const p = api.createExample(); mutate(p);
    const r = api.calculate(p);
    assert.equal(r.valid, false, JSON.stringify(p)); assert.ok(r.errors.length > 0);
    const inspect = v => { if (typeof v === 'number') assert.ok(Number.isFinite(v)); else if (v && typeof v === 'object') Object.values(v).forEach(inspect); };
    inspect(r);
  }
});

test('0매출·0 고정 현금 조건도 Infinity 없이 직렬화한다', () => {
  const p = api.createExample(); p.sales.occupancy = 0; p.staff = [];
  Object.keys(p.monthly).forEach(k => { p.monthly[k] = 0; });
  const r = api.calculate(p);
  assert.equal(r.monthly.revenue, 0); assert.equal(r.monthly.zeroRevenueBurn, 0);
  assert.equal(r.runway.months, null); assert.equal(r.runway.zeroBurn, true);
  assert.equal(r.runway.reachesTarget, true);
  assert.doesNotThrow(() => JSON.stringify(r));
});

test('입력 불변·독립 예시·브라우저와 CommonJS export를 보장한다', () => {
  const p = api.createExample(), before = JSON.stringify(p);
  api.calculate(p); assert.equal(JSON.stringify(p), before);
  const another = api.createExample(); another.costs[0].amount = 1;
  assert.equal(p.costs[0].amount, 40000000);
  assert.equal(window.AtlasOpeningPlan, api);
  const browser = { window: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/opening-plan.js'), 'utf8'), browser);
  close(browser.window.AtlasOpeningPlan.calculate(browser.window.AtlasOpeningPlan.createExample()).monthly.zeroRevenueBurn, api.calculate(p).monthly.zeroRevenueBurn);
});

const result = api.calculate(api.createExample());
console.log(JSON.stringify({ passed, initialCash: result.initial.costCash, totalAllocated: result.initial.totalAllocated, owner: { payroll: result.staff.totalCash, revenue: result.monthly.revenue, afterOwnerAndDebt: result.monthly.afterDebtSurplus, ownerBepCustomersPerDay: result.monthly.ownerBepCustomersPerDay, zeroRevenueBurn: result.monthly.zeroRevenueBurn, runwayMonths: result.runway.months }, manager: { zeroRevenueBurn: result.modes.manager.monthly.zeroRevenueBurn, runwayMonths: result.modes.manager.runway.months, reserveShortfall: result.modes.manager.runway.shortfall } }, null, 2));
