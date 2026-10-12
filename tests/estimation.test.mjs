import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gradeEstimate, estimateStats, ruleStats, readHistory, HISTORY_KEY } from '../public/history.js';
import { comboCount, RULES, estimateFor } from '../src/rules.js';
import { measureRules, reportTable } from '../scripts/math-audit.mjs';

const data = JSON.parse(await readFile(new URL('../public/spots.json', import.meta.url), 'utf8'));
test('every teaching rule has reproducible engine measurements and the same MATH report', async () => {
  const measured = measureRules();
  const saved = JSON.parse(await readFile(new URL('../public/rules.json', import.meta.url), 'utf8'));
  assert.deepEqual(measured, saved, 'Run npm run math:audit after changing the engine, rules or sweep.');
  assert.deepEqual(data.rules, saved, 'Run npm run build after the audit.');
  assert.ok((await readFile(new URL('../MATH.md', import.meta.url), 'utf8')).includes(reportTable(measured)));
  assert.deepEqual(Object.keys(measured), Object.keys(RULES));
  for (const r of Object.values(measured)) { assert.ok(r.samples >= 8); assert.ok(Number.isFinite(r.mean)); assert.ok(r.worst >= r.mean); }
  assert.ok(measured['rule-4'].maxSigned > 5, 'Many flop outs must show overstatement.');
  assert.ok(measured['rule-2'].minSigned < -2);
  assert.ok(measured.domination.worst > 10, 'Low-kicker near ties must expose the limit of 70/30.');
});
test('every spot has a measured shortcut, finite exact target and valid scale', () => {
  for (const type of ['equity', 'outs', 'pot', 'range']) for (const spot of data[type]) {
    const e = spot.estimate;
    assert.deepEqual(e, estimateFor(type, spot));
    assert.ok(data.rules[e.rule], spot.id);
    assert.ok(Number.isFinite(e.exact) && Number.isFinite(e.quick) && e.scale > 0, spot.id);
    assert.ok(Math.abs(e.exact - e.quick) <= data.rules[e.rule].worst + 1e-9, spot.id);
  }
  assert.equal(data.equity.find(s => s.id === 'e-river-split').estimate.exact, 50);
  assert.throws(() => estimateFor('range', { ...data.range[0], estimateCategory: 'unknown' }), /Unknown range category/);
});
test('closeness scoring is continuous, bounded, and normalized to the asked quantity', () => {
  const percent = { exact: 30, quick: 28, scale: 100, unit: '%', rule: 'rule-2' };
  assert.equal(gradeEstimate(30, percent).score, 100);
  assert.equal(gradeEstimate(34, percent).score, 96);
  assert.equal(gradeEstimate(34.5, percent).score, 95.5);
  assert.equal(gradeEstimate(100, percent).score, 30);
  for (const value of [NaN, Infinity, -1, 101]) assert.throws(() => gradeEstimate(value, percent));
  const expired = gradeEstimate(NaN, percent, true);
  assert.equal(expired.score, 0); assert.equal(expired.guess, null); assert.equal(expired.error, null);
  assert.equal(gradeEstimate(34, percent, true).score, 96);
  const dollars = { ...percent, unit: '$', scale: 40, exact: 60 };
  assert.equal(gradeEstimate(64, dollars).score, 90);
  assert.equal(gradeEstimate(1000000, dollars).score, 0);
  assert.equal(gradeEstimate(15, { ...percent, unit: 'combos', exact: 16, scale: 16 }).score, 93.75);
});
test('blocker shortcuts handle zero combos and suit intersections', () => {
  assert.equal(comboCount('AA', 'As Ah'), 1);
  assert.equal(comboCount('AA', 'As Ah Ad'), 0);
  assert.equal(comboCount('AK', 'As Kd'), 9);
  assert.equal(comboCount('AKs', 'As Kd'), 2);
  assert.equal(comboCount('AKo', 'As Kd'), 7);
  assert.throws(() => comboCount('AA+', ''));
  assert.throws(() => comboCount('AK', 'As As'));
});
test('estimate history preserves original attempts and ranks weakest rules by score', () => {
  const old = { type: 'equity', topic: 'Old topic', id: 'old', at: 1, correct: true, score: 100, error: 0 };
  const entry = { ...old, ...gradeEstimate(50, { exact: 30, quick: 28, scale: 100, unit: '%', rule: 'rule-2' }) };
  const good = { ...entry, rule: 'rule-4', score: 98, error: 2 };
  const entries = [old, entry, good];
  assert.deepEqual(readHistory({ getItem: key => key === HISTORY_KEY ? JSON.stringify(entries) : null }).entries, entries);
  assert.equal(estimateStats(entries).score, 89); assert.equal(estimateStats(entries).total, 2);
  assert.equal(ruleStats(entries)[0].rule, 'rule-2');
  assert.equal(estimateStats([]).score, null);
  assert.equal(readHistory({ getItem: () => JSON.stringify([{ ...entry, normalizedError: 'bad' }]) }).available, false);
});
