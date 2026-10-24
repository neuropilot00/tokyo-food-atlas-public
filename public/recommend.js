(function (factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.AtlasRecommend = api;
})(function () {
  'use strict';

  // These are editable planning scenarios, not observed market prices or a
  // trained model. A rejection applies to this scenario, not every possible
  // version of the cuisine. No age-to-food-preference relationship is assumed.
  var VERSION = '2026-10-24.rules.1';
  var BASIS = '공개 지역 자료와 입력한 조건을 함께 보는 사전 규칙입니다. 비교점수는 성공확률·예상 수익률·통계 검증된 AI 예측이 아닙니다.';
  var ASSUMPTION_NOTE = '금액·객단가·원가율·인력·판매량은 시장 평균이 아닌 수정 가능한 계획 가정입니다. 실제 매물·견적·현장 관측으로 교체해야 합니다.';
  var serviceLabels = { any: '형태 제한 없음', quick: '빠른 식사·포장', cafe: '카페·디저트', dining: '좌석 식사·주점' };
  var timeLabels = { lunch: '점심·낮 중심', evening: '저녁 중심', allday: '종일 운영 가능' };
  var definitions = [
    {
      id: 'meal', name: '소형 한식 정식', service: 'dining', complexity: 3,
      dayparts: ['lunch', 'allday'], primary: 'lunch', minSeats: 14, minAreaM2: 35,
      capacityBasis: 'seats', seats: 24, turns: 3.5, occupancy: 0.65,
      staff: 3, focusBands: ['11_14'], industries: ['CS100001'],
      requirements: ['반찬 수를 제한한 메뉴와 점심 피크 조리 동선', '대표 포함 3인 운영 및 교대 가정', '배기·급배수·세척·보관 공간 확인'],
      weaknesses: ['다품목 준비와 잔반 관리가 필요합니다.', '사무실 인구만으로 외부 점심 수요를 확정할 수 없습니다.'],
      checks: ['평일 11–14시 식사 목적 통행과 줄 서는 경쟁점을 관찰하세요.', '주변 직장의 구내식당·배달·도시락 이용을 확인하세요.', '대표 메뉴 2~3개로 피크 시간의 실제 제공 속도를 시험하세요.'],
      KR: { rent: 2000000, management: 200000, payroll: 6000000, otherFixed: 1000000, depreciation: 500000, variableRate: 0.36, ticket: 12000, deposit: 20000000, transfer: 0, fitout: 25000000, openingCosts: 3000000, reserve: 15000000 },
      JP: { rent: 200000, management: 20000, payroll: 700000, otherFixed: 100000, depreciation: 60000, variableRate: 0.36, ticket: 1500, deposit: 1200000, transfer: 0, fitout: 2500000, openingCosts: 350000, reserve: 1800000 }
    },
    {
      id: 'takeout', name: '도시락·테이크아웃', service: 'quick', complexity: 1,
      dayparts: ['lunch', 'allday'], primary: 'lunch', minSeats: 0, minAreaM2: 18,
      capacityBasis: 'orders', seats: 0, turns: null, ordersPerDay: 80, occupancy: 0.65,
      staff: 2, focusBands: ['11_14'], industries: ['CS100001', 'CS100008'],
      requirements: ['메뉴 2~4개와 포장·픽업 동선', '대표 포함 2인 운영 가정', '좌석 대신 조리·포장 주문 처리량으로 계산'],
      weaknesses: ['포장재와 배달수수료가 원가에 추가됩니다.', '점심 집중 시 미리 준비할 수량과 폐기 손실을 관리해야 합니다.'],
      checks: ['근처 직장·주민의 실제 포장 주문과 픽업 동선을 확인하세요.', '배달 의존 비중별 수수료·포장비를 다시 계산하세요.', '80건/일 처리 상한 가정을 조리·포장 테스트로 확인하세요.'],
      KR: { rent: 1200000, management: 120000, payroll: 3500000, otherFixed: 600000, depreciation: 250000, variableRate: 0.42, ticket: 9000, deposit: 10000000, transfer: 0, fitout: 10000000, openingCosts: 2000000, reserve: 10000000 },
      JP: { rent: 100000, management: 10000, payroll: 350000, otherFixed: 55000, depreciation: 30000, variableRate: 0.42, ticket: 900, deposit: 600000, transfer: 0, fitout: 1200000, openingCosts: 250000, reserve: 1100000 }
    },
    {
      id: 'bowls', name: '면·덮밥 전문점', service: 'quick', complexity: 2,
      dayparts: ['lunch', 'evening', 'allday'], primary: 'lunch', minSeats: 8, minAreaM2: 25,
      capacityBasis: 'seats', seats: 18, turns: 4, occupancy: 0.65,
      staff: 2, focusBands: ['11_14', '17_21'], industries: ['CS100008', 'CS100003'],
      requirements: ['메뉴를 줄인 빠른 조리·회전 구조', '대표 포함 2인 운영 가정', '객단가와 추가 토핑·음료 구성을 명확히 설정'],
      weaknesses: ['가격이 비슷한 분식·일식·편의점과 식사 수요를 나눕니다.', '낮은 객단가를 보완할 처리량이 실제로 가능한지 확인해야 합니다.'],
      checks: ['같은 가격대 식사의 대기시간과 메뉴 차이를 기록하세요.', '주방 1회 조리량과 점심 시간대 주문 처리량을 측정하세요.', '평일·주말 저녁 수요를 따로 확인하세요.'],
      KR: { rent: 1600000, management: 160000, payroll: 4500000, otherFixed: 800000, depreciation: 350000, variableRate: 0.35, ticket: 11000, deposit: 15000000, transfer: 0, fitout: 20000000, openingCosts: 2000000, reserve: 12000000 },
      JP: { rent: 150000, management: 15000, payroll: 520000, otherFixed: 80000, depreciation: 45000, variableRate: 0.35, ticket: 1200, deposit: 900000, transfer: 0, fitout: 2000000, openingCosts: 300000, reserve: 1500000 }
    },
    {
      id: 'cafe', name: '소형 카페·디저트', service: 'cafe', complexity: 2,
      dayparts: ['lunch', 'allday'], primary: 'allday', minSeats: 8, minAreaM2: 28,
      capacityBasis: 'seats', seats: 20, turns: 5, occupancy: 0.65,
      staff: 2, focusBands: ['14_17'], industries: ['CS100010', 'CS100005'],
      requirements: ['음료와 소수 디저트 중심의 운영', '대표 포함 2인 운영 가정', '장기 체류·포장 비중별 좌석 계획'],
      weaknesses: ['청년 인구가 많다는 사실만으로 카페 소비를 추정하지 않습니다.', '좌석 체류가 길면 가정한 회전 수를 달성하기 어렵습니다.'],
      checks: ['오후·주말 경쟁 카페의 좌석 점유와 체류시간을 관찰하세요.', '디저트 직접 생산과 납품 방식의 원가·인력을 비교하세요.', '가격·입구·간판 등 기존 카페와 구분되는 선택 이유를 시험하세요.'],
      KR: { rent: 1800000, management: 180000, payroll: 4200000, otherFixed: 800000, depreciation: 400000, variableRate: 0.32, ticket: 8000, deposit: 20000000, transfer: 0, fitout: 30000000, openingCosts: 3000000, reserve: 15000000 },
      JP: { rent: 180000, management: 18000, payroll: 450000, otherFixed: 80000, depreciation: 50000, variableRate: 0.32, ticket: 1000, deposit: 1200000, transfer: 0, fitout: 2800000, openingCosts: 350000, reserve: 1700000 }
    },
    {
      id: 'bar', name: '소형 다이닝 주점', service: 'dining', complexity: 3,
      dayparts: ['evening', 'allday'], primary: 'evening', minSeats: 16, minAreaM2: 40,
      capacityBasis: 'seats', seats: 28, turns: 2, occupancy: 0.45,
      staff: 3, focusBands: ['17_21', '21_24'], industries: ['CS100009'],
      requirements: ['저녁 조리와 주류 서비스 동시 운영', '대표 포함 3인 운영 가정', '심야 운영·소음·귀가 동선·주류 제공 조건 확인'],
      weaknesses: ['저녁 매출에 집중되어 비수기와 평일 수요의 영향이 큽니다.', '실제 구매 고객의 연령·소비액은 아직 확보되지 않았습니다.'],
      checks: ['평일과 금·토요일의 18–23시를 나누어 관찰하세요.', '주류·식재료·잔 재고와 폐기·도난 관리 방식을 점검하세요.', '임대차 영업시간·소음·주류 관련 허용 조건을 확인하세요.'],
      KR: { rent: 2500000, management: 250000, payroll: 7500000, otherFixed: 1300000, depreciation: 650000, variableRate: 0.35, ticket: 35000, deposit: 25000000, transfer: 0, fitout: 35000000, openingCosts: 4000000, reserve: 22000000 },
      JP: { rent: 250000, management: 25000, payroll: 750000, otherFixed: 130000, depreciation: 70000, variableRate: 0.35, ticket: 3500, deposit: 1500000, transfer: 0, fitout: 3500000, openingCosts: 450000, reserve: 2300000 }
    },
    {
      id: 'grill', name: '구이·고기 전문점', service: 'dining', complexity: 4,
      dayparts: ['evening', 'allday'], primary: 'evening', minSeats: 24, minAreaM2: 55,
      capacityBasis: 'seats', seats: 32, turns: 2, occupancy: 0.5,
      staff: 4, focusBands: ['17_21'], industries: ['CS100001'],
      requirements: ['숙련 조리 담당자와 식재료·원가 관리', '대표 포함 4인 운영 가정', '충분한 배기·급기·전력·가스·방재 조건'],
      weaknesses: ['배기와 설비 공사비가 매물마다 크게 달라 견적 검증이 필요합니다.', '고기 원가·재고·인력 부담을 동시에 관리해야 합니다.'],
      checks: ['구이 업종 가능 여부와 배기 경로를 계약 전에 확인하세요.', '부위별 수율·원가·폐기와 인력 배치를 시험하세요.', '같은 객단가의 구이점과 회식 수요를 직접 조사하세요.'],
      KR: { rent: 3000000, management: 300000, payroll: 9000000, otherFixed: 1600000, depreciation: 850000, variableRate: 0.42, ticket: 40000, deposit: 30000000, transfer: 0, fitout: 50000000, openingCosts: 5000000, reserve: 30000000 },
      JP: { rent: 300000, management: 30000, payroll: 1000000, otherFixed: 150000, depreciation: 100000, variableRate: 0.42, ticket: 4500, deposit: 1800000, transfer: 0, fitout: 5000000, openingCosts: 550000, reserve: 3000000 }
    }
  ];
  var bandHours = { '00_06': 6, '06_11': 5, '11_14': 3, '14_17': 3, '17_21': 4, '21_24': 3 };
  var availableBands = { lunch: ['06_11', '11_14', '14_17'], evening: ['17_21', '21_24'], allday: Object.keys(bandHours) };

  function finite(n) { return typeof n === 'number' && Number.isFinite(n); }
  function nonnegative(n) { return finite(n) && n >= 0; }
  function amount(n, country) { return Math.round(n).toLocaleString('ko-KR') + (country === 'KR' ? '원' : '엔'); }
  function unique(xs) { return xs.filter(function (x, i) { return xs.indexOf(x) === i; }); }
  function areaEvidence(area, country) {
    var evidence = [], gaps = [], a = area || {};
    if (nonnegative(a.residents && a.residents.total)) {
      evidence.push({ kind: 'residents', label: '거주·상주인구', value: a.residents.total, date: a.residents.date || '기준일 미확인', usedInScore: false, note: '지역 전체의 인구이며 실제 식당 고객이 아닙니다.' });
      var young = a.residents.groups && a.residents.groups['20-39'];
      if (nonnegative(young) && a.residents.total > 0 && young <= a.residents.total) {
        evidence.push({ kind: 'residentAge', label: '20–39세 거주·상주 구성비', value: young / a.residents.total, date: a.residents.date || '기준일 미확인', usedInScore: false, note: '연령을 음식 선호나 구매 성향으로 바꾸지 않습니다.' });
      }
    } else gaps.push('지역 거주·상주인구 자료가 없습니다.');
    if (nonnegative(a.workers && a.workers.total)) {
      evidence.push({ kind: 'workers', label: country === 'JP' ? '민영 사업장 종사자' : '직장인구 추정', value: a.workers.total, date: a.workers.date || '기준일 미확인', usedInScore: false, note: country === 'JP' ? '2021년 자료로 현재 점심 수요 점수에 반영하지 않습니다.' : '수록 분기와 원천 측정일이 달라 현재 점심 수요 점수에 반영하지 않습니다.' });
    } else gaps.push('직장·종사자 자료가 없습니다.');
    if (!a.flow) gaps.push('방문·생활인구와 시간대 자료가 없습니다. 지역의 시간대 수요는 평가하지 못합니다.');
    else evidence.push({ kind: 'flow', label: '시간대 구성의 원자료', value: nonnegative(a.flow.total) ? a.flow.total : null, date: a.flow.date || '기준일 미확인', usedInScore: false, note: '일평균·고유 방문자·점포 구매 고객으로 환산하지 않습니다. 관측 당시 구성 참고치입니다.' });
    gaps.push('실제 구매 고객의 연령, 소비액, 재방문 자료가 없습니다.');
    gaps.push('공실·보증금·권리금·설비와 인허가·공사비를 실제 매물별로 확인해야 합니다.');
    return { evidence: evidence, gaps: gaps };
  }
  function periodSignal(area, def, profile) {
    var bands = area && area.flow && area.flow.timeBands;
    var keys = Object.keys(bandHours);
    if (!bands || !keys.every(function (k) { return nonnegative(bands[k]); })) return null;
    var total = keys.reduce(function (s, k) { return s + bands[k]; }, 0);
    if (!finite(total) || total <= 0) return null;
    var focus = def.focusBands.filter(function (k) { return availableBands[profile.daypart].indexOf(k) !== -1; });
    if (!focus.length) return null;
    var value = focus.reduce(function (s, k) { return s + bands[k]; }, 0);
    var hours = focus.reduce(function (s, k) { return s + bandHours[k]; }, 0);
    // Normalize unequal interval widths before comparing compositions; this is
    // an index of the supplied aggregate, never a count of hourly customers.
    var index = (value / total) / (hours / 24);
    if (!finite(index)) return null;
    var points = index >= 1.2 ? 8 : index >= 0.85 ? 3 : -6;
    return { kind: 'timeComposition', label: '영업 시간대 구성 참고', bands: focus, share: value / total, hourlyCompositionIndex: index, date: area.flow.date || '기준일 미확인', points: points, usedInScore: true, note: '사용자의 영업 가능 시간과 겹치는 구간만 사용하고 서로 다른 시간 구간 폭을 보정한 상대 지표입니다. 시간당 실제 인구·구매 수요가 아니며 가중치와 문턱값은 사전 규칙입니다.' };
  }
  function quarterLabel(value) {
    var raw = String(value || '');
    var match = /^(\d{4})([1-4])$/.exec(raw);
    return match ? match[1] + '년 ' + match[2] + '분기' : raw;
  }
  function competitionEvidence(competition, def) {
    if (!competition || !Array.isArray(competition.industries)) return null;
    var matches = competition.industries.filter(function (r) { return def.industries.indexOf(r.code) !== -1; });
    if (!matches.length) return null;
    return { kind: 'competition', label: '관련 업종의 상권 집계', usedInScore: false,
      period: quarterLabel(competition.reporting_quarter || competition.quarter || (competition.source && (competition.source.reporting_quarter || competition.source.quarter))) || '원자료 기준분기 확인',
      rows: matches.map(function (r) {
        var available = r.available !== false;
        var qualityFlags = Array.isArray(r.quality_flags) ? r.quality_flags.slice() : [];
        return { code: r.code, name: r.name, available: available,
          requiresReview: r.recommendation_eligible === false || qualityFlags.length > 0,
          qualityFlags: qualityFlags,
          reportedStoreCount: available && nonnegative(r.reported_store_count) ? r.reported_store_count : null,
          similarIndustryStoreCount: available && nonnegative(r.similar_industry_store_count) ? r.similar_industry_store_count : null,
          openings: available && nonnegative(r.openings) ? r.openings : null,
          closures: available && nonnegative(r.closures) ? r.closures : null,
          franchiseCount: available && nonnegative(r.franchise_count) ? r.franchise_count : null };
      }),
      note: '넓은 업종 분류의 상권 집계입니다. 현재 직접 경쟁점 전수나 점포별 고객 연령이 아니며, 상권 크기가 달라 점포 수로 점수를 차감하지 않습니다.' };
  }
  function finance(a) {
    var fixed = a.rent + a.management + a.payroll + a.otherFixed + a.depreciation;
    var margin = 1 - a.variableRate;
    var capacity = a.capacityBasis === 'orders' ? a.ordersPerDay : a.seats * a.turns;
    var customersPerDay = capacity * a.occupancy;
    var revenue = customersPerDay * a.ticket * a.days;
    var operatingProfit = revenue * margin - fixed;
    return { fixed: fixed, bepRevenue: fixed / margin, bepCustomersPerDay: fixed / margin / a.ticket / a.days,
      targetRevenue: (fixed + a.targetProfit) / margin, targetCustomersPerDay: (fixed + a.targetProfit) / margin / a.ticket / a.days,
      revenue: revenue, customersPerDay: customersPerDay, capacity: capacity, capacityBasis: a.capacityBasis, demandUnit: a.capacityBasis === 'orders' ? '건/일' : '명/일',
      operatingProfit: operatingProfit, cashAfterDebt: operatingProfit + a.depreciation - a.debtPrincipal,
      maxAffordableRent: revenue * margin - a.management - a.payroll - a.otherFixed - a.depreciation - a.targetProfit,
      requiredTurns: a.capacityBasis === 'seats' ? (fixed / margin / a.ticket / a.days) / a.seats / a.occupancy : null,
      requiredOrdersPerDay: a.capacityBasis === 'orders' ? fixed / margin / a.ticket / a.days / a.occupancy : null,
      note: '입력 가정의 세전 산술 결과이며 수요·매출·이익의 예측값이 아닙니다. 원금 상환 후 현금에서 설비투자·보증금·운전자본 변화는 제외됩니다.' };
  }

  function recommend(input) {
    input = input || {};
    var country = input.country, area = input.area || null, p = input.profile || {}, errors = [];
    if (country !== 'KR' && country !== 'JP') errors.push('국가는 KR 또는 JP여야 합니다.');
    if (!nonnegative(p.totalBudget)) errors.push('가용 총예산을 0 이상의 숫자로 입력해 주세요.');
    var profile = { totalBudget: p.totalBudget, daypart: p.daypart || 'allday', experience: p.experience || 'new', service: p.service || 'any', seats: p.seats == null ? null : p.seats, areaM2: p.areaM2 == null ? null : p.areaM2, maxRent: p.maxRent == null ? null : p.maxRent, targetAge: p.targetAge || null };
    if (['lunch', 'evening', 'allday'].indexOf(profile.daypart) === -1) errors.push('영업시간 조건을 선택해 주세요.');
    if (['new', 'experienced'].indexOf(profile.experience) === -1) errors.push('운영 경험 조건을 선택해 주세요.');
    if (['any', 'quick', 'cafe', 'dining'].indexOf(profile.service) === -1) errors.push('선호 운영 형태를 선택해 주세요.');
    if (profile.seats !== null && (!Number.isSafeInteger(profile.seats) || profile.seats < 0)) errors.push('좌석 수는 0 이상의 정수여야 합니다. 포장 전용은 0석입니다.');
    if (profile.areaM2 !== null && (!finite(profile.areaM2) || profile.areaM2 <= 0)) errors.push('면적은 0보다 큰 제곱미터 수여야 합니다.');
    if (profile.maxRent !== null && !nonnegative(profile.maxRent)) errors.push('월 임대료 상한은 0 이상의 숫자여야 합니다.');
    var base = { valid: !errors.length, errors: errors, version: VERSION, title: '내 조건에 맞춘 검토 우선순위', basis: BASIS, assumptionNote: ASSUMPTION_NOTE, currency: country === 'JP' ? 'JPY' : 'KRW', profile: profile, areaId: area && area.id || null, areaEvidence: [], dataGaps: [], warnings: [], candidates: [], excluded: [], eligibleCount: 0, totalCandidates: definitions.length };
    if (errors.length) return base;
    var ae = areaEvidence(area, country);
    base.areaEvidence = ae.evidence;
    base.dataGaps = ae.gaps;
    if (!area) base.warnings.push('지역이 선택되지 않아 운영 조건만으로 임시 비교합니다.');
    if (!area || !area.flow) base.warnings.push('해당 지역의 방문·시간대 자료가 없어 지역 수요 적합성을 확인하지 못했습니다.');
    if (profile.targetAge) base.warnings.push('선택 연령은 지역 구성의 참고 정보이며 음식 선호나 점포 고객 연령 점수로 사용하지 않습니다.');
    var eligible = [];
    definitions.forEach(function (def) {
      var a = Object.assign({}, def[country], { currency: base.currency, days: 26, seats: def.seats, turns: def.turns, occupancy: def.occupancy, capacityBasis: def.capacityBasis, ordersPerDay: def.ordersPerDay || null, debtPrincipal: 0, targetProfit: country === 'KR' ? 1500000 : 200000, staffPeople: def.staff, ownerPayIncluded: true, minimumAreaM2: def.minAreaM2, note: ASSUMPTION_NOTE });
      if (profile.seats !== null && def.capacityBasis === 'seats' && profile.seats >= def.minSeats) a.seats = profile.seats;
      var plannedCash = a.deposit + a.transfer + a.fitout + a.openingCosts + a.reserve;
      var blockers = [], reasons = [], weaknesses = def.weaknesses.slice(), fieldChecks = def.checks.slice();
      if (profile.totalBudget < plannedCash) blockers.push({ code: 'budget', text: '이 계획 가정의 초기 현금 ' + amount(plannedCash, country) + '보다 가용예산이 ' + amount(plannedCash - profile.totalBudget, country) + ' 부족합니다.' });
      if (def.dayparts.indexOf(profile.daypart) === -1) blockers.push({ code: 'daypart', text: timeLabels[profile.daypart] + ' 조건과 이 후보의 운영시간 가정이 맞지 않습니다.' });
      if (profile.experience === 'new' && def.complexity >= 4) blockers.push({ code: 'experience', text: '숙련 조리·원가·설비 관리자가 확보되지 않은 신규 운영 가정에서는 보류합니다.' });
      if (profile.areaM2 !== null && profile.areaM2 < def.minAreaM2) blockers.push({ code: 'area', text: '이 운영안은 계획상 최소 ' + def.minAreaM2 + '㎡를 가정합니다. 실제 설계와 설비 기준을 확인해야 합니다.' });
      if (profile.seats !== null && profile.seats < def.minSeats) blockers.push({ code: 'seats', text: '이 좌석형 운영안은 계획상 ' + def.minSeats + '석 이상을 가정합니다.' });
      if (profile.maxRent !== null && a.rent > profile.maxRent) blockers.push({ code: 'rent', text: '계획 월세 ' + amount(a.rent, country) + '가 입력 상한 ' + amount(profile.maxRent, country) + '를 넘습니다. 더 낮은 실제 매물로 재산정해야 합니다.' });
      var f = finance(a);
      if (Object.keys(f).some(function (key) { return typeof f[key] === 'number' && !finite(f[key]); })) blockers.push({ code: 'range', text: '입력 규모가 계산 가능한 범위를 넘습니다.' });
      if (blockers.length) {
        base.excluded.push({ id: def.id, name: def.name, status: '현재 가정으로 보류', blockers: blockers, budget: { minimumCash: plannedCash, plannedCash: plannedCash, label: '이 계획 가정의 초기 현금', remaining: profile.totalBudget - plannedCash, feasible: profile.totalBudget >= plannedCash }, note: '실측 최소 창업비가 아닙니다. 매물·설비·인력 조건을 바꾸면 다시 검토할 수 있습니다.' });
        return;
      }

      var breakdown = [{ criterion: '비교 출발점', points: 45, reason: '모든 후보에 동일하게 적용하는 사전 규칙' }];
      var remaining = profile.totalBudget - plannedCash;
      var cushionRatio = profile.totalBudget > 0 ? remaining / profile.totalBudget : 0;
      var budgetPoints = cushionRatio >= 0.4 ? 12 : cushionRatio >= 0.2 ? 8 : cushionRatio >= 0.1 ? 3 : 0;
      breakdown.push({ criterion: '예산 여유', points: budgetPoints, reason: '개점·예비자금 가정 차감 후 추가 여유 ' + amount(remaining, country) });
      reasons.push('초기 현금 ' + amount(plannedCash, country) + ' 가정이 예산 안에 들어오며, 추가 여유는 ' + amount(remaining, country) + '입니다.');
      if (cushionRatio < 0.1) weaknesses.push('예비자금을 포함한 계획 이후 추가 여유가 예산의 10% 미만입니다. 견적 초과에 취약한 가정입니다.');
      var expPoints = profile.experience === 'new' ? ({1: 10, 2: 4, 3: -12, 4: -25}[def.complexity]) : ({1: 2, 2: 4, 3: 8, 4: 10}[def.complexity]);
      breakdown.push({ criterion: '운영 경험', points: expPoints, reason: profile.experience === 'new' ? '신규 운영에서는 메뉴·인력·설비 복잡도를 낮게 평가합니다.' : '운영 경험을 전제로 복잡한 조리·서비스 방식도 검토합니다.' });
      if (profile.experience === 'new' && def.complexity <= 2) reasons.push('메뉴와 작업을 제한하는 운영안으로 신규 운영 경험 조건에 상대적으로 맞습니다.');
      if (profile.experience === 'new' && def.complexity === 3) weaknesses.push('초보 운영 조건에서는 조리·인력 관리 부담이 커 숙련 담당자를 먼저 확보해야 합니다.');
      if (profile.experience === 'experienced' && def.complexity >= 3) reasons.push('기존 운영 경험이 있다는 조건에서 조리·인력 관리가 필요한 형태도 검토합니다.');
      var servicePoints = profile.service === 'any' ? 0 : profile.service === def.service ? 16 : -8;
      breakdown.push({ criterion: '선호 운영 형태', points: servicePoints, reason: profile.service === 'any' ? '선호 형태 제한 없음' : serviceLabels[profile.service] + ' 선호와 ' + (profile.service === def.service ? '일치' : '차이') });
      if (profile.service === def.service) reasons.push('선택하신 ' + serviceLabels[profile.service] + ' 운영 방식에 맞습니다.');
      else if (profile.service !== 'any') weaknesses.push('선호한 ' + serviceLabels[profile.service] + '와 다른 대안입니다.');
      var dayPoints = profile.daypart === 'allday' ? 2 : profile.daypart === def.primary ? 8 : 4;
      breakdown.push({ criterion: '영업 가능 시간', points: dayPoints, reason: timeLabels[profile.daypart] + ' 조건 안에서 운영 가정 설정' });
      reasons.push(timeLabels[profile.daypart] + ' 조건에서 검토 가능한 운영안입니다.');
      var local = ae.evidence.slice(), signal = periodSignal(area, def, profile);
      if (signal) {
        local.push(signal);
        breakdown.push({ criterion: '관측 당시 시간대 구성', points: signal.points, reason: signal.date + ' 원자료의 시간 구간 폭을 보정한 비교값. 구매 수요 검증 아님.' });
        if (signal.hourlyCompositionIndex >= 1) reasons.push('관측 당시 관련 시간대의 원자료 구성이 24시간 평균 구성 이상입니다. 실제 구매 수요는 별도 확인해야 합니다.');
        else if (signal.points > 0) reasons.push('관측 당시 관련 시간대의 원자료 구성이 24시간 평균 구성에 가까운 참고 범위입니다. 실제 구매 수요는 별도 확인해야 합니다.');
        else weaknesses.push('관측 당시 관련 시간대 구성이 24시간 평균 구성보다 낮습니다. 현장 수요 확인이 필요합니다.');
      } else {
        breakdown.push({ criterion: '관측 당시 시간대 구성', points: 0, reason: '자료 부족으로 가점·감점하지 않음' });
        weaknesses.push('시간대 방문 자료가 없어 이 지역에 적합한 영업시간인지 아직 확인할 수 없습니다.');
      }
      var competitionData = competitionEvidence(input.competition, def);
      if (competitionData) {
        local.push(competitionData);
        if (competitionData.rows.some(function (r) { return r.requiresReview; })) weaknesses.push('관련 업종의 집계에 원자료 검토가 필요한 행이 있습니다. 추천 점수에는 사용하지 않습니다.');
        if (competitionData.rows.some(function (r) { return !r.available || r.reportedStoreCount === null; })) weaknesses.push('관련 업종 중 집계가 누락된 항목이 있습니다. 누락을 0개로 해석하지 않습니다.');
        weaknesses.push('관련 업종의 공식 점포 집계가 있으나 직접 경쟁·가격대·현재 영업 여부를 별도 확인해야 합니다.');
      } else weaknesses.push('관련 업종의 경쟁점 집계가 연결되지 않았습니다. 경쟁 강도는 미확인입니다.');
      if (f.operatingProfit < 0) {
        breakdown.push({ criterion: '계획 가정의 손익', points: -10, reason: '가정한 판매량에서도 손익분기 미달' });
        weaknesses.push('가정한 판매량에서도 적자입니다. 월세·인건비·원가율·가격 또는 처리량을 다시 설정해야 합니다.');
      }
      if (f.bepCustomersPerDay > f.capacity) weaknesses.push('현재 처리량 상한으로는 가동률 100%에서도 손익분기에 도달하지 못합니다.');
      if (f.maxAffordableRent < 0) weaknesses.push('임대료가 0이어도 입력 가정의 목표 영업이익에 도달하지 못합니다.');
      if (profile.seats !== null && def.capacityBasis === 'seats' && profile.seats !== def.seats) weaknesses.push('좌석 수는 입력값을 반영했지만 공사비·인력은 기본 가정입니다. 변경 규모의 실제 견적을 다시 입력해야 합니다.');
      if (a.transfer === 0) weaknesses.push('권리금·양도금 0을 가정했습니다. 실제 매물에서 발생하면 추가 현금이 필요합니다.');
      fieldChecks.push('현재 가정의 손익분기 ' + Math.ceil(f.bepCustomersPerDay) + f.demandUnit + '을 확보할 근거를 평일·주말 현장 조사로 확인하세요.');
      fieldChecks.push('보증금·공사·개점비·관리비·대표자 보수와 부담금을 견적으로 교체하세요.');
      var score = Math.max(0, Math.min(100, breakdown.reduce(function (s, b) { return s + b.points; }, 0)));
      eligible.push({ id: def.id, name: country === 'JP' && def.id === 'bar' ? '소형 이자카야·다이닝바' : def.name, score: score, scoreLabel: '내조건맞춤 비교점수', status: signal ? '현장 수요 검증 후보' : '운영 조건만 비교 · 지역 수요 미확인', reasons: reasons, weaknesses: unique(weaknesses), localEvidence: local, competitionEvidence: competitionData, requirements: def.requirements.slice(), conditions: { service: def.service, serviceLabel: serviceLabels[def.service], allowedDayparts: def.dayparts.slice(), selectedDaypart: profile.daypart, operatingFocus: timeLabels[def.primary], minimumSeats: def.minSeats, minimumAreaM2: def.minAreaM2, complexity: def.complexity, note: '면적·좌석·시간은 이 계획의 가정이며 법적 최소 기준이나 모든 해당 업종의 조건이 아닙니다.' }, budget: { minimumCash: plannedCash, plannedCash: plannedCash, remaining: remaining, feasible: true, label: '이 계획 가정의 초기 현금', includesReserve: true, deposit: a.deposit, transfer: a.transfer, fitout: a.fitout, openingCosts: a.openingCosts, reserve: a.reserve, note: '가용예산은 확정된 조달 가능액만 입력하며, 차입금 원금 상환은 별도로 재계산해야 합니다.' }, assumptions: a, finance: f, fieldChecks: unique(fieldChecks), scoreBreakdown: breakdown });
    });
    eligible.sort(function (a, b) { return b.score - a.score || a.budget.plannedCash - b.budget.plannedCash || a.id.localeCompare(b.id); });
    base.eligibleCount = eligible.length;
    base.candidates = eligible.slice(0, 3).map(function (item, i) { item.rank = i + 1; return item; });
    base.otherEligible = eligible.slice(3).map(function (item) { return { id: item.id, name: item.name, score: item.score, scoreLabel: item.scoreLabel, plannedCash: item.budget.plannedCash }; });
    if (!eligible.length) base.warnings.push('현재 예산·시간·경험·공간 조건을 만족하는 기본 운영안이 없습니다. 예산을 늘리기 전에 공유주방·팝업·검증된 저비용 매물 등으로 계획 자체를 줄여 다시 산정해야 합니다.');
    else if (eligible.length < 3) base.warnings.push('현재 조건에 맞는 기본 운영안이 ' + eligible.length + '개뿐입니다. 세 개를 채우기 위해 조건 밖 후보를 넣지 않았습니다.');
    base.dataGaps = unique(base.dataGaps);
    base.warnings = unique(base.warnings);
    return base;
  }

  return Object.freeze({ recommend: recommend, version: VERSION });
});
