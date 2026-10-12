import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCards, cardName, evaluate, rankUnchecked, deck, combinations, exactEquity, exactOuts, exactRange, expandRange, potOdds } from '../src/engine.js';
import { referenceSeven } from './reference.mjs';
import { generate } from '../scripts/generate.mjs';

const categoryHands = ['As Jd 9h 5c 2s', 'As Ad 9h 5c 2s', 'As Ad 9h 9c 2s', 'As Ad Ah 5c 2s', '9s 8d 7h 6c 5s', 'As Js 9s 5s 2s', 'As Ad Ah 5c 5s', 'As Ad Ah Ac 2s', '9s 8s 7s 6s 5s'];
test('all nine categories have the correct ordering, including a royal flush', () => {
  categoryHands.forEach((h, i) => assert.equal(evaluate(h).category, i));
  for (let i = 1; i < categoryHands.length; i++) assert.ok(evaluate(categoryHands[i]).value > evaluate(categoryHands[i - 1]).value);
  assert.equal(evaluate('As Ks Qs Js Ts').category, 8);
});
test('all 2,598,960 five-card hands match known category frequencies', () => {
  const counts = Array(9).fill(0);
  combinations(deck, 5, cards => counts[Math.floor(rankUnchecked(cards) / 15 ** 5)]++);
  assert.deepEqual(counts, [1302540, 1098240, 123552, 54912, 10200, 5108, 3744, 624, 40]);
});
test('seven-card evaluator agrees with an independent five-card subset oracle', () => {
  let seed = 20261012;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let n = 0; n < 2000; n++) {
    const hand = [];
    while (hand.length < 7) { const c = Math.floor(random() * 52); if (!hand.includes(c)) hand.push(c); }
    assert.equal(rankUnchecked(hand), referenceSeven(hand), hand.map(cardName).join(' '));
  }
  for (const hand of ['As Ad Ah Ks Kd Kh 2c', 'As 2s 3s 4s 5s 6d 6s', 'Ah Ad Ac As Kh Kd Ks', 'Ac 2d 3h 4s 5c Kd Qh', 'As Js 9s 7s 5s 3s 2s']) {
    assert.equal(evaluate(hand).value, referenceSeven(parseCards(hand)));
  }
  assert.ok(evaluate('2c 3d 4h 5s 6c').value > evaluate('Ac 2d 3h 4s 5c').value);
  assert.ok(evaluate('As Ad Kh Qh 9d').value > evaluate('Ac Ah Ks Qs 8c').value);
});
test('AA vs KK exact preflop reference: wins, ties, losses and 81.2554896794% equity', () => {
  const r = exactEquity({ hero: 'As Ah', villain: 'Kc Kd' });
  assert.deepEqual([r.wins, r.ties, r.losses, r.total], [1388072, 6538, 317694, 1712304]);
  assert.ok(Math.abs(r.equity - 81.25548967940273) < 1e-10);
});
test('flush draw vs top pair flop reference is independently enumerated', () => {
  const hero = parseCards('9s 8s'), villain = parseCards('Ah Kd'), board = parseCards('Kh 2s 7s');
  const remaining = deck.filter(c => ![...hero, ...villain, ...board].includes(c));
  let wins = 0, ties = 0, losses = 0;
  for (let i = 0; i < remaining.length; i++) for (let j = i + 1; j < remaining.length; j++) {
    const runout = [...board, remaining[i], remaining[j]];
    const diff = referenceSeven([...hero, ...runout]) - referenceSeven([...villain, ...runout]);
    if (diff > 0) wins++; else if (diff === 0) ties++; else losses++;
  }
  assert.deepEqual([wins, ties, losses], [389, 0, 601]);
  const r = exactEquity({ hero, villain, board });
  assert.deepEqual([r.wins, r.ties, r.losses], [wins, ties, losses]);
  assert.ok(Math.abs(r.equity - 39.292929292929294) < 1e-10);
});
test('equity honors board ties, winner reversal, and exact range weighting', () => {
  assert.equal(exactEquity({ hero: '2c 3d', villain: '4h 5s', board: 'As Ks Qs Js Ts' }).equity, 50);
  const s = { hero: 'As Kd', villain: 'Qh Qd', board: '2s 3h 4d' };
  const a = exactEquity(s), b = exactEquity({ ...s, hero: s.villain, villain: s.hero });
  assert.equal(a.wins, b.losses); assert.equal(a.ties, b.ties); assert.equal(a.equity + b.equity, 100);
  const r = exactEquity({ hero: 'Ah Qd', range: 'KK, AKs', board: 'As 7c 2d 4h' });
  const expanded = expandRange('KK, AKs', parseCards('Ah Qd As 7c 2d 4h'));
  const all = expanded.map(villain => exactEquity({ hero: 'Ah Qd', villain, board: 'As 7c 2d 4h' }));
  assert.equal(r.total, expanded.length * 44); assert.equal(r.wins, all.reduce((n, x) => n + x.wins, 0));
});
test('range parser counts combos, removes blockers, and deduplicates', () => {
  assert.equal(expandRange('AA').length, 6); assert.equal(expandRange('AKs').length, 4);
  assert.equal(expandRange('AKo').length, 12); assert.equal(expandRange('AK').length, 16);
  assert.equal(expandRange('AA, AA, AsAh').length, 6);
  assert.equal(expandRange('AA', 'As').length, 3);
  assert.equal(expandRange('AK', 'As Kd').length, 9);
});
test('outs enumerate exact flop/turn hit rates and avoid double-counting combo outs', () => {
  const f = exactOuts({ hero: 'Ah 8h', board: 'Kh 6h 2c', target: 'flush' });
  assert.equal(f.count, 9); assert.equal(f.total, 1081); assert.equal(f.hits, 378);
  assert.equal(f.chance, 100 * (1 - (38 * 37) / (47 * 46))); assert.equal(f.approximation, 36);
  const t = exactOuts({ hero: 'Ah 8h', board: 'Kh 6h 2c 4d', target: 'flush' });
  assert.equal(t.count, 9); assert.equal(t.chance, 900 / 46); assert.equal(t.approximation, 18);
  const c = exactOuts({ hero: '9h 8h', board: '7h 6c Kh', target: 'either' });
  assert.equal(c.count, 15); assert.equal(new Set(c.outs).size, 15);
});
test('range made/draw/air is disjoint, blocker-aware, with no river draws', () => {
  const r = exactRange({ range: 'AsAd, AhKh, 9c8c', board: 'Qh 7h 2c' });
  assert.deepEqual([r.made, r.draw, r.air, r.total], [1, 1, 1, 3]);
  assert.equal(exactRange({ range: 'AK, QJ', board: '8h 8d 2c' }).air, 0);
  assert.equal(exactRange({ range: 'AK, QJ', board: '8h 5d 2c 4s 9h' }).draw, 0);
  const overlap = exactRange({ range: 'AhKh', board: 'Ac 7h 2h' });
  assert.equal(overlap.made, 1); assert.equal(overlap.draw, 0);
});
test('pot odds handle calls, folds, break-even and implied payout only on wins', () => {
  const result = { wins: 20, ties: 0, losses: 80, total: 100 };
  const r = potOdds({ pot: 100, bet: 50, result });
  assert.equal(r.directRequired, 25); assert.equal(r.ev, -10); assert.equal(r.choice, 'fold'); assert.equal(r.neededExtra, 50);
  const withExtra = potOdds({ pot: 100, bet: 50, extra: 100, result });
  assert.equal(withExtra.ev, 10); assert.equal(withExtra.choice, 'call');
  assert.equal(potOdds({ pot: 100, bet: 50, result: { wins: 25, ties: 0, losses: 75, total: 100 } }).choice, 'call');
  assert.equal(potOdds({ pot: 100, bet: 50, extra: 100, result: { wins: 0, ties: 100, losses: 0, total: 100 } }).ev, 50);
  assert.equal(potOdds({ pot: 100, bet: 50, result: { wins: 0, ties: 100, losses: 0, total: 100 } }).neededExtra, 0);
  assert.equal(potOdds({ pot: 100, bet: 50, result: { wins: 0, ties: 0, losses: 100, total: 100 } }).neededExtra, null);
});
test('invalid cards, overlaps, board lengths, ranges and pot inputs fail closed', () => {
  for (const cards of ['As As', '1s', 'AS', [-1], [52]]) assert.throws(() => parseCards(cards));
  assert.throws(() => evaluate('As Ks'));
  assert.throws(() => exactEquity({ hero: 'As Ks', villain: 'As Qs' }));
  assert.throws(() => exactEquity({ hero: 'As Ks', villain: 'Ad Qs', board: '3h 4d' }));
  for (const range of ['', 'QQ+', 'AAs', 'AsAs']) assert.throws(() => expandRange(range));
  assert.throws(() => expandRange('AsAh', 'As'));
  assert.throws(() => potOdds({ pot: -1, bet: 3, result: {} }));
});
test('all authored spots enumerate with exact counts and valid probabilities', () => {
  const data = generate();
  assert.equal([...data.equity, ...data.outs, ...data.pot, ...data.range].length, 69);
  for (const spots of [data.equity, data.outs, data.pot, data.range]) for (const s of spots) {
    assert.equal(s.result.method, 'exact'); assert.equal(s.result.error, 0);
    for (const key of ['win', 'tie', 'equity', 'chance']) if (key in s.result) assert.ok(s.result[key] >= 0 && s.result[key] <= 100, s.id);
  }
  for (const s of data.range) assert.equal(s.result.made + s.result.draw + s.result.air, s.result.total);
  assert.ok(data.pot.some(s => s.result.choice === 'fold'));
  assert.ok(data.pot.some(s => s.extra && s.result.directEV < 0 && s.result.ev > 0));
});
