import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const appSource = (await readFile(new URL('../public/app.js', import.meta.url), 'utf8')).replace(/^import .*\n/, '');
const historySource = (await readFile(new URL('../public/history.js', import.meta.url), 'utf8')).replace(/^export /gm, '');
const themeSource = await readFile(new URL('../public/theme.js', import.meta.url), 'utf8');
const data = JSON.parse(await readFile(new URL('../public/spots.json', import.meta.url), 'utf8'));
const pause = () => new Promise(resolve => setTimeout(resolve, 5));
async function boot({ hash = 'equity', entries, corrupt = false, fail = false, quota = false, mode = 'classic', seconds = 0, payload = data } = {}) {
  const dom = new JSDOM(html, { url: `http://localhost/#${hash}`, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  if (mode !== null) w.localStorage.setItem('river.mode', mode);
  if (seconds !== null) w.localStorage.setItem('river.seconds', String(seconds));
  w.motionPreference = { matches: false, addEventListener: (_event, listener) => { w.changeMotion = listener; } };
  w.matchMedia = query => query.includes('reduced-motion') ? w.motionPreference : { matches: false };
  w.document.getAnimations = () => [];
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.scrollTo = () => {};
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  if (entries) w.localStorage.setItem('river.history.v1', JSON.stringify(entries));
  if (corrupt) w.localStorage.setItem('river.history.v1', 'broken');
  if (quota) w.Storage.prototype.setItem = () => { throw new Error('Quota exceeded'); };
  w.fetch = async () => ({ ok: !fail, json: async () => payload });
  w.eval(themeSource);
  w.eval(historySource + '\n' + appSource);
  await pause();
  return { dom, w, doc: w.document };
}
function fill(w, name, value) {
  const field = w.document.querySelector(`[name="${name}"]`);
  assert.ok(field, name);
  if (field.type === 'radio') w.document.querySelector(`[name="${name}"][value="${value}"]`).checked = true;
  else field.value = value;
  field.dispatchEvent(new w.Event('input', { bubbles: true }));
}
function submit(w) { w.document.querySelector('#answer-form').dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true })); }
async function navigate(w, view) { w.location.hash = view; await pause(); }
function answerFor(type, spot) {
  const r = spot.result;
  if (type === 'equity') return { win: r.win.toFixed(1) };
  if (type === 'outs') return { outs: r.count, chance: r.chance.toFixed(1) };
  if (type === 'pot') return { choice: r.choice };
  const made = Math.round(r.fractions.made), draw = Math.round(r.fractions.draw);
  return { made, draw, air: 100 - made - draw };
}
test('equity slider and numeric estimate stay synchronized across drill navigation', async () => {
  const { dom, w, doc } = await boot({ mode: 'estimate' });
  const slider = doc.querySelector('#estimate-slider');
  assert.ok(slider, 'A touch estimate control must be available');
  slider.value = '35';
  slider.dispatchEvent(new w.Event('input', { bubbles: true }));
  assert.equal(doc.querySelector('[name=guess]').value, '35');
  fill(w, 'guess', '41');
  assert.equal(slider.value, '41');
  await navigate(w, 'outs');
  await navigate(w, 'equity');
  assert.equal(doc.querySelector('#estimate-slider').value, '41');
  dom.window.close();
});
test('multiway filtering deals real hidden ranges and keeps the model visible after grading', async t => {
  const { dom, w, doc } = await boot({ mode: 'estimate' });
  t.after(() => dom.window.close());
  const picker = doc.querySelector('#table-format');
  assert.ok(picker, 'Multiway drills must be directly selectable');
  picker.value = 'multiway';
  picker.dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.equal(doc.querySelectorAll('.hidden-card').length, 6);
  assert.equal(doc.querySelectorAll('.opponent-seat').length, 3);
  assert.match(doc.querySelector('.opponent-seats').textContent, /KQ/);
  assert.match(doc.querySelector('.range-assumptions').textContent, /equally likely/);
  const spot = data.equity.find(s => s.opponents);
  fill(w, 'guess', String(spot.estimate.exact + 4));
  submit(w);
  assert.match(doc.querySelector('.estimate-score').textContent, /100.00/);
  assert.ok(doc.querySelector('.accepted-range'));
  assert.ok(doc.querySelector('.worked-steps li'));
  assert.equal(doc.querySelectorAll('.hidden-card').length, 6);
  doc.querySelector('[data-action=next]').click();
  assert.equal(doc.querySelectorAll('.opponent-seat').length, 3);
  dom.window.close();
});
test('equity lessons show current hand, compact typeset math, and Classic acceptance limits', async t => {
  const payload = structuredClone(data);
  payload.equity = [data.equity.find(s => s.id === 'e-multi-flush'), data.equity.find(s => s.id === 'e-multi-set')];
  const { dom, w, doc } = await boot({ payload });
  t.after(() => dom.window.close());
  assert.match(doc.querySelector('.hero-hand .hand-label').textContent, /Flush draw.*4\/5/);
  fill(w, 'win', 27); submit(w);
  assert.ok(doc.querySelector('.worked-example math'));
  assert.ok(doc.querySelector('.worked-example mfrac'));
  assert.ok(doc.querySelector('.worked-example').textContent.split(/\s+/).length < 45);
  assert.equal(doc.querySelector('.math-details').open, false);
  doc.querySelector('[data-action=next]').click();
  assert.match(doc.querySelector('.hero-hand .hand-label').textContent, /Three of a kind/);
  fill(w, 'win', 75); submit(w);
  assert.match(doc.querySelector('.accepted-range').textContent, /75.93%–85.92%/);
  assert.match(doc.querySelector('.accepted-range').textContent, /76–85/);
  assert.equal(doc.querySelector('#result-title').textContent, '5.92 points away.');
});
test('equity heatmap focuses on the target, celebrates accepted answers, and flags off-scale guesses', async t => {
  for (const [exact, guess, success, title] of [[39.29, 39.29, true, 'Spot on!'], [39.29, 43, true, 'In range.'], [39.29, 48, false, '8.71 points away.'], [0, 100, false, '100.00 points away.'], [100, 100, true, 'Spot on!']]) {
    const payload = structuredClone(data);
    payload.equity[0].estimate.exact = exact;
    const { dom, w, doc } = await boot({ payload, mode: 'estimate' });
    t.after(() => dom.window.close());
    fill(w, 'guess', guess); submit(w);
    const visual = doc.querySelector('.equity-visual');
    assert.ok(visual.classList.contains('equity-heatmap'));
    const low = Number(visual.dataset.min), high = Number(visual.dataset.max);
    assert.ok(low >= 0 && high <= 100 && high - low <= 40);
    assert.ok(low <= exact && high >= exact);
    assert.equal(Boolean(doc.querySelector('.heatmap-hit')), success);
    assert.equal(doc.querySelector('#result-title').textContent, title);
    assert.match(doc.querySelector('.equity-fill').getAttribute('style'), /linear-gradient/);
    assert.equal(doc.querySelectorAll('.marker-exact').length, 1);
    assert.equal(doc.querySelectorAll('.marker-quick').length, 0);
    if (guess > high) assert.equal(doc.querySelector('.marker-guess').dataset.outside, 'high');
  }
});
test('draw lessons show readable out cards and exact one- and two-card combinations', async t => {
  for (const count of [1, 2]) {
    const spot = data.outs.find(s => s.target === 'flush' && s.result.count === 9 && s.result.cardsToCome === count && s.result.outs.some(c => c[0] === 'T'));
    const payload = structuredClone(data);
    payload.outs = [spot];
    const { dom, w, doc } = await boot({ payload, hash: 'outs', mode: 'estimate' });
    t.after(() => dom.window.close());
    fill(w, 'guess', spot.estimate.exact); submit(w);
    assert.equal(doc.querySelectorAll('.outs-set .mini-card').length, 9);
    const ten = doc.querySelector('.outs-set [data-card^="T"]');
    assert.match(ten.textContent, /^10[♣♦♥♠]$/);
    assert.match(ten.getAttribute('aria-label'), /^Ten of /);
    const derivation = doc.querySelector('.draw-derivation');
    assert.ok(derivation.querySelectorAll('mfrac[linethickness="0"]').length >= 2);
    assert.match(derivation.textContent, new RegExp(`52−2−${5 - count}=${spot.result.unseen}`));
    assert.match(derivation.textContent, new RegExp(spot.result.chance.toFixed(2).replace('.', '\\.')));
    assert.match(derivation.querySelector('annotation').textContent, /\\binom/);
    assert.match(derivation.textContent, /Draw hit ≠ win/);
  }
});
test('every authored drill spot completes answer → grade → explanation → next', async () => {
  for (const type of ['equity', 'outs', 'pot', 'range']) {
    const { dom, w, doc } = await boot({ hash: type });
    for (const spot of data[type]) {
      assert.ok(doc.querySelector('#answer-form'), spot.id);
      assert.equal(doc.querySelector('.result-panel'), null);
      for (const [key, value] of Object.entries(answerFor(type, spot))) fill(w, key, value);
      submit(w);
      assert.equal(doc.querySelector('#result-title')?.textContent, 'Nice read.', spot.id);
      assert.ok(doc.querySelector('.explanation').textContent.length > 20);
      assert.match(doc.querySelector('.math-details').textContent, /no sampling error/);
      assert.equal(doc.activeElement.id, 'result-title');
      doc.querySelector('[data-action="next"]').click();
    }
    const entries = JSON.parse(w.localStorage.getItem('river.history.v1'));
    assert.equal(entries.length, data[type].length);
    assert.ok(entries.every(e => e.correct));
    dom.window.close();
  }
});
test('range totals validate, failed submissions do not count, and draft answers persist across tabs', async () => {
  const { dom, w, doc } = await boot({ hash: 'range' });
  for (const name of ['made', 'draw', 'air']) fill(w, name, 50);
  submit(w);
  assert.match(doc.querySelector('#form-error').textContent, /add up to 100/);
  assert.equal(w.localStorage.getItem('river.history.v1'), null);
  await navigate(w, 'equity'); fill(w, 'win', 30);
  await navigate(w, 'outs'); await navigate(w, 'equity');
  assert.equal(doc.querySelector('[name=win]').value, '30');
  fill(w, 'win', ''); await navigate(w, 'outs'); await navigate(w, 'equity');
  assert.equal(doc.querySelector('[name=win]').value, '');
  dom.window.close();
});
test('results cannot be counted twice and Enter advances from the result heading', async () => {
  const { dom, w, doc } = await boot();
  fill(w, 'win', 47); submit(w);
  assert.equal(JSON.parse(w.localStorage.getItem('river.history.v1')).length, 1);
  await navigate(w, 'outs'); await navigate(w, 'equity');
  assert.ok(doc.querySelector('#result-title'));
  doc.querySelector('#result-title').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  assert.ok(doc.querySelector('#answer-form'));
  assert.equal(JSON.parse(w.localStorage.getItem('river.history.v1')).length, 1);
  dom.window.close();
});
test('progress renders accuracy, history, weak topics and focused retry', async () => {
  const entries = Array.from({ length: 3 }, (_, i) => ({ id: 'e-flush', type: 'equity', topic: 'Flush draws', at: 1760000000000 + i, score: 80, error: 20, correct: false }));
  const { dom, w, doc } = await boot({ hash: 'progress', entries });
  assert.match(doc.querySelector('.progress-overview').textContent, /0%/);
  assert.equal(doc.querySelectorAll('.progress-row').length, 8);
  assert.equal(doc.querySelectorAll('.history-details li').length, 3);
  doc.querySelector('[data-weak-type]').click(); await pause();
  assert.match(doc.querySelector('.filter-label').textContent, /Flush draws/);
  doc.querySelector('[data-action="clear-filter"]').click();
  assert.equal(doc.querySelector('.filter-label'), null);
  dom.window.close();
});
test('progress keeps old attempts but does not offer a removed topic as focused practice', async () => {
  const entries = Array.from({ length: 3 }, () => ({ id: 'old-spot', type: 'equity', topic: 'Retired topic', at: 1760000000000, score: 80, error: 20, correct: false }));
  const { dom, doc } = await boot({ hash: 'progress', entries });
  assert.equal(doc.querySelectorAll('.weak-row').length, 0);
  assert.equal(doc.querySelectorAll('.history-details li').length, 3);
  dom.window.close();
});
test('empty progress and unavailable storage have useful states without data loss', async () => {
  const empty = await boot({ hash: 'progress' });
  assert.ok(empty.doc.querySelector('.empty-progress'));
  empty.dom.window.close();
  for (const options of [{ corrupt: true }, { quota: true }]) {
    const { dom, w, doc } = await boot(options);
    fill(w, 'win', 30); submit(w);
    assert.ok(doc.querySelector('.storage-warning'));
    await navigate(w, 'progress'); assert.match(doc.querySelector('.progress-overview').textContent, /1Spots practiced/);
    if (options.corrupt) assert.equal(w.localStorage.getItem('river.history.v1'), 'broken');
    dom.window.close();
  }
});
test('theme changes preserve answers, about dialog opens/closes, failed load can retry', async () => {
  const { dom, w, doc } = await boot();
  fill(w, 'win', 42);
  doc.querySelector('[data-action=theme]').click();
  assert.equal(doc.documentElement.dataset.theme, 'dark');
  assert.equal(doc.querySelector('[name=win]').value, '42');
  assert.equal(w.localStorage.getItem('river.theme'), 'dark');
  doc.querySelector('[data-action=about]').click();
  assert.equal(doc.querySelector('dialog').open, true);
  doc.querySelector('.close-dialog').click();
  assert.equal(doc.querySelector('dialog').open, false);
  dom.window.close();
  const failed = await boot({ fail: true });
  assert.ok(failed.doc.querySelector('.load-error'));
  failed.w.fetch = async () => ({ ok: true, json: async () => data });
  failed.doc.querySelector('#retry').click(); await pause();
  assert.ok(failed.doc.querySelector('#answer-form'));
  failed.dom.window.close();
});

