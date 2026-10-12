// Deliberately slow five-card oracle: sorted multiplicities, not bit masks.
export function referenceFive(cards) {
  const ranks = cards.map(c => c % 13 + 2).sort((a, b) => b - a);
  const groups = [...new Set(ranks)].map(r => [ranks.filter(x => x === r).length, r]).sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const flush = cards.every(c => Math.floor(c / 13) === Math.floor(cards[0] / 13));
  const straight = groups.length === 5 && (ranks[0] - ranks[4] === 4 || ranks.join(',') === '14,5,4,3,2');
  const high = ranks.join(',') === '14,5,4,3,2' ? 5 : ranks[0];
  let category, kickers;
  if (straight && flush) { category = 8; kickers = [high]; }
  else if (groups[0][0] === 4) { category = 7; kickers = groups.map(g => g[1]); }
  else if (groups[0][0] === 3 && groups[1][0] === 2) { category = 6; kickers = groups.map(g => g[1]); }
  else if (flush) { category = 5; kickers = ranks; }
  else if (straight) { category = 4; kickers = [high]; }
  else if (groups[0][0] === 3) { category = 3; kickers = groups.map(g => g[1]); }
  else if (groups[0][0] === 2 && groups[1][0] === 2) { category = 2; kickers = groups.map(g => g[1]); }
  else if (groups[0][0] === 2) { category = 1; kickers = groups.map(g => g[1]); }
  else { category = 0; kickers = ranks; }
  return [category, ...kickers, ...Array(5 - kickers.length).fill(0)].reduce((n, r) => n * 15 + r, 0);
}
export function referenceSeven(cards) {
  let best = 0;
  for (let a = 0; a < cards.length - 4; a++) for (let b = a + 1; b < cards.length - 3; b++) for (let c = b + 1; c < cards.length - 2; c++) for (let d = c + 1; d < cards.length - 1; d++) for (let e = d + 1; e < cards.length; e++) best = Math.max(best, referenceFive([cards[a], cards[b], cards[c], cards[d], cards[e]]));
  return best;
}
