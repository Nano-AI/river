import test from 'node:test';
import assert from 'node:assert/strict';
import { grade, readHistory, saveHistory, summarize, weakSpots, HISTORY_KEY } from '../public/history.js';
const entry = { type: 'equity', topic: 'Flush draws', id: 'e-flush', at: 1, score: 90, error: 10, correct: false };
test('grading uses percentage points and checks every component', () => {
  assert.equal(grade('equity', { win: 45 }, { win: 50 }).correct, true);
  assert.equal(grade('equity', { win: 44.9 }, { win: 50 }).correct, false);
  assert.equal(grade('outs', { outs: 8, chance: 35 }, { count: 9, chance: 35 }).correct, false);
  assert.equal(grade('outs', { outs: 9, chance: 35 }, { count: 9, chance: 35 }).correct, true);
  assert.equal(grade('range', { made: 50, draw: 30, air: 20 }, { fractions: { made: 50, draw: 30, air: 20 } }).correct, true);
  assert.throws(() => grade('range', { made: 50, draw: 50, air: 50 }, {}));
  assert.throws(() => grade('equity', { win: NaN }, {}));
  assert.throws(() => grade('pot', { choice: 'raise' }, {}));
  assert.equal(grade('pot', { choice: 'fold' }, { choice: 'call' }).score, 0);
});
test('history preserves successful attempts and handles malformed or blocked storage', () => {
  const data = new Map(); const storage = { getItem: k => data.get(k), setItem: (k, v) => data.set(k, v) };
  assert.deepEqual(readHistory(storage), { entries: [], available: true });
  assert.equal(saveHistory(storage, [entry]), true); assert.deepEqual(readHistory(storage).entries, [entry]);
  data.set(HISTORY_KEY, '{broken'); assert.equal(readHistory(storage).available, false);
  data.set(HISTORY_KEY, JSON.stringify([{ ...entry, score: 'oops' }])); assert.equal(readHistory(storage).available, false);
  assert.equal(saveHistory({ setItem() { throw new Error('quota'); } }, []), false);
  assert.equal(readHistory({ getItem() { throw new Error('blocked'); } }).available, false);
});
test('accuracy, empty states and weak topics are based on recorded attempts', () => {
  assert.equal(summarize([]).accuracy, null);
  const entries = [entry, entry, { ...entry, correct: true, error: 0 }, { ...entry, type: 'pot', topic: 'Direct pot odds', error: null, correct: true }];
  assert.equal(summarize(entries).accuracy, 50); assert.equal(summarize(entries).meanError, 20 / 3);
  assert.deepEqual(weakSpots(entries).map(t => t.topic), ['Flush draws']);
  assert.equal(weakSpots([entry]).length, 0);
});