test('install help remains available after spot loading fails', async () => {
  const { dom, w, doc } = await boot({ fail: true });
  const errors = [];
  w.addEventListener('error', e => { errors.push(e.message); e.preventDefault(); });
  try {
    doc.querySelector('[data-action=about]').click();
    assert.deepEqual(errors, []);
    assert.equal(doc.querySelector('dialog').open, true);
    assert.match(doc.querySelector('.offline-message').textContent, /first successful load/);
    doc.querySelector('.close-dialog').click();
    assert.ok(doc.querySelector('#retry'));
  } finally { dom.window.close(); }
});

test('repeated retry clicks cannot replace a recovered screen with a stale failure', async () => {
  const { dom, w, doc } = await boot({ hash: 'outs', mode: 'estimate', fail: true });
  try {
    w.fetch = async () => { throw new Error('Still offline'); };
    doc.querySelector('#retry').click(); await pause();
    assert.equal(doc.querySelector('#retry').disabled, false);
    const requests = [];
    w.fetch = () => new Promise((resolve, reject) => requests.push({ resolve, reject }));
    const retry = doc.querySelector('#retry');
    retry.click(); retry.click();
    requests.at(-1).resolve({ ok: true, json: async () => data });
    await pause();
    assert.ok(doc.querySelector('#answer-form'));
    for (const stale of requests.slice(0, -1)) stale.reject(new Error('Earlier request failed'));
    await pause();
    assert.equal(doc.querySelector('.load-error'), null);
    assert.equal(doc.querySelector('h1').textContent, 'How often do you get there?');
  } finally { dom.window.close(); }
});

