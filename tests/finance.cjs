'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const file = require.resolve('../public/domain.js');
// The project is ESM; execute the deployed UMD in an isolated CommonJS wrapper.
const umd = { exports: {} };
vm.runInThisContext('(function(module, window) {\n' + fs.readFileSync(file, 'utf8') + '\n})', { filename: file })(umd, {});
const { calculate } = umd.exports;
const base = {
  rent: 400000, management: 50000, payroll: 750000, otherFixed: 200000,
  depreciation: 100000, variableRate: 0.35, ticket: 1800, days: 26,
  seats: 24, turns: 3, occupancy: 0.75, debtPrincipal: 150000,
  targetProfit: 300000
};
const close = (actual, expected) => assert.ok(
  Math.abs(actual - expected) <= Math.max(1e-7, Math.abs(expected) * 1e-12),
  `${actual} should equal ${expected}`
);

const r = calculate(base);
assert.equal(r.valid, true);
assert.equal(r.fixed, 1500000);
close(r.bepRevenue, 1500000 / 0.65);
close(r.bepCustomersPerDay, 1500000 / 0.65 / 1800 / 26);
assert.equal(r.customersPerDay, 54);
assert.equal(r.capacity, 72);
assert.equal(r.revenue, 2527200);
close(r.operatingProfit, 142680);
close(r.cashAfterDebt, 92680);
close(r.cashAfterDebt - r.operatingProfit, -50000);
close(r.requiredTurns, r.bepCustomersPerDay / 24 / 0.75);
close(r.targetRevenue * 0.65 - r.fixed, 300000);
close(r.revenue * 0.65 - base.management - base.payroll - base.otherFixed
  - base.depreciation - r.maxAffordableRent, base.targetProfit);

const lowDemand = calculate({ ...base, occupancy: 0.10 });
assert.equal(lowDemand.valid, true);
assert.ok(lowDemand.maxAffordableRent < 0);

for (const patch of [
  { variableRate: 1 }, { variableRate: -0.1 }, { variableRate: Infinity },
  { occupancy: 1.1 }, { occupancy: -0.1 }, { ticket: 0 }, { days: 0 },
  { seats: 0 }, { turns: 0 }, { rent: NaN }, { rent: -1 }, { rent: '400000' }
]) {
  const bad = calculate({ ...base, ...patch });
  assert.equal(bad.valid, false, JSON.stringify(patch));
  assert.ok(bad.errors.length > 0);
  assert.equal(bad.bepRevenue, null);
  assert.equal(bad.requiredTurns, null);
}
assert.equal(calculate(null).valid, false);
assert.equal(calculate({}).valid, false);
assert.equal(calculate({ ...base, ticket: Number.MAX_VALUE }).valid, false);
const zeroOccupancy = calculate({ ...base, occupancy: 0 });
assert.equal(zeroOccupancy.valid, true);
assert.equal(zeroOccupancy.revenue, 0);
assert.equal(zeroOccupancy.requiredTurns, null);
assert.ok(zeroOccupancy.notes.some(n => n.includes('착석률 0%')));

const context = { window: {} };
vm.runInNewContext(fs.readFileSync(file, 'utf8'), context);
assert.equal(typeof context.window.AtlasDomain.calculate, 'function');
close(context.window.AtlasDomain.calculate(base).bepRevenue, r.bepRevenue);

console.log('PASS: break-even math; target-profit identity; capacity; cash/accounting distinction; negative affordable rent; invalid/overflow/zero-occupancy handling; browser and Node exports.');
console.log(JSON.stringify({ bepRevenue: r.bepRevenue,
  bepCustomersPerDay: r.bepCustomersPerDay, operatingProfit: r.operatingProfit,
  cashAfterDebt: r.cashAfterDebt, negativeAffordableRent: lowDemand.maxAffordableRent }, null, 2));
