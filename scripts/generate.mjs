import { estimateFor } from '../src/rules.js';
import { readFile, writeFile } from 'node:fs/promises';
import { exactEquity, exactOuts, exactRange, potOdds, parseCards, evaluate } from '../src/engine.js';
import { equitySpots, outsSpots, potSpots, rangeSpots } from '../src/scenarios.js';
export function generate() {
  const equity = equitySpots.map(s => ({ ...s, result: exactEquity(s) }));
  const outs = outsSpots.map(s => ({ ...s, result: exactOuts(s) }));
  const range = rangeSpots.map(s => ({ ...s, result: exactRange(s) }));
  const pot = potSpots.map(s => {
    const spot = equity.find(e => e.id === s.equityId);
    return { ...spot, ...s, equityResult: spot.result, result: potOdds({ ...s, result: spot.result }) };
  });
  const data = { version: 1, equity, outs, pot, range };
  for (const type of ['equity', 'outs', 'pot', 'range']) for (const spot of data[type]) {
    spot.estimate = estimateFor(type, spot);
    if (spot.hero && spot.board) {
      const visible = parseCards(`${spot.hero} ${spot.board}`);
      const drawSuit = [0, 1, 2, 3].find(suit => visible.filter(c => Math.floor(c / 13) === suit).length === 4);
      spot.handStatus = evaluate(visible).name;
      if (visible.length < 7 && drawSuit !== undefined) spot.handStatus += ` · Flush draw (4/5 ${['♣', '♦', '♥', '♠'][drawSuit]})`;
    }
  }
  return data;
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const start = performance.now();
  const data = generate();
  data.rules = JSON.parse(await readFile('public/rules.json', 'utf8'));
  await writeFile('public/spots.json', JSON.stringify(data));
  console.log(`Enumerated ${Object.values(data).filter(Array.isArray).flat().length} spots in ${((performance.now() - start) / 1000).toFixed(1)}s.`);
  for (const s of data.equity.slice(0, 4)) console.log(s.id, s.result);
}
