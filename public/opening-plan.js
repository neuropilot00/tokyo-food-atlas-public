(function (factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.AtlasOpeningPlan = api;
})(function () {
  'use strict';

  var VERSION = '1.0.0';
  var EXAMPLE_NOTE = '국가·강남권·갈매기살 업종·총예산 2억원 외의 수치는 수정 가능한 계획 예시입니다. 실제 매물 견적, 시장 평균, 판매 예측, 법정 급여·보험·세액 계산이 아닙니다.';
  var NOTES = [
    '모든 금액은 원(KRW)입니다. 월 매출은 부가세 포함 고객 총결제액, 월 지출은 부가세 포함 현금 계획입니다. 법정 회계이익을 계산하지 않습니다.',
    '초기 VAT 별도 견적만 입력한 계획 세율로 현금액을 늘립니다. VAT 포함 금액에는 다시 더하지 않으며, 예상 환급액을 초기 필요 현금에서 차감하지 않습니다.',
    '보험·퇴직 준비율은 법정 정확률이 아닌 계획률입니다. 두 준비액은 직원 기본급에 각각 한 번만 더하고, 매월 따로 적립해 쓸 수 없는 현금으로 보수적으로 취급합니다.',
    '대표 인출은 직원 급여와 구분합니다. 점장 운영으로 바꿔도 대표 인출은 자동으로 없어지지 않습니다.',
    '세금 준비율은 고객 총결제액에서 따로 적립하는 계획 가정입니다. 실제 부가세·소득세·법인세나 신고·납부 시점을 산출하지 않습니다.',
    '영업 현금 손익분기는 직원 준비금을 포함한 영업 고정지출 기준입니다. 대표 포함 손익분기는 대표 인출·대출 원금도 포함하고, 목표 잉여 기준은 여기에 목표 금액을 더합니다.',
    '보증금은 잠기는 현금이고 공사 예비비·운영준비금은 배정 현금입니다. 이 금액들을 월 영업비에 다시 더하지 않습니다. 초기 재고는 초기 현금에 한 번만, 판매분 원가·정상 보충 가정은 월 변동비에 반영합니다.',
    '0매출 버틸 기간은 조달 가능한 운영준비금만 사용합니다. 보증금·공사 예비비·미배정 예산을 다시 운영준비금에 더하지 않습니다. 감가상각은 이 현금 계산에 포함하지 않습니다.',
    '회전·좌석·가동률은 처리 능력과 판매량의 입력 가정입니다. 실제 수요·영업 성공·설비 또는 인허가 적합성을 보장하지 않습니다.',
    '최저임금 수치는 선택 연도의 단순 참고 비교입니다. 월 기준은 주 40시간·월 209시간 환산 참고액이며 실제 근로시간·휴게·연장·야간·휴일수당·유급휴일 충족 여부를 판단하지 않습니다.'
  ];
  var wageReferences = {
    2026: { year: 2026, hourly: 10320, monthly209Hours: 2156880 },
    2027: { year: 2027, hourly: 10700, monthly209Hours: 2236300 }
  };

  function cost(id, label, amount, kind, vatMode) {
    return { id: id, label: label, amount: amount, kind: kind, vatMode: vatMode, vatRate: 0.1, quoteStatus: 'assumption' };
  }
  function createExample() {
    return {
      schemaVersion: 1, country: 'KR', currency: 'KRW', regionLabel: '강남권',
      conceptId: 'pork_galmaegisal', budget: 200000000, openingYear: 2027,
      operationMode: 'owner',
      costs: [
        cost('deposit', '임차 보증금', 40000000, 'deposit', 'none'),
        cost('transfer', '권리금·기존 설비 양도', 10000000, 'expense', 'included'),
        cost('interior', '기존 시설 보완·인테리어·간판', 29000000, 'capex', 'included'),
        cost('equipment', '주방·냉장·로스터·의탁자', 20000000, 'capex', 'included'),
        cost('facilities', '덕트·냉난방·전기·가스·소방 보완', 12000000, 'capex', 'included'),
        cost('fees', '중개·신고·개점 보험 등', 5000000, 'expense', 'included'),
        cost('inventory', '초기 식재료·주류·소모품 재고', 3000000, 'inventory', 'included'),
        cost('preopenPayroll', '개점 전 채용·교육 인건비', 5000000, 'preopen', 'none'),
        cost('preopenRent', '개점 전 임차·관리 지출', 4000000, 'preopen', 'included'),
        cost('launch', '개점 POS·홍보 등', 2000000, 'expense', 'included')
      ],
      contingency: 10000000, reserve: 60000000,
      staff: [
        { id: 'kitchen', role: '주방·고기 손질', count: 1, payType: 'monthly', monthlyPay: 3200000, hourlyPay: null, weeklyHours: null, weeklyPaidRestHours: null, onlyMode: 'both' },
        { id: 'floor', role: '홀·서비스', count: 1, payType: 'monthly', monthlyPay: 2800000, hourlyPay: null, weeklyHours: null, weeklyPaidRestHours: null, onlyMode: 'both' },
        { id: 'part', role: '피크타임 보조', count: 1, payType: 'hourly', monthlyPay: null, hourlyPay: 12000, weeklyHours: 20, weeklyPaidRestHours: 4, onlyMode: 'both' },
        { id: 'manager', role: '점장', count: 1, payType: 'monthly', monthlyPay: 3800000, hourlyPay: null, weeklyHours: null, weeklyPaidRestHours: null, onlyMode: 'manager' }
      ],
      payroll: { insuranceReserveRate: 0.117, retirementReserveRate: 0.0833, weeksPerMonth: 4.345238 },
      monthly: { rent: 3500000, management: 300000, utilities: 900000, otherFixed: 700000, ownerDraw: 3000000, debtPrincipal: 0, targetSurplus: 2000000 },
      sales: { days: 26, seats: 32, turns: 2, occupancy: 0.65, ticket: 35000, foodRate: 0.35, otherVariableRate: 0.03, taxReserveRate: 0.04, openHours: null, visitMinutes: null },
      targetReserveMonths: 3,
      assumptionNote: EXAMPLE_NOTE
    };
  }
  function createEmpty() {
    var p = createExample();
    p.openingYear = null;
    p.operationMode = null;
    p.costs.forEach(function (row) { row.amount = null; row.vatMode = 'unknown'; row.vatRate = null; });
    p.contingency = null;
    p.reserve = null;
    p.staff.forEach(function (row) { ['count', 'monthlyPay', 'hourlyPay', 'weeklyHours', 'weeklyPaidRestHours'].forEach(function (key) { row[key] = null; }); });
    Object.keys(p.payroll).forEach(function (key) { p.payroll[key] = null; });
    Object.keys(p.monthly).forEach(function (key) { p.monthly[key] = null; });
    Object.keys(p.sales).forEach(function (key) { p.sales[key] = null; });
    p.targetReserveMonths = null;
    p.assumptionNote = '총예산 2억원·대한민국·강남권·갈매기살 업종만 확정했습니다. 나머지 금액·운영 조건은 미입력입니다.';
    return p;
  }

  function issues() { return { errors: [], missing: [], warnings: [] }; }
  function error(s, path, code, message) { s.errors.push({ path: path, code: code, message: message }); }
  function missing(s, path, message) { s.missing.push({ path: path, message: message }); }
  function warning(s, path, code, message) { s.warnings.push({ path: path, code: code, message: message }); }
  function finite(v) { return typeof v === 'number' && Number.isFinite(v); }
  function textOrNull(v) { return typeof v === 'string' ? v : null; }
  function read(v, path, s, options) {
    var o = options || {};
    if (v === null || v === undefined) {
      if (!o.optional) missing(s, path, path + ' 항목이 미입력입니다.');
      return null;
    }
    if (!finite(v) || v < (o.min === undefined ? 0 : o.min) || (o.positive && v <= 0) || (o.max !== undefined && v > o.max) || (o.exclusiveMax !== undefined && v >= o.exclusiveMax) || (o.integer && !Number.isSafeInteger(v))) {
      error(s, path, 'INVALID_NUMBER', path + ' 항목의 숫자·범위를 확인해 주세요.');
      return null;
    }
    return v;
  }
  function compute(path, s, values, fn) {
    if (values.some(function (v) { return !finite(v); })) return null;
    var value = fn.apply(null, values);
    if (!finite(value)) { error(s, path, 'NUMERIC_OVERFLOW', '계산 가능한 숫자 범위를 넘었습니다.'); return null; }
    return value;
  }
  function sum(values, path, s) { return compute(path, s, values, function () { return values.reduce(function (a, b) { return a + b; }, 0); }); }
  function status(s) { return s.errors.length ? 'invalid' : s.missing.length ? 'incomplete' : 'ready'; }
  function unique(xs) {
    var seen = Object.create(null);
    return xs.filter(function (x) { var k = x.path + '|' + (x.code || '') + '|' + x.message; if (seen[k]) return false; seen[k] = true; return true; });
  }
  function merge(target, source) {
    ['errors', 'missing', 'warnings'].forEach(function (key) { target[key] = unique(target[key].concat(source[key] || [])); });
  }
  function finish(value, s) {
    value.status = status(s);
    value.errors = s.errors;
    value.missing = s.missing;
    value.warnings = s.warnings;
    return value;
  }
  function object(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }

  function initialPlan(p) {
    var s = issues(), ids = Object.create(null), rows = [], raw = p.costs;
    if (!Array.isArray(raw)) { missing(s, 'costs', '개점 비용 항목이 필요합니다.'); raw = []; }
    raw.forEach(function (input, index) {
      var row = object(input), q = issues(), prefix = 'costs[' + index + ']';
      if (typeof row.id !== 'string' || !row.id.trim() || ids[row.id]) error(q, prefix + '.id', 'DUPLICATE_OR_MISSING_ID', '개점 비용 항목에는 중복되지 않는 id가 필요합니다.');
      if (typeof row.id === 'string') ids[row.id] = true;
      if (['deposit', 'capex', 'expense', 'inventory', 'preopen'].indexOf(row.kind) < 0) error(q, prefix + '.kind', 'INVALID_COST_KIND', '개점 비용 구분을 확인해 주세요.');
      if (['assumption', 'quote', 'confirmed'].indexOf(row.quoteStatus) < 0) error(q, prefix + '.quoteStatus', 'INVALID_QUOTE_STATUS', '예시·견적·확인 구분을 선택해 주세요.');
      var amount = read(row.amount, prefix + '.amount', q), cash = null, vatAdded = null;
      if (row.vatMode === 'unknown' || row.vatMode === null || row.vatMode === undefined) {
        missing(q, prefix + '.vatMode', 'VAT 포함 여부를 확인해 주세요. 미확인 견적은 0원으로 처리하지 않습니다.');
      } else if (['included', 'excluded', 'none'].indexOf(row.vatMode) < 0) {
        error(q, prefix + '.vatMode', 'INVALID_VAT_MODE', 'VAT 포함·별도·해당 없음 중 하나를 선택해 주세요.');
      } else if (row.vatMode === 'excluded') {
        var rate = read(row.vatRate, prefix + '.vatRate', q, { max: 1 });
        cash = compute(prefix + '.cash', q, [amount, rate], function (a, r) { return a * (1 + r); });
        vatAdded = compute(prefix + '.vatAdded', q, [amount, rate], function (a, r) { return a * r; });
      } else { cash = amount; vatAdded = amount === null ? null : 0; }
      if (q.errors.length) { cash = null; vatAdded = null; }
      var out = finish({ id: textOrNull(row.id), label: typeof row.label === 'string' ? row.label : '', kind: textOrNull(row.kind), amount: amount, vatMode: textOrNull(row.vatMode), quoteStatus: textOrNull(row.quoteStatus), cash: cash, vatAdded: vatAdded, requiresReview: row.quoteStatus !== 'confirmed' || q.missing.length > 0 || q.errors.length > 0 }, q);
      rows.push(out); merge(s, q);
    });
    var budget = read(p.budget, 'budget', s), contingency = read(p.contingency, 'contingency', s), reserve = read(p.reserve, 'reserve', s);
    var costCash = Array.isArray(p.costs) ? sum(rows.map(function (r) { return r.cash; }), 'initial.costCash', s) : null;
    var knownCostCash = sum(rows.filter(function (r) { return r.cash !== null; }).map(function (r) { return r.cash; }), 'initial.knownCostCash', s);
    var depositLocked = Array.isArray(p.costs) ? sum(rows.filter(function (r) { return r.kind === 'deposit'; }).map(function (r) { return r.cash; }), 'initial.depositLocked', s) : null;
    var totalAllocated = sum([costCash, contingency, reserve], 'initial.totalAllocated', s);
    var budgetDifference = compute('initial.budgetDifference', s, [budget, totalAllocated], function (b, t) { return b - t; });
    var beforeReserve = compute('initial.beforeReserve', s, [budget, costCash, contingency], function (b, c, v) { return b - c - v; });
    var allocatable = beforeReserve === null ? null : Math.max(0, beforeReserve);
    var funded = compute('initial.fundedReserve', s, [reserve, allocatable], function (r, a) { return Math.min(r, a); });
    if (budgetDifference !== null && budgetDifference < 0) warning(s, 'budget', 'OVER_BUDGET', '초기 배정액이 총예산을 넘습니다. 버틸 기간은 실제 조달 가능한 운영준비금으로 제한했습니다.');
    if (rows.some(function (r) { return r.id === 'transfer' && r.cash > 0; }) && rows.some(function (r) { return r.kind === 'capex' && r.cash > 0; })) warning(s, 'costs', 'CHECK_TRANSFER_EQUIPMENT_OVERLAP', '권리금·양도금에 포함된 설비는 공사·설비 견적에서 중복 제외됐는지 확인해 주세요.');
    if (rows.some(function (r) { return r.quoteStatus === 'assumption'; })) warning(s, 'costs', 'UNQUOTED_OPENING_COSTS', '개점 비용에 견적이 아닌 계획 예시가 있습니다.');
    return finish({ rows: rows, budget: budget, costCash: costCash, knownCostCash: knownCostCash, depositLocked: depositLocked, nonDepositOpeningCash: compute('initial.nonDepositOpeningCash', s, [costCash, depositLocked], function (c, d) { return c - d; }), contingency: contingency, reserve: reserve, totalAllocated: totalAllocated, budgetDifference: budgetDifference, allocatableOperatingCash: allocatable, fundedReserve: funded, openingFundingGap: beforeReserve === null ? null : Math.max(0, -beforeReserve), unallocatedCash: budgetDifference === null ? null : Math.max(0, budgetDifference) }, s);
  }

  function staffPlan(p, mode, reference) {
    var s = issues(), payroll = object(p.payroll), rows = [], ids = Object.create(null);
    var insuranceRate = read(payroll.insuranceReserveRate, 'payroll.insuranceReserveRate', s, { max: 1 });
    var retirementRate = read(payroll.retirementReserveRate, 'payroll.retirementReserveRate', s, { max: 1 });
    var weeks = read(payroll.weeksPerMonth, 'payroll.weeksPerMonth', s, { positive: true, max: 6 });
    var input = Array.isArray(p.staff) ? p.staff : [];
    if (!Array.isArray(p.staff)) missing(s, 'staff', '직원 명세가 필요합니다.');
    input.forEach(function (value, index) {
      var row = object(value), q = issues(), prefix = 'staff[' + index + ']';
      if (['both', 'owner', 'manager'].indexOf(row.onlyMode) < 0) { error(s, prefix + '.onlyMode', 'INVALID_STAFF_MODE', '직원 적용 운영 방식을 확인해 주세요.'); return; }
      if (row.onlyMode !== 'both' && row.onlyMode !== mode) return;
      if (typeof row.id !== 'string' || !row.id.trim() || ids[row.id]) error(q, prefix + '.id', 'DUPLICATE_OR_MISSING_ID', '직원 항목에는 중복되지 않는 id가 필요합니다.');
      if (typeof row.id === 'string') ids[row.id] = true;
      var count = read(row.count, prefix + '.count', q, { integer: true });
      if (count === 0) { rows.push(finish({ id: textOrNull(row.id), role: textOrNull(row.role) || '', count: 0, active: false, payType: textOrNull(row.payType), monthlyPayPerPerson: 0, wageBase: 0, insuranceReserve: 0, retirementReserve: 0, totalCash: 0, monthlyPaidHoursPerPerson: 0, wageReference: null }, q)); merge(s, q); return; }
      var pay = null, hours = null, weeklyHours = null, paidRest = null, wageReference = null;
      if (row.payType === 'monthly') {
        pay = read(row.monthlyPay, prefix + '.monthlyPay', q);
        weeklyHours = read(row.weeklyHours, prefix + '.weeklyHours', q, { optional: true, max: 168 });
        paidRest = read(row.weeklyPaidRestHours, prefix + '.weeklyPaidRestHours', q, { optional: true, max: 168 });
        hours = compute(prefix + '.monthlyPaidHours', q, [weeklyHours, paidRest, weeks], function (h, rest, w) { return (h + rest) * w; });
        if (weeklyHours === null || paidRest === null) warning(q, prefix, 'SALARY_HOURS_UNVERIFIED', '월급제 ' + (row.role || '직원') + '의 실제 근로시간·유급시간·추가수당을 확인해 주세요.');
        if (reference && pay !== null) wageReference = { year: reference.year, basis: 'monthly_209_hours_reference_only', referenceAmount: reference.monthly209Hours, inputAmount: pay, belowReference: pay < reference.monthly209Hours };
      } else if (row.payType === 'hourly') {
        var hourlyPay = read(row.hourlyPay, prefix + '.hourlyPay', q);
        weeklyHours = read(row.weeklyHours, prefix + '.weeklyHours', q, { max: 168 });
        paidRest = read(row.weeklyPaidRestHours, prefix + '.weeklyPaidRestHours', q, { max: 168 });
        hours = compute(prefix + '.monthlyPaidHours', q, [weeklyHours, paidRest, weeks], function (h, rest, w) { return (h + rest) * w; });
        pay = compute(prefix + '.monthlyPay', q, [hourlyPay, hours], function (rate, h) { return rate * h; });
        if (reference && hourlyPay !== null) wageReference = { year: reference.year, basis: 'hourly_reference_only', referenceAmount: reference.hourly, inputAmount: hourlyPay, belowReference: hourlyPay < reference.hourly };
      } else error(q, prefix + '.payType', 'INVALID_PAY_TYPE', '월급제 또는 시급제를 선택해 주세요.');
      if (wageReference && wageReference.belowReference) warning(q, prefix, 'BELOW_WAGE_REFERENCE', (row.role || '직원') + '의 급여가 선택 연도의 단순 참고액보다 낮습니다. 실제 근로조건과 수당을 별도로 검토해 주세요.');
      var wage = compute(prefix + '.wageBase', q, [pay, count], function (v, n) { return v * n; });
      var insurance = compute(prefix + '.insuranceReserve', q, [wage, insuranceRate], function (v, r) { return v * r; });
      var retirement = compute(prefix + '.retirementReserve', q, [wage, retirementRate], function (v, r) { return v * r; });
      var total = sum([wage, insurance, retirement], prefix + '.totalCash', q);
      if (q.errors.length) { wage = null; insurance = null; retirement = null; total = null; }
      rows.push(finish({ id: textOrNull(row.id), role: textOrNull(row.role) || '', count: count, active: count === null ? null : count > 0, payType: textOrNull(row.payType), weeklyHours: weeklyHours, weeklyPaidRestHours: paidRest, monthlyPaidHoursPerPerson: hours, monthlyPayPerPerson: pay, wageBase: wage, insuranceReserve: insurance, retirementReserve: retirement, totalCash: total, wageReference: wageReference }, q));
      merge(s, q);
    });
    if (!rows.length && Array.isArray(p.staff)) warning(s, 'staff', 'NO_ACTIVE_STAFF', '직원 0명으로 계산합니다. 대표의 조리·홀·준비 업무 수행 가능성은 별도로 확인해 주세요.');
    return finish({ mode: mode, rows: rows, insuranceReserveRate: insuranceRate, retirementReserveRate: retirementRate, weeksPerMonth: weeks, wageBase: Array.isArray(p.staff) ? sum(rows.map(function (r) { return r.wageBase; }), 'staff.wageBase', s) : null, insuranceReserve: Array.isArray(p.staff) ? sum(rows.map(function (r) { return r.insuranceReserve; }), 'staff.insuranceReserve', s) : null, retirementReserve: Array.isArray(p.staff) ? sum(rows.map(function (r) { return r.retirementReserve; }), 'staff.retirementReserve', s) : null, totalCash: Array.isArray(p.staff) ? sum(rows.map(function (r) { return r.totalCash; }), 'staff.totalCash', s) : null, activeHeadcount: Array.isArray(p.staff) ? sum(rows.map(function (r) { return r.count; }), 'staff.activeHeadcount', s) : null }, s);
  }

  function salesPlan(p) {
    var s = issues(), raw = object(p.sales), out = {};
    var rules = { days: { positive: true, integer: true, max: 31 }, seats: { positive: true, integer: true }, turns: { positive: true }, occupancy: { max: 1 }, ticket: { positive: true }, foodRate: { exclusiveMax: 1 }, otherVariableRate: { exclusiveMax: 1 }, taxReserveRate: { exclusiveMax: 1 }, openHours: { optional: true, positive: true, max: 24 }, visitMinutes: { optional: true, positive: true, max: 1440 } };
    Object.keys(rules).forEach(function (key) { out[key] = read(raw[key], 'sales.' + key, s, rules[key]); });
    out.totalVariableRate = sum([out.foodRate, out.otherVariableRate, out.taxReserveRate], 'sales.totalVariableRate', s);
    if (out.totalVariableRate !== null && out.totalVariableRate >= 1) error(s, 'sales.totalVariableRate', 'NO_POSITIVE_CONTRIBUTION', '식재료·기타 변동비·세금 준비율 합계는 100% 미만이어야 합니다.');
    out.contributionRate = out.totalVariableRate !== null && out.totalVariableRate < 1 ? 1 - out.totalVariableRate : null;
    out.declaredMaxCustomersPerDay = compute('sales.declaredMaxCustomersPerDay', s, [out.seats, out.turns], function (seats, turns) { return seats * turns; });
    out.plannedCustomersPerDay = compute('sales.plannedCustomersPerDay', s, [out.declaredMaxCustomersPerDay, out.occupancy], function (cap, occ) { return cap * occ; });
    out.revenue = compute('sales.revenue', s, [out.plannedCustomersPerDay, out.ticket, out.days], function (n, ticket, days) { return n * ticket * days; });
    out.maxTurnsByHours = compute('sales.maxTurnsByHours', s, [out.openHours, out.visitMinutes], function (h, minutes) { return h * 60 / minutes; });
    out.turnsExceedHours = out.maxTurnsByHours === null || out.turns === null ? null : out.turns > out.maxTurnsByHours + 1e-12;
    out.maxCustomersPerDay = out.declaredMaxCustomersPerDay;
    if (out.maxTurnsByHours !== null && out.turns !== null) out.maxCustomersPerDay = compute('sales.maxCustomersPerDay', s, [out.seats, out.turns, out.maxTurnsByHours], function (seats, turns, max) { return seats * Math.min(turns, max); });
    out.turnsValidationStatus = out.turnsExceedHours === null ? 'unverified' : out.turnsExceedHours ? 'exceeds_hours' : 'within_hours';
    if (out.turnsExceedHours === null) warning(s, 'sales', 'TURN_CAPACITY_UNVERIFIED', '영업시간·평균 체류시간이 미입력되어 회전 가정을 검증하지 못했습니다. 주방 처리능력·테이블 구성도 별도 확인해야 합니다.');
    else if (out.turnsExceedHours) warning(s, 'sales.turns', 'TURN_TIME_CONFLICT', '입력 회전 수가 영업시간÷체류시간을 넘습니다. 매출은 입력 가정으로 계산되지만 그 고객 수를 처리할 수 있다고 보지 마세요.');
    return finish(out, s);
  }

  function monthlyPlan(p, staff, sales) {
    var s = issues(), raw = object(p.monthly), m = {};
    merge(s, staff); merge(s, sales);
    ['rent', 'management', 'utilities', 'otherFixed', 'ownerDraw', 'debtPrincipal', 'targetSurplus'].forEach(function (key) { m[key] = read(raw[key], 'monthly.' + key, s); });
    var fixed = sum([m.rent, m.management, m.utilities, m.otherFixed, staff.totalCash], 'monthly.businessFixedCash', s);
    var variable = compute('monthly.variableCosts', s, [sales.revenue, sales.foodRate, sales.otherVariableRate], function (revenue, food, other) { return revenue * (food + other); });
    var tax = compute('monthly.taxReserve', s, [sales.revenue, sales.taxReserveRate], function (revenue, rate) { return revenue * rate; });
    var businessSurplus = compute('monthly.businessSurplus', s, [sales.revenue, variable, tax, fixed], function (revenue, v, t, f) { return revenue - v - t - f; });
    var afterOwner = compute('monthly.afterOwnerSurplus', s, [businessSurplus, m.ownerDraw], function (value, owner) { return value - owner; });
    var afterDebt = compute('monthly.afterDebtSurplus', s, [afterOwner, m.debtPrincipal], function (value, debt) { return value - debt; });
    var burn = sum([fixed, m.ownerDraw, m.debtPrincipal], 'monthly.zeroRevenueBurn', s);
    var cashBep = compute('monthly.cashBepRevenue', s, [fixed, sales.contributionRate], function (f, margin) { return f / margin; });
    var ownerBep = compute('monthly.ownerBepRevenue', s, [burn, sales.contributionRate], function (f, margin) { return f / margin; });
    var targetBep = compute('monthly.targetBepRevenue', s, [burn, m.targetSurplus, sales.contributionRate], function (f, target, margin) { return (f + target) / margin; });
    function customers(revenue, name) { return compute('monthly.' + name, s, [revenue, sales.ticket, sales.days], function (r, ticket, days) { return r / ticket / days; }); }
    return finish({ mode: staff.mode, revenue: sales.revenue, variableCosts: variable, foodCosts: compute('monthly.foodCosts', s, [sales.revenue, sales.foodRate], function (r, v) { return r * v; }), otherVariableCosts: compute('monthly.otherVariableCosts', s, [sales.revenue, sales.otherVariableRate], function (r, v) { return r * v; }), taxReserve: tax, contributionRate: sales.contributionRate, businessFixedCash: fixed, businessSurplus: businessSurplus, ownerDraw: m.ownerDraw, afterOwnerSurplus: afterOwner, debtPrincipal: m.debtPrincipal, afterDebtSurplus: afterDebt, targetSurplus: m.targetSurplus, cashBepRevenue: cashBep, cashBepCustomersPerDay: customers(cashBep, 'cashBepCustomersPerDay'), ownerBepRevenue: ownerBep, ownerBepCustomersPerDay: customers(ownerBep, 'ownerBepCustomersPerDay'), targetBepRevenue: targetBep, targetBepCustomersPerDay: customers(targetBep, 'targetBepCustomersPerDay'), zeroRevenueBurn: burn, rentCashIncludesVat: true, taxCalculation: 'planning_reserve_only', accountingProfit: null }, s);
  }
  function runwayPlan(p, initial, monthly) {
    var s = issues(), target = read(p.targetReserveMonths, 'targetReserveMonths', s, { positive: true });
    if (initial.fundedReserve === null) missing(s, 'initial.fundedReserve', '조달 가능한 운영준비금이 아직 확정되지 않았습니다.');
    if (monthly.zeroRevenueBurn === null) missing(s, 'monthly.zeroRevenueBurn', '월 고정 현금 소진액을 계산할 입력이 부족합니다.');
    var months = monthly.zeroRevenueBurn === 0 ? null : compute('runway.months', s, [initial.fundedReserve, monthly.zeroRevenueBurn], function (r, b) { return r / b; });
    var required = compute('runway.requiredReserve', s, [monthly.zeroRevenueBurn, target], function (burn, count) { return burn * count; });
    var difference = compute('runway.difference', s, [initial.fundedReserve, required], function (r, need) { return r - need; });
    if (difference !== null && difference < 0) warning(s, 'reserve', 'RESERVE_TARGET_SHORTFALL', '조달 가능한 운영준비금이 입력한 0매출 목표 개월수에 부족합니다.');
    return finish({ months: months, targetMonths: target, requiredReserve: required, fundedReserve: initial.fundedReserve, shortfall: difference === null ? null : Math.max(0, -difference), reachesTarget: difference === null ? null : difference >= 0, basis: 'funded_operating_reserve_only', zeroBurn: monthly.zeroRevenueBurn === 0 }, s);
  }
  function capacityPlan(sales, monthly) {
    var s = issues(); merge(s, sales);
    function occupancy(value, path) { return compute(path, s, [value, sales.maxCustomersPerDay], function (n, capacity) { return n / capacity; }); }
    var cash = occupancy(monthly.cashBepCustomersPerDay, 'capacity.cashRequiredOccupancy');
    var owner = occupancy(monthly.ownerBepCustomersPerDay, 'capacity.ownerRequiredOccupancy');
    var target = occupancy(monthly.targetBepCustomersPerDay, 'capacity.targetRequiredOccupancy');
    if (monthly.ownerBepCustomersPerDay === null) missing(s, 'monthly.ownerBepCustomersPerDay', '대표 인출 포함 손익분기 고객 수가 미확정입니다.');
    if (owner !== null && owner > 1) warning(s, 'sales', 'CAPACITY_BELOW_OWNER_BEP', '대표 인출·원금을 충당할 고객 수가 입력한 좌석·회전 처리 상한을 넘습니다.');
    return finish({ maxCustomersPerDay: sales.maxCustomersPerDay, declaredMaxCustomersPerDay: sales.declaredMaxCustomersPerDay, plannedCustomersPerDay: sales.plannedCustomersPerDay, cashRequiredOccupancy: cash, ownerRequiredOccupancy: owner, targetRequiredOccupancy: target, ownerCapacityFeasible: owner === null ? null : owner <= 1, targetCapacityFeasible: target === null ? null : target <= 1, maxTurnsByHours: sales.maxTurnsByHours, turnsExceedHours: sales.turnsExceedHours, turnsValidationStatus: sales.turnsValidationStatus, plannedCapacityFeasible: sales.turnsExceedHours === null ? null : !sales.turnsExceedHours }, s);
  }

  function calculate(input) {
    var p = object(input), s = issues();
    if (p.schemaVersion !== 1) error(s, 'schemaVersion', 'UNSUPPORTED_SCHEMA', '지원하는 계획 형식은 schemaVersion 1입니다.');
    if (p.country !== 'KR' || p.currency !== 'KRW') error(s, 'country', 'UNSUPPORTED_CURRENCY', '이 계획은 대한민국·원화(KR/KRW) 전용입니다.');
    if (p.conceptId !== 'pork_galmaegisal') error(s, 'conceptId', 'CONCEPT_MISMATCH', '갈매기살 돼지구이 업종 의도를 유지해 주세요.');
    if (typeof p.regionLabel !== 'string' || !p.regionLabel.trim()) missing(s, 'regionLabel', '검토 지역을 입력해 주세요.');
    var mode = p.operationMode;
    if (mode === null || mode === undefined) missing(s, 'operationMode', '대표 직접 운영 또는 점장 운영을 선택해 주세요.');
    else if (mode !== 'owner' && mode !== 'manager') { error(s, 'operationMode', 'INVALID_OPERATION_MODE', '대표 직접 운영 또는 점장 운영을 선택해 주세요.'); mode = null; }
    var year = read(p.openingYear, 'openingYear', s, { optional: true, integer: true, min: 2026, max: 2100 });
    var reference = year !== null && wageReferences[year] ? Object.assign({}, wageReferences[year]) : null;
    if (!reference) warning(s, 'openingYear', 'WAGE_REFERENCE_UNAVAILABLE', '개점 연도 미입력 또는 해당 연도 급여 참고자료 미연결로 최저임금 단순 비교를 생략했습니다.');
    var initial = initialPlan(p), sales = salesPlan(p), modes = {};
    merge(s, initial); merge(s, sales);
    ['owner', 'manager'].forEach(function (name) {
      var staff = staffPlan(p, name, reference), monthly = monthlyPlan(p, staff, sales);
      var runway = runwayPlan(p, initial, monthly), capacity = capacityPlan(sales, monthly);
      modes[name] = { staff: staff, monthly: monthly, runway: runway, capacity: capacity };
    });
    // Both alternatives are returned, but an incomplete unselected alternative
    // must not invalidate the selected operating mode.
    var selected = mode && modes[mode] ? modes[mode] : null;
    if (selected) ['staff', 'monthly', 'runway', 'capacity'].forEach(function (key) { merge(s, selected[key]); });
    function unselected(keys) {
      var section = { status: 'incomplete', errors: [], missing: [{ path: 'operationMode', message: '운영 방식을 선택해 주세요.' }], warnings: [] };
      keys.split(' ').forEach(function (key) { section[key] = null; });
      return section;
    }
    var emptyStaff = unselected('mode wageBase insuranceReserve retirementReserve totalCash activeHeadcount insuranceReserveRate retirementReserveRate weeksPerMonth');
    emptyStaff.rows = [];
    var emptyMonthly = unselected('mode revenue variableCosts foodCosts otherVariableCosts taxReserve contributionRate businessFixedCash businessSurplus ownerDraw afterOwnerSurplus debtPrincipal afterDebtSurplus targetSurplus cashBepRevenue cashBepCustomersPerDay ownerBepRevenue ownerBepCustomersPerDay targetBepRevenue targetBepCustomersPerDay zeroRevenueBurn accountingProfit');
    var emptyRunway = unselected('months targetMonths requiredReserve fundedReserve shortfall reachesTarget zeroBurn');
    var emptyCapacity = unselected('maxCustomersPerDay declaredMaxCustomersPerDay plannedCustomersPerDay cashRequiredOccupancy ownerRequiredOccupancy targetRequiredOccupancy ownerCapacityFeasible targetCapacityFeasible maxTurnsByHours turnsExceedHours plannedCapacityFeasible');
    emptyCapacity.turnsValidationStatus = 'unverified';
    var complete = s.errors.length === 0 && s.missing.length === 0 && !!selected && [initial, selected.staff, selected.monthly, selected.runway, selected.capacity].every(function (section) { return section.status === 'ready'; });
    var result = { version: VERSION, valid: s.errors.length === 0, complete: complete, status: s.errors.length ? 'invalid' : complete ? 'ready' : 'incomplete', country: textOrNull(p.country), currency: textOrNull(p.currency), regionLabel: textOrNull(p.regionLabel), conceptId: textOrNull(p.conceptId), operationMode: selected ? mode : null, openingYear: year, wageReference: reference, errors: s.errors, missing: s.missing, warnings: s.warnings, initial: initial, staff: selected ? selected.staff : emptyStaff, monthly: selected ? selected.monthly : emptyMonthly, runway: selected ? selected.runway : emptyRunway, capacity: selected ? selected.capacity : emptyCapacity, modes: modes, notes: NOTES.slice(), assumptionNote: typeof p.assumptionNote === 'string' ? p.assumptionNote : EXAMPLE_NOTE };
    return result;
  }

  return Object.freeze({ version: VERSION, createEmpty: createEmpty, createExample: createExample, calculate: calculate });
});
