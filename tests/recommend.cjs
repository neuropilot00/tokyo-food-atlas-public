'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
// Load deployed UMD sources through VM even when package.json uses type=module.
function loadUMD(name) {
  const file = require.resolve('../public/' + name + '.js');
  const umd = { exports: {} };
  vm.runInThisContext('(function(module, window) {\n' + fs.readFileSync(file, 'utf8') + '\n})', { filename: file })(umd, {});
  return umd.exports;
}
const { recommend } = loadUMD('recommend');
const Domain = loadUMD('domain');
const db = JSON.parse(fs.readFileSync(require.resolve('../public/data.json'), 'utf8'));
const area = db.countries.KR.areas[0];
const profile = { totalBudget: 150000000, daypart: 'allday', experience: 'new', service: 'any' };
const original = JSON.stringify({ area, profile });
const result = recommend({ country: 'KR', area, profile });
assert.equal(result.valid, true);
assert.equal(result.totalCandidates, 6);
assert.equal(result.candidates.length, 3);
assert.equal(JSON.stringify({ area, profile }), original, 'Inputs must not be mutated');
assert.ok(result.candidates.every(x => x.score >= 0 && x.score <= 100));
assert.ok(result.excluded.some(x => x.id === 'grill' && x.blockers.some(b => b.code === 'experience')));
assert.ok(result.candidates.every(x => x.scoreLabel === '내조건맞춤 비교점수'));
assert.ok(result.candidates.every(x => x.assumptions.note.includes('시장 평균이 아닌')));

const low = recommend({ country: 'KR', area, profile: { ...profile, totalBudget: 31000000 } });
assert.equal(low.candidates.length, 0, 'Insufficient budget must not force three recommendations');
assert.ok(low.excluded.every(x => x.blockers.some(b => b.code === 'budget')));
const small = recommend({ country: 'KR', area, profile: { ...profile, totalBudget: 35000000 } });
assert.deepEqual(small.candidates.map(x => x.id), ['takeout']);

const cafe = recommend({ country: 'KR', area, profile: { ...profile, service: 'cafe' } });
assert.equal(cafe.candidates[0].id, 'cafe', 'Preferred operating form must change the ranking');
const dinner = recommend({ country: 'KR', area, profile: { ...profile, daypart: 'evening', experience: 'experienced', service: 'dining' } });
assert.ok(dinner.candidates.some(x => x.id === 'grill'));
assert.ok(dinner.excluded.some(x => x.id === 'meal' && x.blockers.some(b => b.code === 'daypart')));
assert.notDeepEqual(dinner.candidates.map(x => x.id), result.candidates.map(x => x.id));
const experienced = recommend({ country: 'KR', area, profile: { ...profile, experience: 'experienced' } });
assert.notDeepEqual(experienced.candidates.map(x => x.id), result.candidates.map(x => x.id), 'Experience must affect ranking, not just text');
const lunch = recommend({ country: 'KR', area, profile: { ...profile, daypart: 'lunch', service: 'quick' } });
const lunchBowl = lunch.candidates.find(x => x.id === 'bowls');
assert.deepEqual(lunchBowl.localEvidence.find(x => x.kind === 'timeComposition').bands, ['11_14'], 'Lunch comparison must not score evening demand');
const eveningBowl = dinner.candidates.find(x => x.id === 'bowls');
assert.deepEqual(eveningBowl.localEvidence.find(x => x.kind === 'timeComposition').bands, ['17_21'], 'Evening comparison must not score lunch demand');
const nearAverage = { flow: { timeBands: { '00_06': 600, '06_11': 500, '11_14': 270, '14_17': 330, '17_21': 400, '21_24': 300 } } };
const nearAverageLunch = recommend({ country: 'KR', area: nearAverage, profile: { ...profile, daypart: 'lunch', service: 'quick' } });
assert.ok(nearAverageLunch.candidates.find(x => x.id === 'takeout').reasons.some(x => x.includes('평균 구성에 가까운')));
assert.ok(!nearAverageLunch.candidates.find(x => x.id === 'takeout').reasons.some(x => x.includes('평균 구성 이상')));

const zeroSeats = recommend({ country: 'KR', area, profile: { ...profile, seats: 0 } });
assert.deepEqual(zeroSeats.candidates.map(x => x.id), ['takeout']);
const lowRent = recommend({ country: 'KR', area, profile: { ...profile, maxRent: 1200000 } });
assert.deepEqual(lowRent.candidates.map(x => x.id), ['takeout']);
const tinySpace = recommend({ country: 'KR', area, profile: { ...profile, areaM2: 10 } });
assert.equal(tinySpace.candidates.length, 0);

