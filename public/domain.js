(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.AtlasDomain = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var fields = [
    'rent', 'management', 'payroll', 'otherFixed', 'depreciation',
    'variableRate', 'ticket', 'days', 'seats', 'turns', 'occupancy',
    'debtPrincipal', 'targetProfit'
  ];
  var positiveFields = ['ticket', 'days', 'seats', 'turns'];
  var labels = {
    rent: '월 임대료', management: '월 관리비', payroll: '월 고정 인건비',
    otherFixed: '월 기타 고정비', depreciation: '월 감가상각비',
    variableRate: '변동비율', ticket: '객단가', days: '월 영업일',
    seats: '좌석 수', turns: '하루 회전 수', occupancy: '평균 착석률',
    debtPrincipal: '월 대출 원금 상환', targetProfit: '목표 월 영업이익'
  };
  var metricNames = [
    'fixed', 'bepRevenue', 'bepCustomersPerDay', 'targetRevenue',
    'targetCustomersPerDay', 'revenue', 'customersPerDay', 'operatingProfit',
    'cashAfterDebt', 'maxAffordableRent', 'capacity', 'requiredTurns'
  ];
  var baseNotes = [
    '모든 금액은 화면에서 선택한 동일 통화 기준이며 매출·비용·이익은 월 기준입니다. 고객 수와 회전 수는 하루 기준입니다.',
    '매출은 입력한 좌석·회전·착석률·객단가로 계산한 시나리오이며 실제 수요 예측이 아닙니다.',
    '고정비에는 감가상각비가 포함됩니다. 인건비의 변동분은 변동비율에 포함하고 중복 계산하지 마세요.',
    '원금 상환 후 현금은 세전 단순 계산입니다. 설비투자·보증금·운전자본 변화는 제외하며 이자는 기타 고정비 등에 입력한 경우만 반영합니다.',
    'capacity는 100% 착석 시 하루 좌석 처리량이고 requiredTurns는 입력 착석률에서 손익분기에 필요한 하루 회전 수입니다.',
    '감당 가능한 임대료가 음수이면 임대료가 0이어도 입력한 목표 영업이익을 달성하지 못합니다.'
  ];

  function invalid(errors) {
    var result = { valid: false, errors: errors, notes: baseNotes.slice() };
    metricNames.forEach(function (name) { result[name] = null; });
    return result;
  }

  function calculate(p) {
    var errors = [];
    if (!p || typeof p !== 'object' || Array.isArray(p)) {
      return invalid(['계산할 입력값이 필요합니다.']);
    }
    fields.forEach(function (name) {
      if (typeof p[name] !== 'number' || !Number.isFinite(p[name])) {
        errors.push(labels[name] + ': 유효한 숫자를 입력하세요.');
      } else if (p[name] < 0) {
        errors.push(labels[name] + ': 0 이상이어야 합니다.');
      }
    });
    positiveFields.forEach(function (name) {
      if (Number.isFinite(p[name]) && p[name] === 0) {
        errors.push(labels[name] + ': 0보다 커야 합니다.');
      }
    });
    if (Number.isFinite(p.variableRate) && p.variableRate >= 1) {
      errors.push('변동비율은 0% 이상 100% 미만이어야 합니다.');
    }
    if (Number.isFinite(p.occupancy) && p.occupancy > 1) {
      errors.push('평균 착석률은 0% 이상 100% 이하여야 합니다.');
    }
    if (errors.length) return invalid(errors);

    var margin = 1 - p.variableRate;
    var fixed = p.rent + p.management + p.payroll + p.otherFixed + p.depreciation;
    var capacity = p.seats * p.turns;
    var customersPerDay = capacity * p.occupancy;
    var revenue = customersPerDay * p.ticket * p.days;
    var bepRevenue = fixed / margin;
    var bepCustomersPerDay = bepRevenue / p.ticket / p.days;
    var targetRevenue = (fixed + p.targetProfit) / margin;
    var operatingProfit = revenue * margin - fixed;
    var requiredTurns = p.occupancy > 0
      ? bepCustomersPerDay / p.seats / p.occupancy
      : (fixed === 0 ? 0 : null);

    var result = {
      valid: true,
      errors: [],
      fixed: fixed,
      bepRevenue: bepRevenue,
      bepCustomersPerDay: bepCustomersPerDay,
      targetRevenue: targetRevenue,
      targetCustomersPerDay: targetRevenue / p.ticket / p.days,
      revenue: revenue,
      customersPerDay: customersPerDay,
      operatingProfit: operatingProfit,
      cashAfterDebt: operatingProfit + p.depreciation - p.debtPrincipal,
      maxAffordableRent: revenue * margin - p.management - p.payroll
        - p.otherFixed - p.depreciation - p.targetProfit,
      capacity: capacity,
      requiredTurns: requiredTurns,
      notes: baseNotes.slice()
    };
    // Inputs can be individually finite and still overflow when combined.
    if (metricNames.some(function (name) {
      return result[name] !== null && !Number.isFinite(result[name]);
    })) return invalid(['입력값이 계산 가능한 범위를 초과했습니다. 금액과 수량을 확인하세요.']);

    if (p.occupancy === 0 && fixed > 0) {
      result.notes.push('착석률 0%에서는 손익분기에 도달할 수 없어 필요 회전 수를 계산하지 않습니다.');
    }
    return result;
  }

  return Object.freeze({ calculate: calculate });
});
