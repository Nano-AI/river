import { grade, readHistory, saveHistory, summarize, weakSpots, TYPES, gradeEstimate, estimateStats, ruleStats } from './history.js';

const app = document.querySelector('#app');
const dialog = document.querySelector('#about-dialog');
const names = { equity: 'Equity', outs: 'Outs & odds', pot: 'Pot odds', range: 'Range reading' };
const fmt = n => n.toLocaleString('en-US');
const pct = n => n.toFixed(2);
const money = n => `${n < 0 ? '−' : ''}$${Math.abs(n).toFixed(2)}`;
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let storage;
try { storage = localStorage; } catch { storage = null; }
const saved = readHistory(storage);
let history = saved.entries;
let storageOK = saved.available;
let data, view = location.hash.slice(1) || 'equity';
if (![...TYPES, 'progress'].includes(view)) view = 'equity';
let lastDrill = TYPES.includes(view) ? view : 'equity';
let filter = null, tableFormat = 'all';
const sessions = {};
let mode = 'estimate', seconds = 0;
try { mode = storage?.getItem('river.mode') === 'classic' ? 'classic' : 'estimate'; seconds = [0, 10, 20, 30].includes(Number(storage?.getItem('river.seconds'))) && storage?.getItem('river.seconds') !== null ? Number(storage.getItem('river.seconds')) : 0; } catch { /* Defaults work without storage. */ }
let installEvent = null;
let offlineReady = false;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const suitNames = { s: 'spades', h: 'hearts', c: 'clubs', d: 'diamonds' };
const readableRange = notation => esc(notation.replace(/([2-9TJQKA])([cdhs])/g, (_, rank, suit) => (rank === 'T' ? '10' : rank) + ({s:'♠',h:'♥',d:'♦',c:'♣'}[suit])).replace(/([♠♥♦♣])(?=[2-9TJQKA])/g, '$1 '));
const rankNames = { A: 'Ace', K: 'King', Q: 'Queen', J: 'Jack', T: 'Ten' };
const suitPaths = {
  s: 'M20 2C15 9 3 14 3 24c0 9 11 11 15 4-1 5-3 8-6 10h16c-3-2-5-5-6-10 4 7 15 5 15-4C37 14 25 9 20 2Z',
  h: 'M20 36C15 30 2 22 2 12 2 0 16-1 20 8 24-1 38 0 38 12c0 10-13 18-18 24Z',
  d: 'M20 1 37 20 20 39 3 20Z',
  c: 'M20 2a9 9 0 0 0-6 16C1 11-3 30 8 32c5 1 8-2 10-5-1 5-3 9-6 11h16c-3-2-5-6-6-11 2 3 5 6 10 5 11-2 7-21-6-14a9 9 0 0 0-6-16Z',
};
function suit(symbol, className = '') { return `<svg viewBox="0 0 40 40" class="suit ${className}" aria-hidden="true"><path d="${suitPaths[symbol]}"/></svg>`; }
function card(code, i = 0) {
  const [r, s] = code;
  return `<div class="playing-card ${s === 'h' || s === 'd' ? 'warm-suit' : ''}" role="img" aria-label="${rankNames[r] || r} of ${suitNames[s]}" style="--deal:${i}"><span class="card-flipper"><span class="card-back" aria-hidden="true"></span><span class="card-face"><span class="card-corner"><b>${r === 'T' ? '10' : r}</b>${suit(s)}</span>${suit(s, 'card-center')}<span class="card-corner corner-bottom"><b>${r === 'T' ? '10' : r}</b>${suit(s)}</span></span></span></div>`;
}
const cards = str => str.trim() ? str.trim().split(/\s+/) : [];
function hand(str, label, hero = false) { return `<div class="hand-block ${hero ? 'hero-hand' : ''}"><span class="hand-label">${label}</span><div class="hand-cards">${cards(str).map((c, i) => card(c, i + (hero ? 0 : 2))).join('')}</div></div>`; }
function board(str) {
  const b = cards(str), stage = ({ 0: 'Preflop', 3: 'Flop', 4: 'Turn', 5: 'River' })[b.length];
  return `<div class="board-block"><div class="board-label"><span>${stage}</span><span class="board-line"></span><span>${b.length === 0 ? 'No board yet' : `${5 - b.length} to come`}</span></div><div class="board-cards">${b.map((c, i) => card(c, i + 4)).join('')}${Array.from({ length: 5 - b.length }, (_, i) => `<div class="card-slot" aria-hidden="true"><span>${b.length === 0 ? suit('s') : b.length + i === 3 ? 'Turn' : 'River'}</span></div>`).join('')}</div></div>`;
}
function rangeBox(notation, combos) {
  return `<div class="range-box"><span class="hand-label">Opponent’s range${combos ? `<span>${combos} combos</span>` : ''}</span><div class="range-tokens">${notation.split(/,\s*/).map(t => `<span>${readableRange(t)}</span>`).join('')}</div><span class="range-note">Equal weight per available combo</span></div>`;
}
function chipStack() {
  return `<div class="chip-stack" role="img" aria-label="A stack of poker chips">${[0, 1, 2, 3].map(i => `<svg viewBox="0 0 100 100" style="--chip:${i}" aria-hidden="true"><circle cx="50" cy="50" r="45" class="chip-edge"/><circle cx="50" cy="50" r="38" class="chip-dashes"/><circle cx="50" cy="50" r="28" class="chip-ring"/><path d="M50 29 67 50 50 71 33 50Z" class="chip-mark"/></svg>`).join('')}</div>`;
}
function session(type = view) {
  if (!sessions[type + mode]) newSpot(type);
  return sessions[type + mode];
}
function resetDrill(type) {
  for (const mode of ['estimate', 'classic']) delete sessions[type + mode];
}
function newSpot(type) {
  const spots = filter?.type === type ? data[type].filter(s => filter.rule ? s.estimate.rule === filter.rule : s.topic === filter.topic) : type === 'equity' && tableFormat !== 'all' ? data[type].filter(s => tableFormat === 'multiway' ? s.opponents : !s.opponents) : data[type];
  const attempts = history.filter(e => e.type === type && (type !== 'equity' || tableFormat === 'all' || spots.some(s => s.id === e.id)) && (!filter || filter.type !== type || (filter.rule ? spots.some(s => s.id === e.id) : e.topic === filter.topic))).length;
  let index = attempts % spots.length;
  if (spots[index].id === sessions[type + mode]?.spot.id && spots.length > 1) index = (index + 1) % spots.length;
  sessions[type + mode] = { spot: spots[index], answer: {}, graded: null, dealt: false, deadline: null };
}
function header() {
  const dark = document.documentElement.dataset.theme === 'dark';
  return `<header class="site-header"><a href="#equity" class="wordmark" aria-label="River home">river<span class="brand-dot"></span></a><nav class="main-nav" aria-label="Main"><a href="#${lastDrill}" ${view !== 'progress' ? 'aria-current="page"' : ''}>Practice</a><a href="#progress" ${view === 'progress' ? 'aria-current="page"' : ''}>Progress</a></nav><button type="button" class="theme-button" data-action="theme" aria-label="Switch to ${dark ? 'light' : 'dark'} mode"><span class="theme-orb" aria-hidden="true"></span><span>${dark ? 'Light' : 'Dark'}</span></button></header>`;
}
function footer() {
  return `<footer class="site-footer"><span><i class="status-dot" aria-hidden="true"></i><span id="offline-status">${offlineReady ? 'Ready offline' : 'Poker, by the numbers.'}</span></span><button type="button" data-action="about">About & install</button></footer>`;
}
function tabs() {
  return `<nav class="drill-tabs" aria-label="Choose a drill">${TYPES.map(t => `<a href="#${t}" ${t === view ? 'aria-current="page"' : ''}>${names[t]}</a>`).join('')}</nav>`;
}
function input(name, label, suffix = '%', max = 100) {
  const draft = session().answer[name];
  const value = Number.isFinite(draft) ? draft : '';
  return `<label class="answer-field"><span>${label}</span><span class="input-wrap"><input type="number" name="${name}" inputmode="${['%', '$'].includes(suffix) ? 'decimal' : 'numeric'}" min="0" max="${max}" step="${suffix === 'outs' || suffix === 'combos' ? '1' : 'any'}" autocomplete="off" placeholder="—" value="${esc(value)}" required aria-describedby="answer-hint"><span class="input-suffix">${suffix}</span></span></label>`;
}
function question(type, s) {
  if (mode === 'estimate') {
    if (type === 'equity') return ['What’s your equity?', 'Estimate your share of the pot, including split pots.'];
    if (type === 'outs') return ['How often do you get there?', 'Chance to hit a current out by river. Hitting ≠ winning.'];
    if (type === 'pot') return s.extra ? ['How much more do you need?', 'Extra net payout per outright win to break even.'] : ['What equity buys a call?', 'Pot before bet + their bet + your call.'];
    return s.comboRule ? ['How many combos remain?', 'Remove the board’s blockers from this hand.'] : s.estimate.category === 'draw' ? ['How much of it is drawing?', 'Unpaired, one card from a straight or flush.'] : s.estimate.category === 'air' ? ['How much of it is air?', 'Neither made nor a one-card draw.'] : ['How much of it is made?', 'Estimate the share with a pair or better.'];
  }
  if (type === 'equity') return ['How often do you win?', 'Estimate your outright win chance.'];
  if (type === 'outs') return ['How many ways to get there?', `Hit ${s.target === 'flush' ? 'a flush' : s.target === 'straight' ? 'a straight' : 'a straight or flush'}. Count your current outs.`];
  if (type === 'pot') return ['Is the price right?', s.extra ? 'Call or fold, including the stated extra payout.' : 'Call or fold. No further betting.'];
  return ['What’s in their range?', 'Split the available combos into three groups.'];
}
function hiddenHand(label) {
  return `<div class="hand-block"><span class="hand-label">${esc(label)}</span><div class="hand-cards">${[0, 1].map(i => `<div class="playing-card hidden-card" role="img" aria-label="Hidden card" style="--deal:${i}"><span class="hidden-pattern" aria-hidden="true">${suit('s')}</span></div>`).join('')}</div></div>`;
}
function spotVisual(type, s) {
  if (type === 'pot') return `<div class="pot-stage">${chipStack()}<p class="pot-live">In the middle <b class="pot-counter" data-from="${s.pot}" data-to="${s.pot + s.bet}">$${s.pot + s.bet}</b></p><div class="pot-numbers"><div><span>Pot before bet</span><strong>$${s.pot}</strong></div><span class="pot-plus" aria-hidden="true">+</span><div><span>Opponent bets</span><strong>$${s.bet}</strong></div></div><div class="equity-ticket"><span>Your equity</span><strong>${pct(s.result.equity)}<small>%</small></strong><span>Exact pot share</span></div>${s.extra && mode === 'estimate' ? `<p class="win-ticket">Outright win chance ${pct(s.equityResult.win)}% · ties ${pct(s.equityResult.tie)}%</p>` : ''}</div>${s.extra ? `<p class="model-note">Model: <b>$${s.extra} extra net on wins</b>; no extra cost on losses or ties. All equity realized.</p>` : '<p class="model-note">Call $' + s.bet + ' to see the showdown. No rake.</p>'}`;
  if (type === 'range') return `<div class="table-stage range-stage"><span class="deck-origin" aria-hidden="true"></span><div class="felt-table">${hiddenHand('Opponent’s hidden hand')}${board(s.board)}</div>${rangeBox(s.range, mode === 'estimate' && s.comboRule ? null : s.result.total)}<p class="definition-note">Made = pair or better. Draw = unpaired, one card from a straight or flush. Otherwise, air.</p></div>`;
  const opponents = s.opponents || (type === 'equity' ? [{ label: 'Opponent', hand: s.villain, range: s.range }] : [{ label: 'Opponent' }]);
  return `<div class="table-stage"><span class="deck-origin" aria-hidden="true"></span><div class="felt-table ${opponents.length > 1 ? 'multiway-table' : ''}"><div class="opponent-seats">${opponents.map((o, i) => `<div class="opponent-seat">${o.hand ? hand(o.hand, esc(o.label || `Opponent ${i + 1}`)) : hiddenHand(o.label || `Opponent ${i + 1}`)}<span class="seat-caption">${o.range ? 'Range: ' + readableRange(o.range) : o.hand ? '' : 'Cards unknown'}</span></div>`).join('')}</div>${board(s.board)}<div class="table-hero">${hand(s.hero, esc(s.handStatus || 'Your hand'), true)}<span class="hero-position">You</span></div></div>${s.opponents?.some(o => o.range) || s.range ? `<details class="range-assumptions"><summary>Range assumptions</summary><p>Hidden hands use the shown ranges. Each legal ${s.opponents ? 'joint assignment' : 'combo'} is equally likely; overlapping cards are removed.</p>${s.cue ? `<p>${esc(s.cue)}</p>` : ''}</details>` : ''}${type === 'outs' ? `<p class="draw-target">Target: ${s.target === 'either' ? 'straight or flush' : s.target}. Hit probability only; a completed draw can still lose.</p>` : ''}</div>`;
}
function estimateSlider(e) {
  if (e.unit !== '%') return '';
  const guess = session().answer.guess;
  return `<div class="estimate-slider"><label class="sr-only" for="estimate-slider">Adjust your estimate</label><input id="estimate-slider" type="range" min="0" max="100" step="1" value="${Number.isFinite(guess) ? guess : 50}"><div><span>0%</span><span>Drag to estimate</span><span>100%</span></div></div>`;
}
const mn = value => `<mn>${esc(value)}</mn>`;
const fraction = (top, bottom) => `<mfrac><mrow>${top}</mrow><mrow>${bottom}</mrow></mfrac>`;
const math = (body, latex = '') => `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">${latex ? `<semantics><mrow>${body}</mrow><annotation encoding="application/x-tex">${esc(latex)}</annotation></semantics>` : `<mrow>${body}</mrow>`}</math>`;
const percentMath = (top, bottom, value) => math(`${fraction(mn(top), mn(bottom))}<mo>×</mo><mn>100</mn><mo>≈</mo>${mn(pct(value))}<mo>%</mo>`);
function acceptedRange(exact) {
  const low = Math.max(0, exact - 5), high = Math.min(100, exact + 5);
  return `<p class="accepted-range">Accepted: <b>${pct(Math.ceil(low * 100) / 100)}%–${pct(Math.floor(high * 100) / 100)}%</b><span>±5 points · Whole numbers: ${Math.ceil(low)}–${Math.floor(high)}%</span></p>`;
}
function drawDerivation(s) {
  const r = s.result, two = r.cardsToCome === 2;
  const choose = (n, k) => `<mrow><mo>(</mo><mfrac linethickness="0">${mn(n)}${mn(k)}</mfrac><mo>)</mo></mrow>`;
  const numerator = two ? r.unseen - r.count : r.count;
  const probability = `<mi>P</mi><mo>(</mo><mtext>hit</mtext><mo>)</mo><mo>=</mo>${two ? '<mn>1</mn><mo>−</mo>' : ''}${fraction(choose(numerator, r.cardsToCome), choose(r.unseen, r.cardsToCome))}`;
  const latex = String.raw`P(\mathrm{hit}) = ${two ? '1 - ' : ''}\frac{\binom{${numerator}}{${r.cardsToCome}}}{\binom{${r.unseen}}{${r.cardsToCome}}}`;
  return `<div class="draw-derivation"><div class="outs-set" role="group" aria-label="Draw outs"><span>O = {</span><div class="outs-cards">${r.outs.map(code => `<span class="mini-card ${'hd'.includes(code[1]) ? 'warm-suit' : ''}" data-card="${code}" role="img" aria-label="${rankNames[code[0]] || code[0]} of ${suitNames[code[1]]}"><b>${code[0] === 'T' ? '10' : code[0]}</b><span>${{s:'♠',h:'♥',d:'♦',c:'♣'}[code[1]]}</span></span>`).join('')}</div><span>}</span></div>${math(`<mn>52</mn><mo>−</mo><mn>2</mn><mo>−</mo>${mn(cards(s.board).length)}<mo>=</mo>${mn(r.unseen)}<mspace width=".3em"/><mtext>unseen</mtext>`)}<p>${two ? '1 − (miss both ÷ all pairs).' : 'Current outs ÷ all river cards.'}</p>${math(probability, latex)}${percentMath(r.hits, r.total, r.chance)}<p>Draw hit ≠ win. Other runner-runner paths excluded.</p></div>`;
}
function workedSteps(type, s) {
  const e = s.estimate, r = s.result;
  let steps = e.steps || [], formula = '', note = '';
  if (type === 'equity') {
    if (e.outs !== undefined) {
      const change = e.useDeck ? `${fraction(mn(e.outs), mn(e.remaining))}<mo>×</mo><mn>100</mn>` : `${mn(e.outs)}<mo>×</mo>${mn(e.factor)}`;
      formula = math(`${e.mixed && !e.useDeck ? '<mtext>Range average</mtext>' : `${e.ahead ? '<mn>100</mn><mo>−</mo>' : ''}${change}`}<mo>≈</mo>${mn(pct(e.quick))}<mo>%</mo>`);
      note = e.useDeck ? 'Outs rounded; ranges averaged.' : 'Rough only: redraws can change the result.';
    } else if (s.board) formula = math(`<mtext>Pot share</mtext><mo>=</mo>${mn(pct(e.quick))}<mo>%</mo>`);
    else note = 'Suits and kickers shift this starting point.';
  }
  if (type === 'outs') {
    steps = [`${r.count} outs · ${r.cardsToCome} ${r.cardsToCome === 1 ? 'card' : 'cards'} to come.`];
    formula = drawDerivation(s) + `<p class="mental-rule">Rough shortcut</p>` + math(`${mn(r.count)}<mo>×</mo>${mn(r.cardsToCome === 2 ? 4 : 2)}<mo>≈</mo>${mn(r.approximation)}<mo>%</mo>`);
  }
  if (type === 'pot') {
    steps = [s.extra ? 'Shortfall ÷ win probability.' : `Call $${s.bet} · final pot $${r.finalPot}.`];
    formula = s.extra ? math(`${fraction(mn(pct(Math.max(0, -r.directEV))), mn((s.equityResult.win / 100).toFixed(4)))}<mo>≈</mo><mo>$</mo>${mn(pct(e.quick))}`) : percentMath(s.bet, r.finalPot, r.directRequired);
    note = s.extra ? 'Extra payout assumed; only on wins.' : 'Assumes no further betting.';
  }
  if (type === 'range') {
    if (s.comboRule) {
      const a = 4 - cards(s.board).filter(c => c[0] === s.range[0]).length;
      const b = 4 - cards(s.board).filter(c => c[0] === s.range[1]).length;
      const suited = ['c', 'd', 'h', 's'].filter(suit => !cards(s.board).includes(s.range[0] + suit) && !cards(s.board).includes(s.range[1] + suit)).length;
      const product = `${mn(a)}<mo>×</mo>${mn(b)}`;
      formula = math(`${s.comboRule === 'combo-pair' ? fraction(`${mn(a)}<mo>×</mo>${mn(a - 1)}`, '<mn>2</mn>') : s.comboRule === 'combo-suited' ? '<mtext>Unblocked suits</mtext>' : `${product}${s.comboRule === 'combo-offsuit' ? `<mo>−</mo>${mn(suited)}` : ''}`}<mo>=</mo>${mn(r.total)}`);
      steps = [s.comboRule === 'combo-offsuit' ? 'Rank combinations − suited combinations.' : 'Remove board blockers first.'];
    } else {
      steps = [`${r[e.category]} ${e.category} combos · ${r.total} total.`];
      formula = percentMath(r[e.category], r.total, e.exact);
      note = `Round to ${e.quick}%.`;
    }
  }
  return `<div class="worked-example"><h3>Quick math${type === 'equity' && mode === 'classic' ? ' · pot share' : ''}</h3>${s.lesson ? `<p>${esc(s.lesson)}</p>` : ''}<ul class="worked-steps">${steps.map(step => `<li>${esc(step)}</li>`).join('')}</ul>${formula}${note ? `<p class="shortcut-limit">${esc(note)}</p>` : ''}</div>`;
}
function coachHint(type, s) {
  return `<details class="coach-hint"><summary>How to estimate this</summary>${workedSteps(type, s)}</details>`;
}
function fieldNotes() {
  return `<details class="prep-guide"><summary>Tournament field notes<span>Quick reference</span></summary><div class="field-notes"><article><h3>Clean outs</h3><p>Flush draw: 9. Open-ended straight: 8.</p>${math('<mtext>Outs</mtext><mo>×</mo><mn>2</mn><mo>≈</mo><mtext>one-card %</mtext>')}${math('<mtext>Outs</mtext><mo>×</mo><mn>4</mn><mo>≈</mo><mtext>two-card %</mtext>')}<p>Discount opponents’ improvements.</p></article><article><h3>Call prices</h3><p>Half pot: 25%. Pot: 33%. Twice pot: 40%.</p></article><article><h3>Tournament equity</h3><p>ICM accounts for payouts. Near pay jumps, chip equity alone can mislead.</p></article></div><p class="learning-sources"><a href="https://www.pokerstars.com/poker/learn/lesson/calculating-outs/" target="_blank" rel="noreferrer">Outs</a> · <a href="https://www.pokerstars.com/poker/learn/lesson/icm-and-its-impact-on-tournaments/" target="_blank" rel="noreferrer">ICM</a> · <a href="https://www.pokerstars.com/poker/games/rules/hand-rankings/" target="_blank" rel="noreferrer">Hand rankings</a></p></details>`;
}
function answerForm(type) {
  let fields, hint;
  if (mode === 'estimate') {
    const e = session().spot.estimate;
    return `<form id="answer-form" class="answer-panel estimate-form"><div class="answer-fields estimate">${input('guess', e.label, e.unit, e.unit === '%' ? 100 : 1000000)}</div>${estimateSlider(e)}<p id="answer-hint" class="answer-hint">${type === 'equity' ? '±5 points earns full credit.' : 'Closer earns more points.'} ${e.unit === '$' ? 'Error is scaled to the call cost.' : e.unit === 'combos' ? 'Error is scaled to 16 combos.' : type === 'equity' ? '' : '1 point lost per percentage point of error.'}</p><p id="form-error" class="form-error" role="alert"></p><button class="primary-button" type="submit">Reveal estimate<span class="button-key" aria-hidden="true">↵</span></button></form>`;
  }
  if (type === 'equity') { fields = input('win', 'Your estimate'); hint = '±5 points counts as correct.'; }
  else if (type === 'outs') { fields = input('outs', 'Current outs', 'outs', 46) + input('chance', 'Hit a current out by river'); hint = 'Exact outs, and hit chance within 5 points. Hitting ≠ winning.'; }
  else if (type === 'range') { fields = input('made', 'Made') + input('draw', 'Draw') + input('air', 'Air'); hint = 'Total must be 100%. Each estimate within 5 points.'; }
  else {
    fields = `<fieldset class="choice-field"><legend class="sr-only">Your decision</legend>${['call', 'fold'].map(c => `<label class="choice"><input type="radio" name="choice" value="${c}" required ${session().answer.choice === c ? 'checked' : ''}><span>${c === 'call' ? 'Call' : 'Fold'}</span></label>`).join('')}</fieldset>`;
    hint = 'Choose the action with the higher expected value.';
  }
  return `<form id="answer-form" class="answer-panel"><div class="answer-fields ${type}">${fields}</div><p id="answer-hint" class="answer-hint">${hint}</p><p id="form-error" class="form-error" role="alert"></p><button type="submit" class="primary-button">Check answer<span class="button-key" aria-hidden="true">↵</span></button></form>`;
}
function exactDetail(type, s) {
  const r = s.result, rule = data.rules[s.estimate.rule];
  let html;
  if (type === 'equity') {
    const shares = mn(r.wins) + [2, 3, 4].filter(n => r.splitCounts[n]).map(n => `<mo>+</mo>${fraction(mn(r.splitCounts[n]), mn(n))}`).join('');
    html = `<dl><div><dt>Wins / ties / losses</dt><dd>${fmt(r.wins)} / ${fmt(r.ties)} / ${fmt(r.losses)}</dd></div><div><dt>Legal deals</dt><dd>${fmt(r.combos)}</dd></div><div><dt>Boards per deal</dt><dd>${fmt(r.total / r.combos)}</dd></div></dl><p>Pot-share equity:</p>${math(`${fraction(shares, mn(r.total))}<mo>×</mo><mn>100</mn><mo>≈</mo>${mn(pct(r.equity))}<mo>%</mo>`)}<p>52 cards. Best five cards win. No duplicates. Every legal outcome counted; ranges equally weighted.</p>`;
  } else if (type === 'outs') {
    html = `${mode === 'classic' ? drawDerivation(s) : ''}<p>${fmt(r.hits)} hits / ${fmt(r.total)} legal runouts. Every outcome counted.</p>`;
  } else if (type === 'pot') {
    html = `<p>Final pot: $${s.pot} + $${s.bet} + $${s.bet} = $${r.finalPot}.</p>${percentMath(s.bet, r.finalPot, r.directRequired)}<p>Call EV: ${money(r.ev)}. Fold EV: $0.</p>${math(`${fraction(mn(pct(r.equity)), '<mn>100</mn>')}<mo>×</mo>${mn(r.finalPot)}<mo>−</mo>${mn(s.bet)}<mo>≈</mo>${mn(pct(r.directEV))}`)}${s.extra ? `<p>Extra on wins only:</p>${math(`${fraction(mn(pct(s.equityResult.win)), '<mn>100</mn>')}<mo>×</mo>${mn(s.extra)}<mo>≈</mo>${mn(pct(s.equityResult.win / 100 * s.extra))}`)}` : ''}<p>No rake, later losses, or ICM. Displayed probabilities rounded.</p>`;
  } else {
    html = `<dl>${['made', 'draw', 'air'].map(k => `<div><dt>${k}</dt><dd>${r[k]} / ${r.total}</dd></div>`).join('')}</dl><p>Made hands take priority. Remove board blockers; weight remaining combos equally.</p>${['made', 'draw', 'air'].filter(k => r.combos[k].length).map(k => `<p>${k}: ${esc(r.combos[k].join(', '))}</p>`).join('')}`;
  }
  return `<details class="math-details"><summary>Show the math<span>Exact · no sampling error</span></summary><div class="math-content">${html}<p class="rule-accuracy">Shortcut error: ${pct(rule.mean)} ${rule.unit} average · ${pct(rule.worst)} worst · ${rule.samples} checks.</p><p class="rounding-note">Results rounded to 2 decimals. Equity grading uses unrounded values.</p></div></details>`;
}
function resultPanel(type, state) {
  if (mode === 'estimate') return estimateResult(type, state);
  const { spot: s, answer: a, graded: g } = state, r = s.result;
  let numbers, explanation;
  if (type === 'equity') {
    numbers = `<div class="result-hero"><span>Exact win chance</span><strong>${pct(r.win)}<small>%</small></strong></div><div class="result-comparison"><div><span>Your estimate</span><b>${a.win}%</b></div><div><span>Difference</span><b>${pct(g.error)} pp</b></div><div><span>Pot-share equity</span><b>${pct(r.equity)}%</b></div></div>`;
    explanation = `${fmt(r.wins)} wins / ${fmt(r.total)} outcomes · ${pct(r.tie)}% ties.`;
  } else if (type === 'outs') {
    numbers = `<div class="result-pair"><div class="result-hero"><span>Current outs</span><strong>${r.count}</strong><small>You said ${a.outs}</small></div><div class="result-hero"><span>Exact hit chance</span><strong>${pct(r.chance)}<small>%</small></strong><small>You said ${a.chance}%</small></div></div><div class="result-comparison"><div><span>Rule of ${r.cardsToCome === 2 ? '4' : '2'}</span><b>${r.approximation}%</b></div><div><span>Approximation error</span><b>${pct(Math.abs(r.difference))} pp ${r.difference >= 0 ? 'high' : 'low'}</b></div></div>`;
    explanation = `${r.count} of ${r.unseen} unseen cards complete this draw now.<br>${fmt(r.hits)} of ${fmt(r.total)} runouts hit a current out. This is not your win chance.`;
  } else if (type === 'pot') {
    numbers = `<div class="result-hero decision-result"><span>Higher EV in this model</span><strong>${r.choice === 'call' ? 'Call.' : 'Fold.'}</strong><span>You chose ${a.choice}</span></div><div class="result-comparison"><div><span>Equity needed${s.extra ? ' · direct' : ''}</span><b>${pct(r.directRequired)}%</b></div><div><span>Your equity</span><b>${pct(r.equity)}%</b></div><div><span>Call EV</span><b>${money(r.ev)}</b></div></div>`;
    explanation = s.extra ? `Direct call EV is ${money(r.directEV)}. The $${s.extra} extra on wins makes it ${money(r.ev)}.<br>You need ${money(r.neededExtra ?? 0)} extra per win to break even; this payout is an assumption.` : `$${s.bet} ÷ $${r.finalPot} = ${pct(r.directRequired)}% equity needed. You have ${pct(r.equity)}%.<br>Calling is worth ${money(r.ev)} versus $0 for folding, with no further betting.`;
  } else {
    numbers = `<div class="range-result">${['made', 'draw', 'air'].map(k => `<div><span>${k[0].toUpperCase() + k.slice(1)}</span><strong>${pct(r.fractions[k])}<small>%</small></strong><b>${r[k]} / ${r.total} combos</b><small>You said ${a[k]}%</small></div>`).join('')}</div><div class="range-bar" role="img" aria-label="Made ${pct(r.fractions.made)}%, draw ${pct(r.fractions.draw)}%, air ${pct(r.fractions.air)}%">${['made', 'draw', 'air'].map(k => `<span class="bar-${k}" style="width:${r.fractions[k]}%"></span>`).join('')}</div>`;
    explanation = `${r.total} available combos after board cards are removed.<br>Made hands take priority. Draws need one card; backdoor draws count as air.`;
  }
  return `<section class="result-panel ${g.correct ? 'is-correct' : 'is-incorrect'}" aria-labelledby="result-title"><div class="result-status"><span class="result-mark" aria-hidden="true">${g.correct ? '✓' : '−'}</span><h2 id="result-title" tabindex="-1">${g.correct ? 'Nice read.' : type === 'equity' ? `${pct(g.error)} points away.` : 'Keep practicing.'}</h2></div>${streakNotice(g)}${numbers}${type === 'equity' ? equityBar(r.win, a.win) : ''}<p class="explanation">${explanation}</p>${type === 'equity' ? workedSteps(type, s) : ''}${exactDetail(type, s)}<button type="button" class="primary-button" data-action="next">Next spot<span class="button-key" aria-hidden="true">↵</span></button></section>`;
}
function practice() {
  const state = session(), s = state.spot, [title, subtitle] = question(view, s);
  return `${tabs()}<main id="main" class="practice-view ${state.graded ? 'answered' : ''} ${state.dealt ? 'settled' : 'fresh'}" tabindex="-1"><div class="spot-heading"><div class="spot-meta"><span>Tournament practice</span><span>${history.filter(e => e.type === view).length} practiced</span></div><h1>${title}</h1><p>${subtitle}</p>${filter?.type === view ? `<button class="filter-label" data-action="clear-filter">Focused practice: ${esc(filter.rule ? data.rules[filter.rule].name : filter.topic)} <span>×</span></button>` : ''}</div>${modeControls(state)}<div class="practice-grid"><section class="table-panel" aria-label="Poker table"><div class="table-toolbar"><span>${esc(s.topic)}</span>${view === 'equity' ? `<label><span class="sr-only">Table format</span><select id="table-format">${[['all', 'All tables'], ['heads-up', 'Heads-up'], ['multiway', '3 opponents']].map(([value, label]) => `<option value="${value}" ${tableFormat === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>` : '<span>Read the spot</span>'}</div>${spotVisual(view, s)}</section><div class="decision-panel">${state.graded ? resultPanel(view, state) : `<div class="decision-heading"><h2>Your read</h2><span>${mode === 'estimate' ? 'An estimate is enough' : 'Put it into practice'}</span></div>${answerForm(view)}${coachHint(view, s)}`}</div></div>${fieldNotes()}</main>`;
}
function spark(entries, estimates = false) {
  const groups = [];
  for (let i = 0; i < entries.length; i += 5) groups.push(estimates ? estimateStats(entries.slice(i, i + 5)).score : summarize(entries.slice(i, i + 5)).accuracy);
  const recent = groups.slice(-12);
  const points = recent.map((v, i) => `${recent.length === 1 ? 80 : 4 + i * 152 / (recent.length - 1)},${44 - v * .38}`).join(' ');
  return `<svg class="sparkline" viewBox="0 0 160 50" role="img" aria-label="Chronological ${estimates ? 'estimate scores' : 'accuracy'} in groups of up to five: ${recent.map(pct).join(', ')} percent"><path d="M4 44H156" class="spark-axis"/>${recent.length > 1 ? `<polyline points="${points}"/>` : ''}${recent.map((v, i) => `<circle cx="${recent.length === 1 ? 80 : 4 + i * 152 / (recent.length - 1)}" cy="${44 - v * .38}" r="2.5"/>`).join('')}</svg>`;
}
function progress() {
  const overall = summarize(history), weak = weakSpots(history.filter(e => e.mode !== 'estimate')).filter(t => data[t.type].some(s => s.topic === t.topic));
  if (!history.length) return `<main id="main" class="progress-view empty-progress" tabindex="-1"><div class="spot-heading"><span class="section-kicker">Your progress</span><h1>A little practice.<br>A better read.</h1><p>Your first answer is the starting point.</p></div><div class="empty-illustration" aria-hidden="true">${card('As')}${card('Ad', 1)}<span class="empty-orbit"></span></div><p class="empty-copy">Accuracy, progress, and the spots to revisit.<br>All saved on this device.</p><a class="primary-button" href="#${lastDrill}">Start practicing</a></main>`;
  return `<main id="main" class="progress-view" tabindex="-1"><div class="spot-heading"><span class="section-kicker">Your progress</span><h1>Know your numbers.</h1><p>Every answer adds a little perspective.</p></div><div class="progress-overview"><div><strong>${Math.round(estimateStats(history).score ?? overall.accuracy)}<small>${estimateStats(history).total ? '' : '%'}</small></strong><span>${estimateStats(history).total ? 'Estimation /100' : 'Overall accuracy'}</span></div><div><strong>${overall.total}</strong><span>Spots practiced</span></div></div>${estimateProgress()}<section aria-labelledby="drill-progress-title"><div class="section-heading"><h2 id="drill-progress-title">Classic by drill</h2><span>Accuracy over time</span></div><div class="progress-rows">${TYPES.map(type => {
    const entries = history.filter(e => e.type === type && e.mode !== 'estimate'), stats = summarize(entries), last = summarize(entries.slice(-10)), before = summarize(entries.slice(-20, -10));
    return `<a class="progress-row" data-practice-mode="classic" href="#${type}"><div><h3>${names[type]}</h3><span>${stats.total} answers${stats.meanError === null ? '' : ` · ${pct(stats.meanError)} pp avg. error`}</span></div>${spark(entries)}<div class="progress-rate"><strong>${stats.accuracy === null ? '—' : `${Math.round(stats.accuracy)}%`}</strong><small>${before.total >= 10 && last.total >= 10 ? `${last.accuracy - before.accuracy >= 0 ? '+' : '−'}${Math.abs(last.accuracy - before.accuracy).toFixed(0)} pp vs prior 10` : stats.total ? `${stats.correct} of ${stats.total} correct` : 'Not started'}</small></div></a>`;
  }).join('')}</div><p class="chart-caption">Dots show consecutive groups of up to 5 answers. Latest 12 groups.</p></section><section class="weak-section" aria-labelledby="weak-title"><div class="section-heading"><h2 id="weak-title">Worth another hand</h2><span>Weak spots</span></div>${weak.length ? `<div class="weak-list">${weak.slice(0, 3).map(t => `<button type="button" class="weak-row" data-weak-type="${t.type}" data-weak-topic="${esc(t.topic)}"><span><b>${esc(t.topic)}</b><small>${names[t.type]} · ${t.total} answers</small></span><span>${Math.round(t.accuracy)}%<small>Practice again</small></span></button>`).join('')}</div>` : `<p class="quiet-copy">${history.length < 3 ? 'Keep going. Patterns appear after a few answers.' : 'No weak spots yet. Topics appear here below 80% accuracy after at least 3 answers.'}</p>`}</section><details class="history-details"><summary>Recent answers<span>Last ${Math.min(20, history.length)}</span></summary><ol>${history.slice(-20).reverse().map(e => `<li><span><b>${names[e.type]}</b><small>${esc(e.topic)}</small></span><span>${e.mode === 'estimate' ? `${pct(e.score)}/100` : e.correct ? 'Correct' : 'Review'}<small>${new Date(e.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</small></span></li>`).join('')}</ol></details><p class="privacy-note">Stored on this browser only. Clearing site data clears your progress.</p></main>`;
}
function render({ focus = false } = {}) {
  app.innerHTML = `${header()}${storageOK ? '' : '<p class="storage-warning" role="status">Progress storage is unavailable. New answers stay in this session.</p>'}${view === 'progress' ? progress() : practice()}${footer()}`;
  if (focus) document.querySelector('#main')?.focus({ preventScroll: true });
  animateSpot();
  tickTimer();
}
function navigate(next) {
  view = [...TYPES, 'progress'].includes(next) ? next : 'equity';
  if (TYPES.includes(view)) lastDrill = view;
  window.scrollTo({ top: 0, behavior: 'instant' });
  render({ focus: true });
}
function readAnswer(form) {
  const entries = new FormData(form);
  return Object.fromEntries([...entries].map(([k, v]) => [k, k === 'choice' ? v : v === '' ? NaN : Number(v)]));
}
app.addEventListener('input', e => {
  if (e.target.id === 'estimate-slider') document.querySelector('[name=guess]').value = e.target.value;
  if (e.target.name === 'guess' && document.querySelector('#estimate-slider')) document.querySelector('#estimate-slider').value = e.target.value || 50;
  if (e.target.form?.id === 'answer-form') {
    session().answer = readAnswer(e.target.form);
    document.querySelector('#form-error').textContent = '';
  }
});
function finishAnswer(timedOut = false) {
  const state = session();
  if (state.graded) return;
  const form = document.querySelector('#answer-form');
  try {
    state.answer = readAnswer(form);
    state.graded = mode === 'estimate' ? gradeEstimate(state.answer.guess, state.spot.estimate, timedOut) : grade(view, state.answer, state.spot.result);
    const previous = history.filter(e => (e.mode || 'classic') === mode).reverse();
    const lastMiss = previous.findIndex(e => !e.correct);
    state.graded.streak = state.graded.correct ? 1 + (lastMiss < 0 ? previous.length : lastMiss) : 0;
    history.push({ type: view, topic: state.spot.topic, id: state.spot.id, at: Date.now(), ...state.graded });
    if (storageOK) storageOK = saveHistory(storage, history);
    render();
    document.querySelector('#result-title').focus({ preventScroll: true });
    document.querySelector('.result-panel').scrollIntoView({ block: 'nearest', behavior: 'instant' });
  } catch (error) { document.querySelector('#form-error').textContent = error.message; }
}
app.addEventListener('submit', e => {
  if (e.target.id !== 'answer-form') return;
  e.preventDefault();
  const state = session();
  finishAnswer(mode === 'estimate' && state.deadline !== null && Date.now() >= state.deadline);
});
app.addEventListener('change', e => {
  if (e.target.id === 'table-format') {
    tableFormat = e.target.value; filter = null; resetDrill('equity'); render();
    document.querySelector('#table-format').focus({ preventScroll: true });
    return;
  }
  if (e.target.id !== 'time-limit') return;
  seconds = Number(e.target.value);
  try { storage?.setItem('river.seconds', String(seconds)); } catch { /* Session setting remains usable. */ }
  const deadline = seconds ? Date.now() + seconds * 1000 : null;
  for (const type of TYPES) {
    const state = sessions[type + 'estimate'];
    if (state && !state.graded) state.deadline = deadline;
  }
  tickTimer();
});
app.addEventListener('click', e => {
  const practiceLink = e.target.closest('a[data-practice-mode]');
  if (practiceLink) {
    e.preventDefault();
    mode = practiceLink.dataset.practiceMode;
    try { storage?.setItem('river.mode', mode); } catch { /* The mode still changes for this session. */ }
    location.hash = practiceLink.hash;
    return;
  }
  const button = e.target.closest('button');
  if (!button) return;
  if (button.dataset.mode) {
    mode = button.dataset.mode;
    try { storage?.setItem('river.mode', mode); } catch { /* Session mode remains usable. */ }
    render();
  }
  if (button.dataset.rule) {
    tableFormat = 'all'; mode = 'estimate'; filter = { type: button.dataset.type, rule: button.dataset.rule };
    try { storage?.setItem('river.mode', mode); } catch { /* Focused practice still works for this session. */ }
    resetDrill(filter.type);
    if (view === filter.type) navigate(view); else location.hash = filter.type;
  }
  if (button.dataset.weakType) {
    tableFormat = 'all';
    mode = 'classic';
    try { storage?.setItem('river.mode', mode); } catch { /* Practice remains available for this session. */ }
    filter = { type: button.dataset.weakType, topic: button.dataset.weakTopic };
    resetDrill(filter.type);
    if (view === filter.type) navigate(view); else location.hash = filter.type;
  }
  if (button.dataset.action === 'next') { newSpot(view); render({ focus: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }
  if (button.dataset.action === 'clear-filter') { filter = null; resetDrill(view); render({ focus: true }); }
  if (button.dataset.action === 'theme') {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#10201b' : '#edf2ef';
    try { storage?.setItem('river.theme', theme); } catch { /* Theme still works for this session. */ }
    const label = theme === 'dark' ? 'Light' : 'Dark';
    button.setAttribute('aria-label', `Switch to ${label.toLowerCase()} mode`);
    button.querySelector('span:last-child').textContent = label;
  }
  if (button.dataset.action === 'about') showAbout();
});
function showAbout() {
  dialog.innerHTML = `<div class="dialog-header"><span class="wordmark">river<span class="brand-dot"></span></span><button class="close-dialog" aria-label="Close about">Close</button></div><h2 id="about-title">A better feel<br>for the numbers.</h2><p>Four short drills for heads-up and multiway No-Limit Texas Hold’em tournament prep. Every answer comes from exact enumeration.</p><div class="about-section"><h3>How practice works</h3><p>Estimate mode starts untimed. Equity estimates within ±5 percentage points earn full credit. Add a 10-, 20-, or 30-second clock when you want pressure practice. Classic keeps the original questions and grading. Equity includes your actual share of split pots; Classic win chance excludes ties.</p><p>All ${data ? TYPES.reduce((n, t) => n + data[t].length, 0) + " " : ""}spots are computed in advance. Percentages are rounded to 2 decimals; sampling error is zero. Assumptions and outcome counts live under “Show the math.”</p></div><div class="about-section"><h3>Keep River close</h3><p>Install for a quiet, full-screen table that works offline.</p>${installEvent ? '<button class="primary-button" id="install-button">Install River</button>' : '<p class="install-instructions">On iPhone: Safari → Share → Add to Home Screen.<br>On Android or desktop: use your browser’s Install app menu.</p>'}<span class="offline-message">${offlineReady ? 'All practice spots are saved for offline use.' : 'Offline setup completes after the first successful load.'}</span></div><div class="about-section"><h3>Just the math</h3><p>No account, ads, analytics, or strategy promises. Pot decisions apply only to the displayed payout model. Your history stays in this browser; clearing site data removes it.</p></div><p class="about-signoff">Made for a little practice, often.</p>`;
  dialog.showModal();
  dialog.querySelector('.close-dialog').addEventListener('click', () => dialog.close());
  dialog.querySelector('#install-button')?.addEventListener('click', async () => { await installEvent.prompt(); installEvent = null; dialog.close(); });
}
dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
dialog.addEventListener('close', () => document.querySelector('[data-action="about"]')?.focus({ preventScroll: true }));
document.querySelector('.skip-link').addEventListener('click', e => {
  e.preventDefault();
  const main = document.querySelector('#main');
  main.tabIndex = -1;
  main.focus();
});
window.addEventListener('hashchange', () => { if (data) navigate(location.hash.slice(1)); });
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvent = e; });
window.addEventListener('appinstalled', () => { installEvent = null; });
window.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !dialog.open && TYPES.includes(view) && sessions[view + mode]?.graded && !e.target.closest('button, a, input, summary')) {
    e.preventDefault();
    document.querySelector('[data-action="next"]')?.click();
  }
});
window.addEventListener('storage', e => {
  if (e.key === 'river.history.v1') {
    const next = readHistory(storage); history = next.entries; storageOK = next.available;
    if (view === 'progress') render();
  }
});

function modeControls(state) {
  return `<div class="mode-controls"><div class="mode-switch" role="group" aria-label="Practice mode">${['estimate', 'classic'].map(m => `<button type="button" data-mode="${m}" aria-pressed="${m === mode}">${m === 'estimate' ? 'Estimate' : 'Classic'}</button>`).join('')}</div>${mode === 'estimate' ? `<div class="timer-controls"><label class="sr-only" for="time-limit">Time limit</label><select id="time-limit" ${state.graded ? 'disabled' : ''}>${[10, 20, 30, 0].map(n => `<option value="${n}" ${n === seconds ? 'selected' : ''}>${n ? n + ' seconds' : 'Untimed'}</option>`).join('')}</select><span id="countdown" role="timer" aria-label="Time remaining">${seconds ? seconds + 's' : '∞'}</span></div>` : ''}</div>`;
}
function tickTimer() {
  if (!data || !document.querySelector('#answer-form') || !TYPES.includes(view) || mode !== 'estimate') return;
  const state = session(), label = document.querySelector('#countdown');
  if (state.graded || !label) return;
  if (state.deadline === null) { label.textContent = '∞'; return; }
  const left = Math.max(0, state.deadline - Date.now());
  const text = Math.min(seconds, Math.ceil(left / 1000)) + 's';
  if (label.textContent !== text) label.textContent = text;
  if (!left) finishAnswer(true);
}
const estimateValue = (n, unit) => n === null ? '—' : unit === '$' ? money(n) : `${pct(n)}${unit === '%' ? '%' : ''}`;
function equityBar(exact, guess) {
  const low = Math.max(0, Math.floor(exact / 5) * 5 - 15), high = Math.min(100, Math.ceil(exact / 5) * 5 + 15);
  const position = value => 100 * (value - low) / (high - low);
  const guessPosition = Math.max(0, Math.min(100, position(guess)));
  const correct = guess !== null && Math.abs(guess - exact) <= 5;
  const outside = guess !== null && (guess < low ? 'low' : guess > high ? 'high' : '');
  const gradient = [[-15, '#ba5d55'], [-8, '#bc944b'], [-5, '#74af73'], [0, '#33dca0'], [5, '#74af73'], [8, '#bc944b'], [15, '#ba5d55']].map(([distance, color]) => `${color} ${position(exact + distance)}%`).join(',');
  const bandStart = position(Math.max(0, exact - 5)), bandEnd = position(Math.min(100, exact + 5));
  return `<div class="equity-visual equity-heatmap" data-min="${low}" data-max="${high}"><div class="equity-track" role="img" aria-label="Accuracy heatmap from ${low} to ${high} percent. Green at exact ${pct(exact)} percent; amber then red farther away. Guess ${guess === null ? 'unanswered' : pct(guess) + ' percent'}${outside ? ', beyond the ' + (outside === 'low' ? 'left' : 'right') + ' edge' : ''}. Accepted within 5 points."><span class="equity-fill" style="--equity:1;background:linear-gradient(90deg,${gradient})"></span><span class="heatmap-band" style="left:${bandStart}%;width:${bandEnd - bandStart}%"></span><i class="equity-marker marker-exact" style="left:${position(exact)}%"></i>${guess === null ? '' : `<i class="equity-marker marker-guess" data-outside="${outside}" style="left:${guessPosition}%"></i>`}${correct ? `<span class="heatmap-hit" style="left:${guessPosition}%" aria-hidden="true"></span>` : ''}</div><div class="bar-key"><span>${low}%</span><span>◇ Exact · ${outside ? (outside === 'low' ? '← ' : '→ ') + pct(guess) + '% off scale' : '│ You'}</span><span>${high}%</span></div>${acceptedRange(exact)}</div>`;
}
function streakNotice(graded) {
  const count = graded.streak || 0;
  return count > 0 && count % 3 === 0 ? `<p class="streak"><span aria-hidden="true">✧</span> ${count} ${mode === 'estimate' ? 'close reads' : 'correct answers'} in a row</p>` : '';
}
function estimateResult(type, state) {
  const { spot: s, graded: g } = state, e = s.estimate;
  const error = n => n === null ? 'No guess' : `${pct(n)} ${e.unit === '%' ? 'pp' : e.unit === '$' ? '$' : 'combos'} error`;
  return `<section class="result-panel estimate-result ${g.correct ? 'is-correct' : 'is-incorrect'}" aria-labelledby="result-title"><div class="result-status"><span class="result-mark" aria-hidden="true">${g.correct ? '✓' : '−'}</span><h2 id="result-title" tabindex="-1">${g.guess === null ? 'Time to take a look.' : g.correct ? (e.unit === '%' ? g.error <= 1 ? 'Spot on!' : g.error <= 2.5 ? 'Great read.' : 'In range.' : 'Close read.') : type === 'equity' ? `${pct(g.error)} points away.` : 'A little recalibration.'}</h2><strong class="estimate-score">${pct(g.score)}<small>/100</small></strong></div>${g.timedOut ? `<p class="timeout-note">Time’s up. ${g.guess === null ? 'No valid guess was entered.' : 'Your last valid guess was saved.'}</p>` : ''}${streakNotice(g)}<p class="comparison-label">${e.label}</p><div class="estimate-comparison">${[['Your guess', g.guess, g.error], ['Quick math', e.quick, Math.abs(e.quick - e.exact)], ['Exact value', e.exact, 0]].map(([label, value, diff]) => `<div><span>${label}</span><strong>${estimateValue(value, e.unit)}</strong><small>${error(diff)}</small></div>`).join('')}</div>${e.unit === '%' ? equityBar(e.exact, g.guess) : ''}${workedSteps(type, s)}${exactDetail(type, s)}<button type="button" class="primary-button" data-action="next">Next spot<span class="button-key" aria-hidden="true">↵</span></button></section>`;
}
function estimateProgress() {
  const entries = history.filter(e => e.mode === 'estimate'), stats = estimateStats(entries);
  const rules = ruleStats(entries).filter(r => data.rules[r.rule] && data[r.type].some(s => s.estimate.rule === r.rule));
  const weakest = rules.filter(r => r.total >= 3)[0];
  return `<section class="estimate-progress" aria-labelledby="estimate-progress-title"><div class="section-heading"><h2 id="estimate-progress-title">Estimation accuracy</h2><span>${stats.total ? pct(stats.score) + '/100 average' : 'Your next skill'}</span></div>${TYPES.map(type => {
    const attempts = entries.filter(e => e.type === type), row = estimateStats(attempts);
    return `<a class="progress-row" data-practice-mode="estimate" href="#${type}"><div><h3>${names[type]}</h3><span>${row.total} estimates</span></div>${spark(attempts, true)}<div class="progress-rate"><strong>${row.score === null ? '—' : pct(row.score)}</strong><small>closeness /100</small></div></a>`;
  }).join('')}<p class="chart-caption">Chronological average score in groups of 5. Dollars scaled to call cost; combos to 16.</p>${weakest ? `<button type="button" class="weak-rule" data-rule="${weakest.rule}" data-type="${weakest.type}"><span>Weakest rule · ${esc(data.rules[weakest.rule].name)}</span><b>Practice · ${pct(weakest.score)}/100</b></button>` : '<p class="quiet-copy">After 3 estimates of a rule, your weakest appears here.</p>'}<details class="rule-library"><summary>Rules & your accuracy</summary><p class="quiet-copy">Errors describe the tested spots, not a universal bound. Exact arithmetic rules have zero approximation error; rounding may still apply.</p>${Object.entries(data.rules).map(([id, rule]) => {
    const row = rules.find(r => r.rule === id), type = TYPES.find(t => data[t].some(s => s.estimate.rule === id));
    return `<article class="rule-row"><h3>${esc(rule.name)}</h3><p>${esc(rule.rule)}</p><small>Measured: ${pct(rule.mean)} ${rule.unit} mean · ${pct(rule.worst)} ${rule.unit} worst · ${rule.samples} cases</small>${row ? `<p>${row.total} estimates · ${pct(row.score)}/100 · ${row.meanError === null ? 'No valid guesses' : pct(row.meanError) + ' ' + rule.unit + ' average error'}</p>${spark(row.entries, true)}` : ''}${type ? `<button type="button" data-rule="${id}" data-type="${type}">Practice this rule</button>` : ''}</article>`;
  }).join('')}</details></section>`;
}
function animateSpot() {
  if (!TYPES.includes(view)) return;
  const state = session();
  if (state.dealt || state.graded) return;
  state.dealt = true;
  const reduced = reducedMotion.matches;
  const origin = document.querySelector('.deck-origin')?.getBoundingClientRect();
  if (origin && !reduced) for (const el of document.querySelectorAll('.playing-card')) {
    const r = el.getBoundingClientRect(), delay = Number(el.style.getPropertyValue('--deal')) * 110;
    el.animate?.([{ transform: `translate(${origin.x - r.x}px, ${origin.y - r.y}px) scale(.4)`, opacity: 0 }, { transform: 'translate(0, 0) scale(1)', opacity: 1 }], { duration: 360, delay, fill: 'backwards', easing: 'cubic-bezier(.2,.7,.3,1)' });
  }
  const counter = document.querySelector('.pot-counter');
  if (counter && !reduced) {
    const from = Number(counter.dataset.from), to = Number(counter.dataset.to), start = performance.now();
    function tick(now) {
      if (!counter.isConnected) return;
      if (reducedMotion.matches) { counter.textContent = '$' + to; return; }
      const fraction = Math.min(1, Math.max(0, (now - start - 150) / 600));
      counter.textContent = '$' + Math.round(from + (to - from) * fraction);
      if (fraction < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  if (mode === 'estimate') state.deadline = seconds ? Date.now() + seconds * 1000 + (reduced ? 180 : 1500) : null;
}

async function start() {
  document.querySelector('#retry')?.setAttribute('disabled', '');
  try {
    const response = await fetch('./spots.json');
    if (!response.ok) throw new Error('Could not load spots.');
    const next = await response.json();
    if (next?.version !== 1 || !next.rules || !TYPES.every(t => Array.isArray(next[t]) && next[t].length && next[t].every(s => s?.estimate && next.rules[s.estimate.rule] && Number.isFinite(s.estimate.exact) && Number.isFinite(s.estimate.quick) && s.estimate.scale > 0))) throw new Error('Invalid spots.');
    data = next;
    navigate(location.hash.slice(1));
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').then(async () => {
        await navigator.serviceWorker.ready;
        offlineReady = true;
        const label = document.querySelector('#offline-status');
        if (label) label.textContent = 'Ready offline';
      }).catch(() => { /* Practice remains available when offline installation is unsupported. */ });
    }
  } catch {
    app.innerHTML = `${header()}<main id="main" class="load-error"><h1>The table couldn’t load.</h1><p>Reconnect once to save the practice spots, then try again.</p><button class="primary-button" id="retry">Try again</button></main>${footer()}`;
    document.querySelector('#retry').addEventListener('click', start);
  }
}
reducedMotion.addEventListener?.('change', () => {
  if (reducedMotion.matches) for (const animation of document.getAnimations()) {
    if (animation.effect?.getKeyframes().some(frame => 'transform' in frame)) animation.cancel();
  }
});
setInterval(tickTimer, 100);
window.addEventListener('visibilitychange', tickTimer);
start();
