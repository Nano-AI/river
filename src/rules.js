import { parseCards, deck, rankUnchecked, equityMatchups } from './engine.js';

export const RULES = {
  'rule-2': { name: 'Rule of 2', rule: 'One card to come: outs × 2 ≈ hit %; it understates the exact chance.', unit: 'pp' },
  'rule-4': { name: 'Rule of 4', rule: 'Two cards to come: outs × 4 ≈ hit %; from 7 outs it overstates, especially with combo draws.', unit: 'pp' },
  'pair-overcards': { name: 'Pair vs two overcards', rule: 'A pair against two higher cards starts around 55% equity (55/45).', unit: 'pp' },
  'overcards-pair': { name: 'Two overcards vs pair', rule: 'Two higher cards against a lower pair start around 45% equity (45/55).', unit: 'pp' },
  domination: { name: 'Dominated preflop hands', rule: 'With one shared rank, favor the higher kicker about 70/30; suits and connectivity matter.', unit: 'pp' },
  'pair-pair': { name: 'Pair vs pair', rule: 'The higher pocket pair starts around 80% equity (80/20).', unit: 'pp' },
  'equity-outs': { name: 'Postflop outs shortcut', rule: 'If ahead, subtract losing outs × 4 (flop) or × 2 (turn); if behind, multiply winning outs; ties count half; ignore redraws and backdoors (unreliable when currently tied).', unit: 'pp' },
  'multiway-outs': { name: 'Multiway outs & pot shares', rule: 'Turn: rounded clean outs ÷ remaining cards. Average over legal ranges; split pots count fractionally.', unit: 'pp' },
  'river-share': { name: 'River range share', rule: 'With no cards left, count winning combos plus half the tied combos, then divide by all combos.', unit: 'pp' },
  'bet-equity': { name: 'Price of a call', rule: 'Bet ÷ (pot before bet + 2 × bet): half pot 25%, pot 33⅓%, twice pot 40%.', unit: 'pp' },
  implied: { name: 'How much more to win', rule: 'Extra net needed per win = max(0, (call − equity × final pot) ÷ win chance); use probabilities, not percentages.', unit: '$' },
  'combo-pair': { name: 'Pair combos', rule: 'A pair has 6 combos; with n unblocked cards of its rank, count n × (n − 1) ÷ 2.', unit: 'combos' },
  'combo-unpaired': { name: 'Unpaired combos', rule: 'Two different ranks have 16 combos; multiply the number of unblocked cards of each rank.', unit: 'combos' },
  'combo-suited': { name: 'Suited combos', rule: 'A suited hand has 4 combos; keep only suits where both cards remain unblocked.', unit: 'combos' },
  'combo-offsuit': { name: 'Offsuit combos', rule: 'An offsuit hand has 12 combos; multiply remaining rank counts, then subtract surviving suited combos.', unit: 'combos' },
  'range-share': { name: 'Range category share', rule: 'Count blocked combos in the asked category ÷ all available combos, then round to the nearest 5%.', unit: 'pp' },
};

export function comboCount(token, blocked = '') {
  if (!/^[2-9TJQKA]{2}[so]?$/.test(token) || (token[0] === token[1] && token.length !== 2)) throw new Error('Use one pair, suited, offsuit or unpaired hand.');
  const known = new Set(parseCards(blocked));
  const ranks = '23456789TJQKA';
  const remaining = rank => [0, 1, 2, 3].filter(s => !known.has(s * 13 + ranks.indexOf(rank)));
  const a = remaining(token[0]), b = remaining(token[1]);
  if (token[0] === token[1]) return Math.max(0, a.length * (a.length - 1) / 2);
  const suited = a.filter(s => b.includes(s)).length;
  return token[2] === 's' ? suited : token[2] === 'o' ? a.length * b.length - suited : a.length * b.length;
}

export function preflopRule(s) {
  const h = parseCards(s.hero).map(c => c % 13), v = parseCards(s.villain).map(c => c % 13);
  const hp = h[0] === h[1], vp = v[0] === v[1];
  if (hp && vp) return { rule: 'pair-pair', quick: h[0] > v[0] ? 80 : 20 };
  if (hp && Math.min(...v) > h[0]) return { rule: 'pair-overcards', quick: 55 };
  if (vp && Math.min(...h) > v[0]) return { rule: 'overcards-pair', quick: 45 };
  const shared = h.find(r => v.includes(r));
  if (!hp && !vp && shared !== undefined) return { rule: 'domination', quick: h.find(r => r !== shared) > v.find(r => r !== shared) ? 70 : 30 };
  throw new Error('No measured preflop shortcut for this matchup.');
}