const missing = recommend({ country: 'JP', area: { id: 'unknown', name: '정보 없음' }, profile: { ...profile, totalBudget: 15000000 } });
assert.ok(missing.candidates.length > 0);
assert.ok(missing.dataGaps.some(x => x.includes('시간대')));
assert.ok(missing.candidates.every(x => x.status.includes('지역 수요 미확인')));
assert.ok(missing.candidates.every(x => x.localEvidence.length === 0));
const jp = recommend({ country: 'JP', area: db.countries.JP.areas[0], profile: { ...profile, totalBudget: 15000000 } });
assert.equal(jp.currency, 'JPY');
assert.ok(jp.areaEvidence.filter(x => x.kind === 'workers').every(x => x.usedInScore === false && x.note.includes('2021')));

const competition = { reporting_quarter: '20262', industries: [{ code: 'CS100001', name: '한식음식점', reported_store_count: 500, similar_industry_store_count: 510, openings: 5, closures: 4, franchise_count: 3 }] };
const withCompetition = recommend({ country: 'KR', area, profile, competition });
assert.deepEqual(withCompetition.candidates.map(x => [x.id, x.score]), result.candidates.map(x => [x.id, x.score]), 'Raw counts must not penalize large trade areas');
assert.equal(withCompetition.candidates.find(x => x.id === 'takeout').competitionEvidence.period, '2026년 2분기');
const withAge = recommend({ country: 'KR', area, profile: { ...profile, targetAge: '20-39' } });
assert.deepEqual(withAge.candidates.map(x => [x.id, x.score]), result.candidates.map(x => [x.id, x.score]), 'Area age must not become inferred food preference');

const close = (a,b) => assert.ok(Math.abs(a-b) <= Math.max(1e-7,Math.abs(b)*1e-12), `${a} != ${b}`);
for (const r of [...result.candidates, ...dinner.candidates]) {
  const a = r.assumptions, f = r.finance;
  close(f.bepRevenue * (1 - a.variableRate), f.fixed);
  close(f.bepCustomersPerDay * a.ticket * a.days, f.bepRevenue);
  close(r.budget.plannedCash, a.deposit + a.transfer + a.fitout + a.openingCosts + a.reserve);
  if (a.capacityBasis === 'seats') {
    const expected = Domain.calculate(a);
    assert.equal(expected.valid, true);
    for (const key of ['bepRevenue','bepCustomersPerDay','revenue','operatingProfit','cashAfterDebt','maxAffordableRent']) close(f[key], expected[key]);
  } else {
    assert.equal(a.seats, 0);
    assert.equal(f.requiredTurns, null);
    assert.equal(f.demandUnit, '건/일');
    close(f.customersPerDay, a.ordersPerDay * a.occupancy);
  }
}
for (const invalid of [
  { country: 'US', area, profile },
  { country: 'KR', area, profile: { ...profile, totalBudget: NaN } },
  { country: 'KR', area, profile: { ...profile, totalBudget: -1 } },
  { country: 'KR', area, profile: { ...profile, totalBudget: '50000000' } },
  { country: 'KR', area, profile: { ...profile, seats: 0.5 } },
  { country: 'KR', area, profile: { ...profile, maxRent: Infinity } },
  { country: 'KR', area, profile: { ...profile, daypart: 'toString' } },
  { country: 'KR', area, profile: { ...profile, service: 'constructor' } }
]) { const r = recommend(invalid); assert.equal(r.valid, false); assert.equal(r.candidates.length, 0); }
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(require.resolve('../public/recommend.js'),'utf8'), context);
assert.equal(typeof context.window.AtlasRecommend.recommend, 'function');
assert.equal(context.window.AtlasRecommend.recommend({country:'KR',area,profile}).candidates[0].id, result.candidates[0].id);
console.log('PASS: budget exclusion, experience and preference ranking, time/space/rent constraints, missing data, no age inference or raw-count penalty, accounting identities, input purity and browser/Node exports.');
console.log(JSON.stringify({ baseline: result.candidates.map(x=>({id:x.id,score:x.score})), experienced: experienced.candidates.map(x=>({id:x.id,score:x.score})), lowBudgetCandidates: low.candidates.length, takeawayBudget: small.candidates[0].budget.plannedCash }, null, 2));