test('skip link focuses the current screen without changing route or draft', async () => {
  for (const type of ['equity', 'outs', 'pot', 'range', 'progress']) {
    const { dom, w, doc } = await boot({ hash: type, mode: 'estimate' });
    try {
      const main = doc.querySelector('#main');
      if (type !== 'progress') fill(w, 'guess', 37);
      doc.querySelector('.skip-link').focus();
      doc.querySelector('.skip-link').click(); await pause();
      assert.equal(w.location.hash, '#' + type);
      assert.equal(doc.activeElement, main);
      assert.equal(doc.querySelector('#main'), main);
      if (type !== 'progress') assert.equal(doc.querySelector('[name=guess]').value, '37');
      assert.equal(w.localStorage.getItem('river.history.v1'), null);
    } finally { dom.window.close(); }
  }
});

test('every Estimate spot reveals guess, quick math, exact and error, with persistent continuous scores', async () => {
  for (const type of ['equity', 'outs', 'pot', 'range']) {
    const { dom, w, doc } = await boot({ hash: type, mode: 'estimate' });
    for (const spot of data[type]) {
      const guess = Math.max(0, spot.estimate.exact - .5);
      fill(w, 'guess', String(guess)); submit(w);
      assert.equal(doc.querySelectorAll('.estimate-comparison > div').length, 3, spot.id);
      assert.match(doc.querySelector('.estimate-comparison').textContent, /Your guess.*Quick math.*Exact value/);
      assert.match(doc.querySelector('.math-details .rule-accuracy').textContent, /Shortcut error:.*average.*worst/);
      assert.equal(doc.activeElement.id, 'result-title');
      if (spot.estimate.unit === '%') assert.ok(doc.querySelector('.equity-fill'));
      doc.querySelector('[data-action="next"]').click();
    }
    const entries = JSON.parse(w.localStorage.getItem('river.history.v1'));
    assert.equal(entries.length, data[type].length);
    assert.ok(entries.every(e => e.mode === 'estimate' && e.score >= 96.875));
    dom.window.close();
  }
});
test('practice starts untimed; opting into the clock saves the last guess once across navigation', async () => {
  const { dom, w, doc } = await boot({ mode: null, seconds: null });
  try {
    assert.equal(w.localStorage.getItem('river.mode'), null);
    assert.equal(w.localStorage.getItem('river.seconds'), null);
    assert.equal(doc.querySelector('[data-mode=estimate]').getAttribute('aria-pressed'), 'true');
    assert.equal(doc.querySelector('#time-limit').value, '0');
    doc.querySelector('#time-limit').value = '10';
    doc.querySelector('#time-limit').dispatchEvent(new w.Event('change', { bubbles: true }));
    fill(w, 'guess', '37');
    doc.querySelector('[data-action=theme]').click();
    await navigate(w, 'outs'); await navigate(w, 'equity');
    assert.equal(doc.querySelector('[name=guess]').value, '37');
    const oldNow = w.Date.now;
    w.Date.now = () => oldNow() + 15000;
    await new Promise(resolve => setTimeout(resolve, 130));
    const entries = JSON.parse(w.localStorage.getItem('river.history.v1'));
    assert.equal(entries.length, 1); assert.equal(entries[0].guess, 37); assert.equal(entries[0].timedOut, true);
    await new Promise(resolve => setTimeout(resolve, 130));
    assert.equal(JSON.parse(w.localStorage.getItem('river.history.v1')).length, 1);
    assert.ok(doc.querySelector('.timeout-note'));
  } finally { dom.window.close(); }
});
test('empty and invalid expired estimates score zero; Classic drafts stay independent', async () => {
  const { dom, w, doc } = await boot({ mode: 'estimate', seconds: 10 });
  try {
    doc.querySelector('[data-mode=classic]').click(); fill(w, 'win', 42);
    doc.querySelector('[data-mode=estimate]').click();
    assert.equal(doc.querySelector('[name=guess]').value, '');
    const oldNow = w.Date.now; w.Date.now = () => oldNow() + 15000;
    await new Promise(resolve => setTimeout(resolve, 130));
    const [entry] = JSON.parse(w.localStorage.getItem('river.history.v1'));
    assert.equal(entry.guess, null); assert.equal(entry.score, 0);
    assert.match(doc.querySelector('#result-title').textContent, /Time/);
    doc.querySelector('[data-mode=classic]').click(); assert.equal(doc.querySelector('[name=win]').value, '42');
  } finally { dom.window.close(); }
});
test('weakest rule and per-rule trends lead to the requested estimate practice', async () => {
  const e = data.outs[0].estimate;
  const entries = Array.from({ length: 3 }, (_, i) => ({ type: 'outs', topic: 'Flop flush draws', id: 'o-flush', at: i, mode: 'estimate', rule: e.rule, unit: '%', exact: e.exact, quick: e.quick, guess: 0, score: 100 - e.exact, error: e.exact, normalizedError: e.exact, correct: false, timedOut: false }));
  const { dom, w, doc } = await boot({ hash: 'progress', entries, mode: 'estimate' });
  try {
    assert.match(doc.querySelector('.weak-rule').textContent, /Rule of 4/);
    assert.equal(doc.querySelectorAll('.rule-row').length, Object.keys(data.rules).length);
    assert.ok(doc.querySelector('.rule-row .sparkline'));
    doc.querySelector('.weak-rule').click(); await pause();
    assert.match(doc.querySelector('.filter-label').textContent, /Rule of 4/);
    assert.ok(doc.querySelector('[name=guess]'));
    fill(w, 'guess', 36); submit(w);
    assert.match(doc.querySelector('.worked-example .mental-rule + math').textContent, /×4≈/);
  } finally { dom.window.close(); }
});

