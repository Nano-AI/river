// shortcut: authored spots repeat per drill; add generated spots when more practice variety is needed.
export const equitySpots = [
  { id: 'e-flush', topic: 'Flush draws', hero: 'Qs Js', villain: 'Ah Kd', board: 'Ks 9s 2d' },
  { id: 'e-aces', topic: 'Preflop pairs', hero: 'As Ah', villain: 'Kc Kd', board: '' },
  { id: 'e-flip', topic: 'Preflop pairs', hero: 'Qc Qd', villain: 'As Kh', board: '' },
  { id: 'e-fd-reference', topic: 'Flush draws', hero: '9s 8s', villain: 'Ah Kd', board: 'Kh 2s 7s' },
  { id: 'e-set', topic: 'Made hands', hero: '7c 7d', villain: 'As Ks', board: '7s Qs 2h' },
  { id: 'e-oesd', topic: 'Straight draws', hero: '8c 9d', villain: 'Ah Ac', board: '6s 7h Kd' },
  { id: 'e-domination', topic: 'Made hands', hero: 'Ac Qd', villain: 'Ah Kc', board: 'As 7d 2h' },
  { id: 'e-turn-flush', topic: 'Flush draws', hero: 'Ah Jh', villain: 'Ks Qd', board: 'Kh 8h 3c 2s' },
  { id: 'e-turn-straight', topic: 'Straight draws', hero: 'Jd Td', villain: 'Ac As', board: '9h Qs 2c 4d' },
  { id: 'e-turn-set', topic: 'Made hands', hero: '8d 8c', villain: 'Ah Kh', board: '8h Qh 2h 4c' },
  { id: 'e-river-split', topic: 'Split pots', hero: '2c 3d', villain: '4h 5s', board: 'As Ks Qs Js Ts' },
  { id: 'e-split-draw', topic: 'Split pots', hero: 'Ah Kd', villain: 'Ac Ks', board: 'Qh Jh 2h' },
  { id: 'e-range-overpair', topic: 'Against a range', hero: 'Qc Qd', range: 'TT, JJ, KK, AA, AKs, AKo', board: '9h 6s 2c' },
  { id: 'e-range-top', topic: 'Against a range', hero: 'Ah Jd', range: 'ATs, AJs, AQs, AKs, 99, TT', board: 'As 9c 4d 2h' },
  { id: 'e-range-flush', topic: 'Against a range', hero: 'Ks Qs', range: 'AA, QQ, JJ, AJs, AJo, 77', board: 'Js 7s 2d' },
  { id: 'e-range-river', topic: 'Against a range', hero: 'Ac Qh', range: 'AK, AQ, AJ, TT, JJ', board: 'As Td 5c 8h 2s' },
];
equitySpots.push(
  { id: 'e-overcards', topic: 'Preflop matchups', hero: 'As Kh', villain: 'Qc Qd', board: '' },
  { id: 'e-dominated-pre', topic: 'Preflop matchups', hero: 'As Qh', villain: 'Ac Kd', board: '' },
  { id: 'e-dominating-pre', topic: 'Preflop matchups', hero: 'Ac Kd', villain: 'As Qh', board: '' },
  { id: 'e-underpair', topic: 'Preflop pairs', hero: 'Kc Kd', villain: 'As Ah', board: '' },
  { id: 'e-multi-flush', topic: 'Multiway draws', hero: 'As Js', board: 'Ks 8s 3d 2c', opponents: [{ label: 'Early position', range: 'KQ' }, { label: 'Cutoff', range: 'QQ' }, { label: 'Big blind', range: 'TT' }], cue: 'A nut-flush draw in a four-way pot. Your ace may also be good if it pairs.', lesson: 'One more spade makes a flush. Aces also win; some outs are held.' },
  { id: 'e-multi-set', topic: 'Multiway made hands', hero: '8c 8d', board: '8h Qh 2s 4c', opponents: [{ label: 'Early position', range: 'AA, KK' }, { label: 'Cutoff', range: 'AhKh, AhJh, KhJh' }, { label: 'Big blind', range: 'AQ' }], cue: 'You have a set, but a flush draw and bigger pairs are still live.', lesson: 'Dodge higher sets and hearts. Paired boards can save you.' },
  { id: 'e-multi-known', topic: 'Multiway clean outs', hero: 'As Js', board: 'Ks 8s 3d 2c', opponents: [{ label: 'Early position', hand: 'Kc Qd' }, { label: 'Cutoff', hand: 'Qh Qc' }, { label: 'Big blind', hand: 'Th Td' }], cue: 'All hands are exposed. Count the river cards that beat everyone.', lesson: '9 spades + 3 aces. All hands exposed.' },
  { id: 'e-multi-split', topic: 'Multiway split pots', hero: '2c 3d', board: 'As Ks Qs Js Ts', opponents: [{ label: 'Early position', range: 'AA, KK' }, { label: 'Cutoff', range: 'QQ, JJ' }, { label: 'Big blind', range: '99, 88' }], cue: 'The board has a royal flush. Think pot share, not outright wins.', lesson: 'The board plays for everyone. Split four ways.' },
);
export const outsSpots = [
  { id: 'o-flush', topic: 'Flop flush draws', hero: 'Ah 8h', board: 'Kh 6h 2c', target: 'flush' },
  { id: 'o-flush-turn', topic: 'Turn flush draws', hero: 'Ks Js', board: 'Qs 7s 2h 4d', target: 'flush' },
  { id: 'o-open', topic: 'Open-ended draws', hero: '9h 8c', board: '7s 6d Kc', target: 'straight' },
  { id: 'o-open-turn', topic: 'Open-ended draws', hero: 'Jc Td', board: '9h Qs 2d 4c', target: 'straight' },
  { id: 'o-gut', topic: 'Gutshots', hero: 'Jh 9c', board: '8s Qd 2c', target: 'straight' },
  { id: 'o-gut-turn', topic: 'Gutshots', hero: 'Ac 4d', board: '2h 3s Kc 9d', target: 'straight' },
  { id: 'o-combo', topic: 'Combination draws', hero: '9h 8h', board: '7h 6c Kh', target: 'either' },
  { id: 'o-combo-turn', topic: 'Combination draws', hero: 'Js Ts', board: '9s Qd 2s 4c', target: 'either' },
  { id: 'o-gut-flush', topic: 'Combination draws', hero: 'Ah 4h', board: '2h 3c Kh', target: 'either' },
  { id: 'o-gut-flush-turn', topic: 'Combination draws', hero: 'Qd Td', board: '9d Kc 2d 4h', target: 'either' },
  { id: 'o-flush-board', topic: 'Flop flush draws', hero: 'Ad 8c', board: 'Kd 6d 2d', target: 'flush' },
  { id: 'o-flush-board-turn', topic: 'Turn flush draws', hero: 'As 8c', board: 'Ks 6s 2s 4d', target: 'flush' },
];
export const potSpots = [
  { id: 'p-call', topic: 'Direct pot odds', equityId: 'e-flush', pot: 100, bet: 50 },
  { id: 'p-fold', topic: 'Direct pot odds', equityId: 'e-turn-straight', pot: 80, bet: 80 },
  { id: 'p-turn-call', topic: 'Direct pot odds', equityId: 'e-turn-flush', pot: 120, bet: 30 },
  { id: 'p-overbet', topic: 'Overbets', equityId: 'e-flush', pot: 60, bet: 180 },
  { id: 'p-set', topic: 'Overbets', equityId: 'e-set', pot: 100, bet: 250 },
  { id: 'p-domination', topic: 'Direct pot odds', equityId: 'e-domination', pot: 100, bet: 20 },
  { id: 'p-implied-call', topic: 'Implied odds', equityId: 'e-turn-straight', pot: 80, bet: 40, extra: 120 },
  { id: 'p-implied-fold', topic: 'Implied odds', equityId: 'e-turn-straight', pot: 80, bet: 40, extra: 20 },
  { id: 'p-implied-flush', topic: 'Implied odds', equityId: 'e-turn-flush', pot: 80, bet: 80, extra: 200 },
  { id: 'p-range', topic: 'Against a range', equityId: 'e-range-top', pot: 100, bet: 75 },
  { id: 'p-range-over', topic: 'Against a range', equityId: 'e-range-overpair', pot: 80, bet: 120 },
  { id: 'p-river', topic: 'Against a range', equityId: 'e-range-river', pot: 120, bet: 60 },
];
potSpots.push({ id: 'p-double-pot', topic: 'Overbets', equityId: 'e-flush', pot: 60, bet: 120 });
export const rangeSpots = [
  { id: 'r-dry', topic: 'Dry boards', range: 'AA, KK, QQ, AK, AQ, KQs, QJs, JTs', board: 'Kh 7d 2c' },
  { id: 'r-wet', estimateCategory: 'draw', topic: 'Connected boards', range: 'AA, KK, QQ, JJ, AKs, AQs, KQs, QJs, JTs, T9s, 98s', board: 'Jh Th 4c' },
  { id: 'r-low', estimateCategory: 'air', topic: 'Dry boards', range: 'AA, TT, 99, 88, AK, AQ, KQ, 76s, 65s', board: '8h 5c 2d' },
  { id: 'r-mono', estimateCategory: 'draw', topic: 'Suited boards', range: 'AA, KK, QQ, AK, AQ, KQ, QJs, JTs', board: 'Ts 7s 2s' },
  { id: 'r-turn', estimateCategory: 'air', topic: 'Connected boards', range: 'AA, KK, AQ, AJ, KQ, KJ, QJs, JTs, 98s', board: 'Th 9c 2d 5h' },
  { id: 'r-river', estimateCategory: 'air', topic: 'River ranges', range: 'AA, KK, QQ, AK, AQ, KQ, QJs, JTs', board: 'Ah 8d 2s 5c 9h' },
  { id: 'r-paired', topic: 'Paired boards', range: 'AA, KK, QQ, AK, AQ, KQ, QJs, JTs', board: '8h 8d 2c' },
  { id: 'r-wheel', estimateCategory: 'draw', topic: 'Connected boards', range: 'AA, KK, 66, 55, A5s, A4s, A3s, 76s, 65s, KQs', board: '2h 3d 6c' },
  { id: 'r-ace', topic: 'Dry boards', range: 'AA, KK, QQ, JJ, AKs, AQs, AJs, KQs, QJs, JTs', board: 'Ac 7h 3d' },
  { id: 'r-fourflush', topic: 'Suited boards', range: 'AA, KK, QQ, AK, AQ, KQ, JTs, T9s', board: '9h 7h 2h 4h' },
  { id: 'r-river-miss', estimateCategory: 'air', topic: 'River ranges', range: 'AA, KK, QQ, AK, AQ, KQ, QJs, JTs, 98s', board: 'Th 7h 2c 4s 5d' },
  { id: 'r-paired-turn', topic: 'Paired boards', range: 'AA, TT, 99, AK, AQ, KQs, QJs, JTs', board: 'Kh 7d 7c 2s' },
];

rangeSpots.push(...[
  ['AA', 'combo-pair'], ['AK', 'combo-unpaired'], ['AKs', 'combo-suited'], ['AKo', 'combo-offsuit'],
].flatMap(([range, comboRule]) => ['', 'As 7d 2c'].map((board, i) => ({
  id: `r-${comboRule}-${i}`, topic: 'Counting combinations', range, comboRule,
  board: board || '9h 7d 2c',
}))));
