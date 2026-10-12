export const TYPES = ['equity', 'outs', 'pot', 'range'];
export const HISTORY_KEY = 'river.history.v1';

export function grade(type, answer, result) {
  if (!TYPES.includes(type)) throw new Error('Unknown drill.');
  if (type === 'pot') {
    if (!['call', 'fold'].includes(answer.choice)) throw new Error('Choose call or fold.');
    const correct = answer.choice === result.choice;
    return { correct, score: correct ? 100 : 0, error: null };
  }
  const percent = value => Number.isFinite(value) && value >= 0 && value <= 100;
  if (type === 'equity') {
    if (!percent(answer.win)) throw new Error('Enter a percentage from 0 to 100.');
    const error = Math.abs(answer.win - result.win);
    return { correct: error <= 5, score: Math.max(0, 100 - error), error };
  }
  if (type === 'outs') {
    if (!Number.isInteger(answer.outs) || answer.outs < 0 || answer.outs > 46 || !percent(answer.chance)) throw new Error('Enter an out count and a percentage.');
    const error = Math.abs(answer.chance - result.chance);
    return { correct: answer.outs === result.count && error <= 5, score: ((answer.outs === result.count ? 100 : 0) + Math.max(0, 100 - error)) / 2, error };
  }
  if (!['made', 'draw', 'air'].every(k => percent(answer[k])) || Math.abs(answer.made + answer.draw + answer.air - 100) > 0.011) throw new Error('The three percentages must add up to 100.');
  const errors = ['made', 'draw', 'air'].map(k => Math.abs(answer[k] - result.fractions[k]));
  const error = errors.reduce((a, b) => a + b) / 3;
  return { correct: errors.every(e => e <= 5), score: 100 - error, error };
}

export function readHistory(storage) {
  try {
    const raw = storage.getItem(HISTORY_KEY);
    if (!raw) return { entries: [], available: true };
    const entries = JSON.parse(raw);
    if (!Array.isArray(entries) || entries.some(e => !e || !TYPES.includes(e.type) || typeof e.topic !== 'string' || typeof e.id !== 'string' || !Number.isFinite(e.at) || !Number.isFinite(e.score) || e.score < 0 || e.score > 100 || typeof e.correct !== 'boolean' || !(e.error === null || Number.isFinite(e.error)))) throw new Error('Invalid history.');
    if (entries.some(e => e.mode !== undefined && (e.mode !== 'estimate' || typeof e.rule !== 'string' || !['%', '$', 'combos'].includes(e.unit) || !Number.isFinite(e.normalizedError) || typeof e.timedOut !== 'boolean'))) throw new Error('Invalid estimate history.');
    return { entries, available: true };
  } catch {
    return { entries: [], available: false };
  }
}
export function saveHistory(storage, entries) {
  try { storage.setItem(HISTORY_KEY, JSON.stringify(entries)); return true; } catch { return false; }
}
export function summarize(entries) {
  const total = entries.length;
  const correct = entries.filter(e => e.correct).length;
  const errors = entries.map(e => e.error).filter(e => e !== null);
  return { total, correct, accuracy: total ? 100 * correct / total : null, meanError: errors.length ? errors.reduce((a, b) => a + b) / errors.length : null };
}
export function weakSpots(entries) {
  const topics = new Map();
  for (const entry of entries) {
    const key = entry.type + ':' + entry.topic;
    if (!topics.has(key)) topics.set(key, { type: entry.type, topic: entry.topic, entries: [] });
    topics.get(key).entries.push(entry);
  }
  return [...topics.values()].map(t => ({ type: t.type, topic: t.topic, ...summarize(t.entries) })).filter(t => t.total >= 3 && t.accuracy < 80).sort((a, b) => a.accuracy - b.accuracy || b.total - a.total);
}

export function gradeEstimate(answer, estimate, timedOut = false) {
  const max = estimate.unit === '%' ? 100 : 1000000;
  const valid = Number.isFinite(answer) && answer >= 0 && answer <= max;
  if (!valid && !timedOut) throw new Error(`Enter a number from 0 to ${max}.`);
  const error = valid ? Math.abs(answer - estimate.exact) : null;
  const normalizedError = valid ? Math.min(100, 100 * error / estimate.scale) : 100;
  const withinGrace = valid && error <= (estimate.tolerance ?? 0);
  return { mode: 'estimate', rule: estimate.rule, guess: valid ? answer : null, exact: estimate.exact, quick: estimate.quick,
    unit: estimate.unit, error, normalizedError, score: withinGrace ? 100 : 100 - normalizedError, correct: valid && normalizedError <= 5, timedOut };
}
export function estimateStats(entries) {
  const attempts = entries.filter(e => e.mode === 'estimate');
  return { total: attempts.length, score: attempts.length ? attempts.reduce((n, e) => n + e.score, 0) / attempts.length : null,
    meanError: attempts.some(e => e.error !== null) ? attempts.filter(e => e.error !== null).reduce((n, e) => n + e.error, 0) / attempts.filter(e => e.error !== null).length : null };
}
export function ruleStats(entries) {
  const rules = new Map();
  for (const e of entries.filter(e => e.mode === 'estimate')) {
    if (!rules.has(e.rule)) rules.set(e.rule, []);
    rules.get(e.rule).push(e);
  }
  return [...rules].map(([rule, entries]) => ({ rule, type: entries[0].type, unit: entries[0].unit, entries, ...estimateStats(entries) })).sort((a, b) => a.score - b.score || b.total - a.total);
}