test('timer budgets can be extended or removed and returning to an expired spot grades it', async () => {
  const { dom, w, doc } = await boot({ mode: 'estimate', seconds: 10 });
  try {
    assert.equal(doc.querySelector('#countdown').textContent, '10s');
    fill(w, 'guess', '101'); submit(w);
    assert.match(doc.querySelector('#form-error').textContent, /0 to 100/);
    assert.equal(w.localStorage.getItem('river.history.v1'), null);
    const setLimit = value => { const field = doc.querySelector('#time-limit'); field.value = value; field.dispatchEvent(new w.Event('change', { bubbles: true })); };
    setLimit('20'); assert.equal(doc.querySelector('#countdown').textContent, '20s');
    setLimit('0'); assert.equal(doc.querySelector('#countdown').textContent, '∞');
    const oldNow = w.Date.now; let advance = 60000; w.Date.now = () => oldNow() + advance;
    await new Promise(resolve => setTimeout(resolve, 130));
    assert.ok(doc.querySelector('#answer-form'));
    setLimit('10'); fill(w, 'guess', '40');
    await navigate(w, 'progress'); advance += 15000;
    await navigate(w, 'equity');
    assert.ok(doc.querySelector('.timeout-note'));
    const [entry] = JSON.parse(w.localStorage.getItem('river.history.v1'));
    assert.equal(entry.guess, 40); assert.equal(entry.timedOut, true);
  } finally { dom.window.close(); }
});

