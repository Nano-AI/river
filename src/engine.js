export const RANKS = '23456789TJQKA';
export const SUITS = 'cdhs';
export const CATEGORIES = ['High card', 'One pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];
const BASE = 15 ** 5;
export const deck = Array.from({ length: 52 }, (_, i) => i);

export function parseCards(value) {
  const tokens = typeof value === 'string' ? value.trim().split(/\s+/).filter(Boolean) : value;
  if (!Array.isArray(tokens)) throw new Error('Cards must be a list or space-separated string.');
  const cards = tokens.map(token => {
    if (Number.isInteger(token) && token >= 0 && token < 52) return token;
    if (typeof token !== 'string' || !/^[2-9TJQKA][cdhs]$/.test(token)) throw new Error(`Invalid card: ${token}`);
    return SUITS.indexOf(token[1]) * 13 + RANKS.indexOf(token[0]);
  });
  if (new Set(cards).size !== cards.length) throw new Error('A card cannot appear twice.');
  return cards;
}
export const cardName = card => RANKS[card % 13] + SUITS[Math.floor(card / 13)];

function straightHigh(mask) {
  for (let high = 14; high >= 6; high--) {
    const run = 31 << (high - 4);
    if ((mask & run) === run) return high;
  }
  return (mask & 16444) === 16444 ? 5 : 0;
}
function score(category, ranks) {
  let value = category;
  for (let i = 0; i < 5; i++) value = value * 15 + (ranks[i] || 0);
  return value;
}
function top(mask, count = 5) {
  const ranks = [];
  for (let r = 14; r >= 2 && ranks.length < count; r--) if (mask & (1 << r)) ranks.push(r);
  return ranks;
}

// Enumeration calls this only after validating the complete set of known cards.
export function rankUnchecked(cards) {
  const counts = new Uint8Array(15);
  const suits = [0, 0, 0, 0];
  const suitCounts = [0, 0, 0, 0];
  let mask = 0;
  for (const card of cards) {
    const r = card % 13 + 2;
    const s = Math.floor(card / 13);
    counts[r]++;
    mask |= 1 << r;
    suits[s] |= 1 << r;
    suitCounts[s]++;
  }
  let flush = 0;
  for (let s = 0; s < 4; s++) {
    if (suitCounts[s] >= 5) {
      const straight = straightHigh(suits[s]);
      if (straight) return score(8, [straight]);
      flush = suits[s];
    }
  }
  let quad = 0;
  const trips = [], pairs = [];
  for (let r = 14; r >= 2; r--) {
    if (counts[r] === 4) quad = r;
    if (counts[r] >= 3) trips.push(r);
    if (counts[r] >= 2) pairs.push(r);
  }
  if (quad) return score(7, [quad, ...top(mask & ~(1 << quad), 1)]);
  if (trips.length) {
    const pair = pairs.find(r => r !== trips[0]);
    if (pair) return score(6, [trips[0], pair]);
  }
  if (flush) return score(5, top(flush));
  const straight = straightHigh(mask);
  if (straight) return score(4, [straight]);
  if (trips.length) return score(3, [trips[0], ...top(mask & ~(1 << trips[0]), 2)]);
  if (pairs.length >= 2) return score(2, [pairs[0], pairs[1], ...top(mask & ~(1 << pairs[0]) & ~(1 << pairs[1]), 1)]);
  if (pairs.length) return score(1, [pairs[0], ...top(mask & ~(1 << pairs[0]), 3)]);
  return score(0, top(mask));
}
export function evaluate(value) {
  const cards = parseCards(value);
  if (cards.length < 5 || cards.length > 7) throw new Error('Evaluate five to seven cards.');
  const valueRank = rankUnchecked(cards);
  return { value: valueRank, category: Math.floor(valueRank / BASE), name: CATEGORIES[Math.floor(valueRank / BASE)] };
}
export function combinations(items, count, visit) {
  const chosen = [];
  function walk(start) {
    if (chosen.length === count) { visit(chosen); return; }
    for (let i = start; i <= items.length - (count - chosen.length); i++) {
      chosen.push(items[i]); walk(i + 1); chosen.pop();
    }
  }
  walk(0);
}
export function expandRange(notation, blocked = []) {
  if (typeof notation !== 'string' || !notation.trim()) throw new Error('Range is empty.');
  const blockedSet = new Set(parseCards(blocked));
  const combos = new Map();
  for (const token of notation.trim().split(/[\s,]+/)) {
    let candidates = [];
    if (/^[2-9TJQKA][cdhs][2-9TJQKA][cdhs]$/.test(token)) {
      candidates = [parseCards([token.slice(0, 2), token.slice(2)])];
    } else {
      if (!/^[2-9TJQKA]{2}[so]?$/.test(token) || (token[0] === token[1] && token.length > 2)) throw new Error(`Unsupported range: ${token}`);
      const r1 = RANKS.indexOf(token[0]), r2 = RANKS.indexOf(token[1]);
      for (let s1 = 0; s1 < 4; s1++) for (let s2 = 0; s2 < 4; s2++) {
        if (r1 === r2 && s1 >= s2) continue;
        if (token[2] === 's' && s1 !== s2) continue;
        if (token[2] === 'o' && s1 === s2) continue;
        candidates.push([s1 * 13 + r1, s2 * 13 + r2]);
      }
    }
    for (const hand of candidates) {
      if (hand.some(c => blockedSet.has(c))) continue;
      hand.sort((a, b) => a - b);
      combos.set(hand.join(','), hand);
    }
  }
  if (!combos.size) throw new Error('Range has no legal combinations.');
  return [...combos.values()];
}

export function equityMatchups({ hero, villain, range, opponents, board = '' }) {
  const h = parseCards(hero), b = parseCards(board);
  if (h.length !== 2 || ![0, 3, 4, 5].includes(b.length)) throw new Error('Use two hole cards and a preflop, flop, turn, or river board.');
  parseCards([...h, ...b]);
  if (opponents && (villain || range)) throw new Error('Choose opponents or a heads-up hand/range.');
  const seats = opponents ?? [{ hand: villain, range }];
  if (!Array.isArray(seats) || seats.length < 1 || seats.length > 3) throw new Error('Use one to three opponents.');
  const ranges = seats.map(seat => {
    if (!seat || Boolean(seat.hand) === Boolean(seat.range)) throw new Error('Choose a hand or a range, not both.');
    if (seat.range) return expandRange(seat.range, [...h, ...b]);
    const v = parseCards(seat.hand);
    if (v.length !== 2) throw new Error('Opponent needs two cards.');
    parseCards([...h, ...b, ...v]);
    return [v];
  });
  const deals = [];
  function assign(hands, used) {
    if (hands.length === ranges.length) { deals.push(hands); return; }
    for (const v of ranges[hands.length]) {
      if (!v.some(c => used.includes(c))) assign([...hands, v], [...used, ...v]);
    }
  }
  assign([], [...h, ...b]);
  if (!deals.length) throw new Error('Opponent ranges have no legal joint assignments.');
  return { h, b, deals };
}

export function exactEquity(spot) {
  const { h, b, deals } = equityMatchups(spot);
  let wins = 0, ties = 0, losses = 0;
  const splitCounts = { 2: 0, 3: 0, 4: 0 };
  for (const hands of deals) {
    const known = new Set([...h, ...hands.flat(), ...b]);
    const remaining = deck.filter(c => !known.has(c));
    const allCards = [h, ...hands].map(hand => [...hand, ...b]);
    combinations(remaining, 5 - b.length, runout => {
      for (const cards of allCards) for (let i = 0; i < runout.length; i++) cards[2 + b.length + i] = runout[i];
      const heroRank = rankUnchecked(allCards[0]);
      let winners = 1;
      for (let i = 1; i < allCards.length; i++) {
        const rank = rankUnchecked(allCards[i]);
        if (rank > heroRank) { losses++; return; }
        if (rank === heroRank) winners++;
      }
      if (winners === 1) wins++;
      else { ties++; splitCounts[winners]++; }
    });
  }
  const total = wins + ties + losses;
  const shares = wins + splitCounts[2] / 2 + splitCounts[3] / 3 + splitCounts[4] / 4;
  return { wins, ties, losses, total, combos: deals.length, splitCounts, win: 100 * wins / total, tie: 100 * ties / total, equity: 100 * shares / total, method: 'exact', error: 0 };
}

function completes(cards, target) {
  let mask = 0;
  const suits = [0, 0, 0, 0];
  for (const c of cards) { mask |= 1 << (c % 13 + 2); suits[Math.floor(c / 13)]++; }
  const flush = suits.some(n => n >= 5), straight = straightHigh(mask) > 0;
  return target === 'flush' ? flush : target === 'straight' ? straight : flush || straight;
}
export function exactOuts({ hero, board, target }) {
  const h = parseCards(hero), b = parseCards(board);
  if (h.length !== 2 || ![3, 4].includes(b.length) || !['flush', 'straight', 'either'].includes(target)) throw new Error('Outs need two hole cards, a flop/turn, and a draw target.');
  const known = parseCards([...h, ...b]);
  if (completes(known, target)) throw new Error('The target hand is already made.');
  const remaining = deck.filter(c => !known.includes(c));
  const outs = remaining.filter(c => completes([...known, c], target));
  const outSet = new Set(outs);
  let hits = 0, total = 0;
  combinations(remaining, 5 - b.length, runout => { total++; if (runout.some(c => outSet.has(c))) hits++; });
  const chance = 100 * hits / total, approximation = outs.length * (b.length === 3 ? 4 : 2);
  return { outs: outs.map(cardName), count: outs.length, hits, total, chance, approximation, difference: approximation - chance, unseen: remaining.length, cardsToCome: 5 - b.length, method: 'exact', error: 0 };
}

export function exactRange({ range, board }) {
  const b = parseCards(board);
  if (![3, 4, 5].includes(b.length)) throw new Error('Range reading needs a flop, turn, or river.');
  const hands = expandRange(range, b);
  const counts = { made: 0, draw: 0, air: 0 }, combos = { made: [], draw: [], air: [] };
  for (const h of hands) {
    const cards = [...h, ...b];
    let kind = 'air';
    if (Math.floor(rankUnchecked(cards) / BASE) >= 1) kind = 'made';
    else if (b.length < 5 && deck.some(c => !cards.includes(c) && completes([...cards, c], 'either'))) kind = 'draw';
    counts[kind]++; combos[kind].push(h.map(cardName).join(''));
  }
  return { ...counts, total: hands.length, fractions: Object.fromEntries(Object.entries(counts).map(([key, n]) => [key, 100 * n / hands.length])), combos, method: 'exact', error: 0 };
}

export function potOdds({ pot, bet, extra = 0, result }) {
  if (![pot, bet, extra].every(n => Number.isFinite(n) && n >= 0) || bet <= 0 || !result || !Number.isInteger(result.total) || result.total <= 0 || ![result.wins, result.ties, result.losses].every(n => Number.isInteger(n) && n >= 0) || result.wins + result.ties + result.losses !== result.total) throw new Error('Invalid pot or equity counts.');
  const finalPot = pot + 2 * bet;
  const splits = result.splitCounts ?? { 2: result.ties, 3: 0, 4: 0 };
  if (![2, 3, 4].every(n => Number.isInteger(splits[n]) && splits[n] >= 0) || splits[2] + splits[3] + splits[4] !== result.ties) throw new Error('Invalid split-pot counts.');
  const equity = (result.wins + splits[2] / 2 + splits[3] / 3 + splits[4] / 4) / result.total;
  const win = result.wins / result.total;
  const directEV = equity * finalPot - bet;
  const ev = directEV + win * extra;
  // Extra payout is earned on outright wins only, never on split pots.
  const neededExtra = directEV >= 0 ? 0 : win ? -directEV / win : null;
  return { finalPot, directRequired: 100 * bet / finalPot, equity: 100 * equity, directEV, ev, neededExtra, choice: ev >= -1e-10 ? 'call' : 'fold', method: 'exact', error: 0 };
}
