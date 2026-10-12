import test from 'node:test';
import assert from 'node:assert/strict';
import { exactEquity, potOdds, deck, cardName, parseCards, evaluate } from '../src/engine.js';
import { grade, gradeEstimate } from '../public/history.js';
import { referenceSeven } from './reference.mjs';
import { equitySpots } from '../src/scenarios.js';
import { postflopBreakdown } from '../src/rules.js';

test('standard deck has 52 unique cards; four spades are a draw, five make a flush', () => {
  assert.equal(deck.length, 52);
  assert.equal(new Set(deck.map(cardName)).size, 52);
  assert.deepEqual(parseCards(deck.map(cardName)), deck);
  assert.equal(evaluate('As Js Ks 8s 3d 2c').name, 'High card');
  assert.equal(evaluate('As Js Ks 8s 3d 2c 4s').name, 'Flush');
  assert.equal(evaluate('8c 8d 8h Qh 2s 4c').name, 'Three of a kind');
});

test('every authored multiway result agrees with independent deal expansion and five-card ranking', () => {
  const expected = { 'e-multi-flush': [2322, 0, 6318, 8640, 216], 'e-multi-set': [5535, 0, 1305, 6840, 171], 'e-multi-known': [12, 0, 28, 40, 1] };
  for (const spot of equitySpots.filter(s => s.opponents)) {
    const hero = parseCards(spot.hero), board = parseCards(spot.board), visible = [...hero, ...board];
    const candidates = spot.opponents.map(seat => {
      if (seat.hand) return [parseCards(seat.hand)];
      const hands = [];
      for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) {
        if (visible.includes(a) || visible.includes(b)) continue;
        const x = cardName(a), y = cardName(b);
        const match = seat.range.split(/[,\s]+/).some(token => token.length === 4
          ? token === x + y || token === y + x
          : ((token[0] === x[0] && token[1] === y[0]) || (token[1] === x[0] && token[0] === y[0])) && (!token[2] || (token[2] === 's' ? x[1] === y[1] : x[1] !== y[1])));
        if (match) hands.push([a, b]);
      }
      return hands;
    });
    let wins = 0, ties = 0, losses = 0, combos = 0;
    const splits = { 2: 0, 3: 0, 4: 0 };
    for (const a of candidates[0]) for (const b of candidates[1]) for (const c of candidates[2]) {
      const used = [...visible, ...a, ...b, ...c];
      if (new Set(used).size !== used.length) continue;
      combos++;
      const rivers = board.length === 5 ? [null] : Array.from({ length: 52 }, (_, i) => i).filter(i => !used.includes(i));
      for (const river of rivers) {
        const finalBoard = river === null ? board : [...board, river];
        const ranks = [hero, a, b, c].map(hand => referenceSeven([...hand, ...finalBoard]));
        const best = Math.max(...ranks), winners = ranks.filter(rank => rank === best).length;
        if (ranks[0] !== best) losses++;
        else if (winners === 1) wins++;
        else { ties++; splits[winners]++; }
      }
    }
    const total = wins + ties + losses, actual = exactEquity(spot);
    assert.deepEqual([actual.wins, actual.ties, actual.losses, actual.total, actual.combos], [wins, ties, losses, total, combos], spot.id);
    if (expected[spot.id]) assert.deepEqual([wins, ties, losses, total, combos], expected[spot.id], spot.id);
    assert.deepEqual(actual.splitCounts, splits);
    assert.equal(actual.equity, 100 * (wins + splits[2] / 2 + splits[3] / 3 + splits[4] / 4) / total);
  }
});

test('multiway turn shortcut uses rounded clean outs over the 40-card remainder', () => {
  const draw = postflopBreakdown(equitySpots.find(s => s.id === 'e-multi-flush'));
  const set = postflopBreakdown(equitySpots.find(s => s.id === 'e-multi-set'));
  assert.equal(draw.quick, 27.5);
  assert.equal(set.quick, 80);
});

test('pictured 75% answer is 5.92 points off; both modes accept the actual five-point boundaries', () => {
  const result = { win: 100 * 5535 / 6840 };
  const estimate = { exact: result.win, scale: 100, tolerance: 5, unit: '%' };
  for (const [value, correct] of [[75, false], [75.92, false], [75.93, true], [85.92, true], [85.93, false]]) {
    assert.equal(grade('equity', { win: value }, result).correct, correct);
    assert.equal(gradeEstimate(value, estimate).correct, correct);
  }
});

test('four-way board ties award a quarter of the pot, including call EV', () => {
  const r = exactEquity({ hero: '2c 3d', board: 'As Ks Qs Js Ts', opponents: [
    { hand: '4h 5s' }, { hand: '6h 7c' }, { hand: '8d 9c' },
  ] });
  assert.equal(r.win, 0);
  assert.equal(r.tie, 100);
  assert.equal(r.equity, 25);
  assert.equal(r.splitCounts[4], 1);
  assert.equal(potOdds({ pot: 100, bet: 50, result: r }).ev, 0);
});

test('a turn draw beats all three hands only on its twelve clean river cards', () => {
  const r = exactEquity({ hero: 'As Js', board: 'Ks 8s 3d 2c', opponents: [
    { hand: 'Kc Qd' }, { hand: 'Qh Qc' }, { hand: 'Th Td' },
  ] });
  assert.deepEqual([r.wins, r.ties, r.losses, r.total], [12, 0, 28, 40]);
  assert.equal(r.equity, 30);
});

test('hidden ranges weight legal joint assignments equally and remove shared cards', () => {
  const r = exactEquity({ hero: 'Kc Kd', board: '2c 3d 7h 8s 9c', opponents: [
    { range: 'AhAd,QhQd' }, { range: 'AhAd,JhJd' }, { hand: 'Th Td' },
  ] });
  assert.equal(r.combos, 3);
  assert.equal(r.total, 3);
  assert.deepEqual([r.wins, r.losses], [1, 2]);
  assert.equal(r.equity, 100 / 3);
});

test('multiway validation rejects overlapping cards and impossible range assignments', () => {
  const base = { hero: 'Ac Ad', board: '2c 3d 7h 8s 9c' };
  for (const opponents of [[], [{ hand: 'Ac Kh' }], [{ range: 'KK', hand: 'KhKd' }],
    [{ range: 'KhKd' }, { range: 'KhKd' }], Array(4).fill({ range: 'QQ' })]) {
    assert.throws(() => exactEquity({ ...base, opponents }));
  }
  assert.throws(() => exactEquity({ ...base, villain: 'Ks Kd', opponents: [{ range: 'QQ' }] }));
});

test('equity grace gives full credit at either boundary and keeps larger misses graded', () => {
  const e = { exact: 30, quick: 28, scale: 100, unit: '%', rule: 'equity-outs', tolerance: 5 };
  for (const guess of [25, 30, 35]) {
    assert.equal(gradeEstimate(guess, e).score, 100);
    assert.equal(gradeEstimate(guess, e).correct, true);
  }
  assert.equal(gradeEstimate(35.01, e).correct, false);
  assert.ok(gradeEstimate(50, e).score < 100);
  assert.equal(gradeEstimate(NaN, e, true).score, 0);
});