test('changing the shared time limit updates every open Estimate draft', async () => {
  const { dom, w, doc } = await boot({ mode: 'estimate', seconds: 10 });
  const guesses = { equity: 37, outs: 35, pot: 25, range: 50 };
  let now = w.Date.now();
  w.Date.now = () => now;
  const setLimit = value => { const field = doc.querySelector('#time-limit'); field.value = value; field.dispatchEvent(new w.Event('change', { bubbles: true })); };
  try {
    for (const [type, guess] of Object.entries(guesses)) { await navigate(w, type); fill(w, 'guess', guess); }
    setLimit('0'); now += 60000;
    for (const [type, guess] of Object.entries(guesses)) {
      await navigate(w, type);
      assert.ok(doc.querySelector('#answer-form'), `${type} must remain untimed`);
      assert.equal(doc.querySelector('[name=guess]').value, String(guess));
      assert.equal(doc.querySelector('#countdown').textContent, '∞');
    }
    setLimit('20'); now += 19000;
    for (const type of Object.keys(guesses)) {
      await navigate(w, type);
      assert.ok(doc.querySelector('#answer-form'), `${type} gets the new budget`);
      assert.equal(doc.querySelector('#time-limit').value, '20');
      assert.equal(doc.querySelector('#countdown').textContent, '1s');
    }
    now += 2000;
    for (const type of Object.keys(guesses)) { await navigate(w, type); assert.ok(doc.querySelector('.timeout-note')); }
    const entries = JSON.parse(w.localStorage.getItem('river.history.v1'));
    assert.equal(entries.length, 4);
    assert.ok(entries.every(e => e.timedOut && e.guess === guesses[e.type]));
  } finally { dom.window.close(); }
});