export function postflopBreakdown(s) {
  const { h, b, deals } = equityMatchups(s);
  let sum = 0, outsSum = 0, aheadCount = 0, behindCount = 0;
  const remainingCount = 52 - h.length - b.length - deals[0].length * 2;
  for (const hands of deals) {
    const share = board => {
      const ranks = [h, ...hands].map(hand => rankUnchecked([...hand, ...board]));
      const best = Math.max(...ranks);
      return ranks[0] === best ? 1 / ranks.filter(rank => rank === best).length : 0;
    };
    if (b.length === 5) { sum += share(b) * 100; continue; }
    const current = share(b), remaining = deck.filter(c => ![...h, ...hands.flat(), ...b].includes(c));
    const units = remaining.reduce((n, c) => n + share([...b, c]), 0);
    outsSum += units;
    aheadCount += current === 1;
    behindCount += current === 0;
    const factor = b.length === 3 ? 4 : 2;
    // shortcut: immediate outs ignore redraws and runner-runner paths; use the exact reveal for decisions.
    const quick = Math.max(0, Math.min(100, current === 1 ? 100 - factor * (remaining.length - units) : current === 0 ? factor * units : current * 100 + factor * (units - remaining.length * current)));
    sum += quick;
  }
  if (b.length === 5) return { quick: sum / deals.length, steps: ['Wins count fully; ties count your pot share.'] };
  const ahead = aheadCount === deals.length, mixed = !ahead && behindCount !== deals.length;
  const outs = ahead ? remainingCount - outsSum / deals.length : outsSum / deals.length;
  const useDeck = Boolean(s.opponents && b.length === 4);
  const roundedOuts = useDeck ? Math.round(outs) : Number(outs.toFixed(2));
  // shortcut: whole-out rounding approximates range-weighted shares; exact enumeration grades the answer.
  const quick = useDeck ? (ahead ? 100 - 100 * roundedOuts / remainingCount : 100 * roundedOuts / remainingCount) : sum / deals.length;
  const steps = [mixed && !useDeck ? 'Average estimates across the range.' : `${useDeck ? '≈' : ''}${roundedOuts} ${ahead ? 'losing' : 'winning'} outs${useDeck ? ` · ${remainingCount} cards left` : ''}.`];
  return { quick, steps, outs: roundedOuts, ahead, mixed, useDeck, remaining: remainingCount, factor: b.length === 3 ? 4 : 2 };
}
export const postflopQuick = s => postflopBreakdown(s).quick;

export function estimateFor(type, s) {
  const r = s.result;
  if (type === 'equity') return { label: 'Your pot-share equity', unit: '%', exact: r.equity, scale: 100, tolerance: 5, ...(s.board ? { rule: s.opponents ? 'multiway-outs' : parseCards(s.board).length === 5 ? 'river-share' : 'equity-outs', ...postflopBreakdown(s) } : { ...preflopRule(s), steps: [RULES[preflopRule(s).rule].rule] }) };
  if (type === 'outs') return { label: 'Hit a current out by river', unit: '%', exact: r.chance, quick: r.approximation, scale: 100, rule: r.cardsToCome === 2 ? 'rule-4' : 'rule-2' };
  if (type === 'pot') {
    if (s.extra) {
      const e = s.equityResult;
      const quick = Math.max(0, (s.bet - e.equity / 100 * (s.pot + 2 * s.bet)) / (e.win / 100));
      return { label: 'Extra net needed per win', unit: '$', exact: r.neededExtra, quick, scale: s.bet, rule: 'implied' };
    }
    return { label: 'Equity needed to call', unit: '%', exact: r.directRequired, quick: 100 * s.bet / (s.pot + 2 * s.bet), scale: 100, rule: 'bet-equity' };
  }
  if (s.comboRule) return { label: 'Available combinations', unit: 'combos', exact: r.total, quick: comboCount(s.range, s.board), scale: 16, rule: s.comboRule };
  const category = s.estimateCategory || 'made';
  if (!['made', 'draw', 'air'].includes(category)) throw new Error('Unknown range category.');
  return { label: `${{ made: 'Made-hand', draw: 'Draw', air: 'Air' }[category]} share of this range`, category, unit: '%', exact: r.fractions[category], quick: 5 * Math.round(r.fractions[category] / 5), scale: 100, rule: 'range-share' };
}
