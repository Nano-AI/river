import { readFile, writeFile } from 'node:fs/promises';
import { RULES, comboCount, preflopRule, postflopQuick } from '../src/rules.js';
import { exactEquity, exactOuts, exactRange, expandRange, potOdds, cardName, parseCards } from '../src/engine.js';
import { equitySpots, outsSpots, rangeSpots } from '../src/scenarios.js';

export function measureRules() {
  const rows = Object.fromEntries(Object.entries(RULES).map(([id, rule]) => [id, { ...rule, samples: 0, mean: 0, worst: 0, minSigned: Infinity, maxSigned: -Infinity, worstSpot: '' }]));
  const add = (id, quick, exact, spot) => {
    if (![quick, exact].every(Number.isFinite)) throw new Error(`Nonfinite measurement: ${id} ${spot}`);
    const row = rows[id], delta = quick - exact, error = Math.abs(delta);
    row.samples++; row.mean += error; row.minSigned = Math.min(row.minSigned, delta); row.maxSigned = Math.max(row.maxSigned, delta);
    if (error >= row.worst) { row.worst = error; row.worstSpot = spot; }
  };
  const label = s => `${s.hero || s.range} vs ${s.villain || s.range || 'unknown'} / ${s.board || 'preflop'}`;
  // Fixed rank/suit coverage: every board for each matchup, never Monte Carlo.
  const matchups = [
    ['As Ah', 'Kc Kd'], ['2c 2d', '3h 3s'], ['Ts Th', '9c 9d'], ['6h 6d', '5h 5c'],
    ['Ac Ad', '2c 2s'], ['Qh Qs', 'Jd Js'], ['8c 8d', '7c 7s'], ['Kh Kd', '4h 4c'],
    ['2c 2d', 'Ah Kh'], ['Qc Qd', 'As Kh'], ['7h 7s', 'Ac Kc'], ['9c 9d', 'Jh Th'],
    ['Jc Jd', 'Qs Ks'], ['5h 5d', '6h 7d'], ['8c 8s', '9d Td'], ['Tc Td', 'As Qc'],
    ['As Kh', 'Ac Qd'], ['Ah Kh', 'Ac Qc'], ['As 2h', 'Ac 3d'], ['Ks Qh', 'Kc Jd'],
    ['Qs Jh', 'Qc Td'], ['Ah 8h', 'As 7c'], ['Jc Td', 'Js 9s'], ['Ac Kc', 'Ad 2h'],
  ];
  const ranks = '23456789TJQKA';
  for (const rank of [2, 4, 6, 8, 10]) {
    const r = ranks[rank - 2], above = ranks[rank - 1], next = ranks[rank];
    matchups.push([`${r}c ${r}d`, `${above}h ${next}s`], [`${r}c ${r}d`, `${above}h ${next}h`]);
    matchups.push([`${r}c ${r}d`, `${above}h ${above}s`], [`${r}c ${r}h`, `${next}h ${next}s`]);
    matchups.push([`As ${next}h`, `Ac ${r}d`], [`Ks ${next}s`, `Kc ${r}d`]);
  }
  for (const [hero, villain] of matchups) {
    const s = { hero, villain }, r = exactEquity(s), a = preflopRule(s);
    add(a.rule, a.quick, r.equity, label(s));
    const reverse = { hero: villain, villain: hero }, b = preflopRule(reverse);
    add(b.rule, b.quick, 100 - r.equity, label(reverse));
  }
  let seed = 20261012;
  const random = n => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return Math.floor(seed / 2 ** 32 * n); };
  const deal = n => { const hand = []; while (hand.length < n) { const c = random(52); if (!hand.includes(c)) hand.push(c); } return hand.map(cardName); };
  for (let i = 0; i < 3000; i++) {
    const hand = deal(7), size = i % 2 ? 4 : 3;
    const s = { hero: hand.slice(0, 2).join(' '), board: hand.slice(2, size + 2).join(' '), target: ['flush', 'straight', 'either'][i % 3] };
    try {
      const r = exactOuts(s);
      if (!r.count) continue;
      add(size === 3 ? 'rule-4' : 'rule-2', r.approximation, r.chance, `${label(s)} (${r.count} outs)`);
    } catch (e) { if (!e.message.includes('already made')) throw e; }
  }
  for (const s of outsSpots) { const r = exactOuts(s); add(r.cardsToCome === 2 ? 'rule-4' : 'rule-2', r.approximation, r.chance, `${label(s)} (${r.count} outs)`); }
  const postflop = equitySpots.filter(s => s.board);
  for (let i = 0; i < 8; i++) {
    const c = deal(13);
    postflop.push({ hero: c.slice(0, 2).join(' '), opponents: [2, 4, 6].map(n => ({ hand: c.slice(n, n + 2).join(' ') })), board: c.slice(8, 12 + i % 2).join(' ') });
  }
  for (let i = 0; i < 120; i++) {
    const c = deal(9), size = 3 + i % 3;
    postflop.push({ hero: c.slice(0, 2).join(' '), villain: c.slice(2, 4).join(' '), board: c.slice(4, 4 + size).join(' ') });
  }
  for (const s of postflop) {
    const r = exactEquity(s);
    add(s.opponents ? 'multiway-outs' : parseCards(s.board).length === 5 ? 'river-share' : 'equity-outs', postflopQuick(s), r.equity, label(s));
    for (const ratio of [.25, .5, .75, 1, 1.5, 2, 3]) {
      const pot = 100, bet = pot * ratio, p = potOdds({ pot, bet, result: r });
      add('bet-equity', 100 * bet / (pot + 2 * bet), p.directRequired, `${label(s)}, pot ${pot}, bet ${bet}`);
      if (r.win > 0) add('implied', Math.max(0, (bet - r.equity / 100 * (pot + 2 * bet)) / (r.win / 100)), p.neededExtra, `${label(s)}, pot ${pot}, bet ${bet}`);
    }
  }
  for (const [token, id] of [['AA', 'combo-pair'], ['AK', 'combo-unpaired'], ['AKs', 'combo-suited'], ['AKo', 'combo-offsuit']]) {
    const relevant = parseCards('Ac Ad Ah As Kc Kd Kh Ks');
    for (let mask = 0; mask < 256; mask++) {
      const blocked = relevant.filter((_, i) => mask & (1 << i));
      let exact;
      try { exact = expandRange(token, blocked).length; } catch (e) { if (!e.message.includes('no legal')) throw e; exact = 0; }
      add(id, comboCount(token, blocked), exact, `${token}, blocked ${blocked.map(cardName).join(' ') || 'none'}`);
    }
  }
  const ranges = [...rangeSpots];
  for (let i = 0; i < 120; i++) ranges.push({ range: rangeSpots[i % 12].range, board: deal(3 + i % 3).join(' ') });
  for (const s of ranges) {
    const r = exactRange(s);
    for (const category of ['made', 'draw', 'air']) add('range-share', Math.round(r.fractions[category] / 5) * 5, r.fractions[category], `${s.range} / ${s.board} (${category})`);
  }
  for (const row of Object.values(rows)) { if (!row.samples) throw new Error('Unmeasured rule'); row.mean /= row.samples; }
  return rows;
}
export function reportTable(rows) {
  return '| Rule | Cases | Mean absolute error | Worst absolute error | Signed range (quick − exact) |\n| --- | ---: | ---: | ---: | ---: |\n' + Object.values(rows).map(r => `| ${r.name} | ${r.samples} | ${r.mean.toFixed(4)} ${r.unit} | ${r.worst.toFixed(4)} ${r.unit} | ${r.minSigned.toFixed(4)} to ${r.maxSigned.toFixed(4)} ${r.unit} |`).join('\n');
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const rows = measureRules();
  await writeFile('public/rules.json', JSON.stringify(rows));
  const file = await readFile('MATH.md', 'utf8');
  const report = `<!-- RULE AUDIT START -->\n${reportTable(rows)}\n\n${Object.values(rows).map(r => `- **${r.name}:** ${r.rule} Largest measured error: ${r.worstSpot}.`).join('\n')}\n<!-- RULE AUDIT END -->`;
  await writeFile('MATH.md', file.includes('<!-- RULE AUDIT START -->') ? file.replace(/<!-- RULE AUDIT START -->[\s\S]*<!-- RULE AUDIT END -->/, report) : file + '\n\n## Measured mental-math rules\n\n' + report + '\n');
  console.log(reportTable(rows));
}