test('malformed spot data fails closed without enabling navigation and can recover', async () => {
  const { dom, w, doc } = await boot({ mode: 'estimate', payload: { version: 1 } });
  try {
    assert.ok(doc.querySelector('.load-error'));
    await navigate(w, 'outs');
    assert.ok(doc.querySelector('.load-error'));
    w.fetch = async () => ({ ok: true, json: async () => data });
    doc.querySelector('#retry').click(); await pause();
    assert.ok(doc.querySelector('#answer-form'));
    assert.equal(doc.querySelector('h1').textContent, 'How often do you get there?');
    assert.equal(doc.querySelector('.drill-tabs [aria-current=page]').textContent, 'Outs & odds');
  } finally { dom.window.close(); }
});

test('range Estimate practice covers made, draw and air with matching exact targets', async () => {
  const { dom, w, doc } = await boot({ hash: 'range', mode: 'estimate' });
  const practiced = new Set();
  try {
    for (const spot of data.range.filter(s => !s.comboRule)) {
      const e = spot.estimate;
      practiced.add(e.category);
      assert.equal(e.exact, spot.result.fractions[e.category]);
      assert.match(doc.querySelector('.answer-field').textContent, new RegExp(e.label));
      fill(w, 'guess', e.exact); submit(w);
      assert.match(doc.querySelector('.estimate-score').textContent, /100.00/);
      doc.querySelector('[data-action=next]').click();
    }
    assert.deepEqual([...practiced].sort(), ['air', 'draw', 'made']);
  } finally { dom.window.close(); }
});
test('Classic weak-topic practice selects and persists Classic from Estimate mode', async () => {
  const entries = Array.from({ length: 3 }, (_, i) => ({ type: 'outs', topic: 'Flop flush draws', id: 'o-flush', at: i, score: 0, error: 35, correct: false }));
  const { dom, w, doc } = await boot({ hash: 'progress', mode: 'estimate', entries });
  try {
    doc.querySelector('[data-weak-type]').click(); await pause();
    assert.equal(w.localStorage.getItem('river.mode'), 'classic');
    assert.ok(doc.querySelector('[name=outs]')); assert.ok(doc.querySelector('[name=chance]'));
    assert.equal(doc.querySelector('[name=guess]'), null);
  } finally { dom.window.close(); }
});
test('focused practice and clearing focus keep both modes on the matching set of spots', async () => {
  const { dom, w, doc } = await boot();
  const topic = () => doc.querySelector('.table-toolbar > span:first-child').textContent;
  const hero = () => [...doc.querySelectorAll('.hero-hand .playing-card')].map(c => c.getAttribute('aria-label'));
  try {
    fill(w, 'win', data.equity[0].result.win); submit(w);
    await navigate(w, 'progress');
    doc.querySelector('[data-rule=overcards-pair]').click(); await pause();
    const focused = data.equity.find(s => s.estimate.rule === 'overcards-pair');
    assert.equal(topic(), focused.topic);
    const focusedHand = hero();
    doc.querySelector('[data-mode=classic]').click();
    assert.equal(topic(), focused.topic);
    assert.deepEqual(hero(), focusedHand);
    assert.ok(doc.querySelector('[name=win]'));
    doc.querySelector('[data-action=clear-filter]').click();
    assert.equal(topic(), data.equity[1].topic);
    const unfilteredHand = hero();
    assert.notDeepEqual(unfilteredHand, focusedHand);
    doc.querySelector('[data-mode=estimate]').click();
    assert.equal(topic(), data.equity[1].topic);
    assert.deepEqual(hero(), unfilteredHand);
    assert.equal(doc.querySelector('.filter-label'), null);
    assert.equal(JSON.parse(w.localStorage.getItem('river.history.v1')).length, 1);
  } finally { dom.window.close(); }
});
test('progress drill links open and persist the mode named by their section', async () => {
  const { dom, w, doc } = await boot({ mode: 'estimate' });
  try {
    fill(w, 'guess', 40); submit(w);
    await navigate(w, 'progress');
    doc.querySelector('.progress-rows [href="#outs"]').click(); await pause();
    assert.ok(doc.querySelector('[name=outs]'));
    assert.equal(w.localStorage.getItem('river.mode'), 'classic');
    await navigate(w, 'progress');
    doc.querySelector('.estimate-progress [href="#range"]').click(); await pause();
    assert.ok(doc.querySelector('[name=guess]'));
    assert.equal(w.localStorage.getItem('river.mode'), 'estimate');
  } finally { dom.window.close(); }
});
test('Classic can traverse every spot while focused on an estimation rule', async () => {
  const { dom, w, doc } = await boot({ hash: 'pot' });
  try {
    fill(w, 'choice', data.pot[0].result.choice); submit(w);
    await navigate(w, 'progress');
    doc.querySelector('[data-rule=equity-outs]').click(); await pause();
    doc.querySelector('[data-mode=classic]').click();
    for (const spot of data.equity.filter(s => s.estimate.rule === 'equity-outs')) {
      fill(w, 'win', spot.result.win); submit(w);
      const entries = JSON.parse(w.localStorage.getItem('river.history.v1'));
      assert.equal(entries.at(-1).id, spot.id);
      assert.equal(entries.at(-1).correct, true);
      doc.querySelector('[data-action=next]').click();
    }
  } finally { dom.window.close(); }
});
test('changing Reduce Motion cancels transform travel, finishes the pot count and preserves the draft', async () => {
  const { dom, w, doc } = await boot({ hash: 'pot', mode: 'estimate' });
  let cancelled = false, fadeCancelled = false;
  try {
    fill(w, 'guess', 25);
    doc.getAnimations = () => [
      { effect: { getKeyframes: () => [{ transform: 'translateX(50px)', opacity: 0 }] }, cancel: () => { cancelled = true; } },
      { effect: { getKeyframes: () => [{ opacity: 0 }] }, cancel: () => { fadeCancelled = true; } },
    ];
    w.motionPreference.matches = true; w.changeMotion();
    await new Promise(resolve => setTimeout(resolve, 40));
    assert.equal(cancelled, true); assert.equal(fadeCancelled, false);
    assert.equal(doc.querySelector('.pot-counter').textContent, '$150');
    assert.equal(doc.querySelector('[name=guess]').value, '25');
  } finally { dom.window.close(); }
});
test('Classic streaks celebrate and an earlier result keeps its own earned streak', async () => {
  const { dom, w, doc } = await boot({ hash: 'equity' });
  try {
    for (let i = 0; i < 3; i++) {
      for (const [name, value] of Object.entries(answerFor('equity', data.equity[i]))) fill(w, name, value);
      submit(w);
      if (i < 2) doc.querySelector('[data-action=next]').click();
    }
    assert.match(doc.querySelector('.streak').textContent, /3 correct answers/);
    await navigate(w, 'outs');
    fill(w, 'outs', 0); fill(w, 'chance', 0); submit(w);
    assert.equal(doc.querySelector('.streak'), null);
    await navigate(w, 'equity');
    assert.match(doc.querySelector('.streak').textContent, /3 correct answers/);
  } finally { dom.window.close(); }
});
