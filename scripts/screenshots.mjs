import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
const data = JSON.parse(await readFile('public/spots.json', 'utf8'));
const port = 4175;
const server = spawn(process.execPath, ['scripts/serve.mjs', 'dist'], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'inherit'] });
let browser;
const inventory = [];
try {
  await once(server.stdout, 'data');
  browser = await chromium.launch();
  await mkdir('screenshots', { recursive: true });
  for (const [size, viewport] of Object.entries({ phone: { width: 390, height: 844 }, laptop: { width: 1440, height: 1000 } })) {
    for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: theme, reducedMotion: 'reduce' });
      await context.addInitScript(() => localStorage.getItem('river.mode') || localStorage.setItem('river.mode', 'classic'));
      const page = await context.newPage();
      const capture = async name => {
        await page.evaluate(async () => { await document.fonts.ready; });
        const path = `screenshots/${size}-${theme}-${name}.png`;
        await page.screenshot({ path, fullPage: true, animations: 'disabled' });
        inventory.push({ path, viewport, theme });
      };
      const start = async type => {
        await page.goto(`http://127.0.0.1:${port}/#${type}`);
        await page.evaluate(() => localStorage.removeItem('river.history.v1'));
        await page.reload();
        await page.locator('#main h1').waitFor();
      };
      await start('progress'); await capture('progress-empty');
      for (const type of ['equity', 'outs', 'pot', 'range']) {
        await start(type); await capture(`${type}-question`);
        const r = data[type][0].result;
        if (type === 'equity') await page.locator('[name=win]').fill(r.win.toFixed(1));
        if (type === 'outs') { await page.locator('[name=outs]').fill(String(r.count)); await page.locator('[name=chance]').fill(r.chance.toFixed(1)); }
        if (type === 'pot') await page.locator(`[name=choice][value=${r.choice}]`).check();
        if (type === 'range') {
          const made = Math.round(r.fractions.made), draw = Math.round(r.fractions.draw);
          for (const [key, value] of Object.entries({ made, draw, air: 100 - made - draw })) await page.locator(`[name=${key}]`).fill(String(value));
        }
        await page.getByRole('button', { name: 'Check answer' }).click();
        await page.locator('#result-title').waitFor();
        await capture(`${type}-result`);
        await page.locator('.math-details summary').click();
        await capture(`${type}-math`);
      }
      for (const [type, count, name] of [['equity', 12, 'equity-range'], ['equity', 1, 'equity-preflop'], ['equity', 10, 'equity-river'], ['pot', 6, 'pot-implied'], ['outs', 1, 'outs-turn']]) {
        const entries = Array.from({ length: count }, (_, i) => ({ type, topic: data[type][i].topic, id: data[type][i].id, at: Date.now() - i * 1000, score: 100, error: 0, correct: true }));
        await page.evaluate(entries => localStorage.setItem('river.history.v1', JSON.stringify(entries)), entries);
        await page.goto(`http://127.0.0.1:${port}/#${type}`); await page.reload();
        await page.locator('#answer-form').waitFor(); await capture(name);
        if (type === 'pot') {
          await page.locator(`[name=choice][value=${data.pot[count].result.choice}]`).check();
          await page.getByRole('button', { name: 'Check answer' }).click();
          await page.locator('#result-title').waitFor(); await capture('pot-implied-result');
        }
      }
      await start('equity');
      await page.locator('[name=win]').fill('5');
      await page.getByRole('button', { name: 'Check answer' }).click();
      await page.locator('#result-title').waitFor(); await capture('incorrect-answer');
      await start('range');
      for (const key of ['made', 'draw', 'air']) await page.locator(`[name=${key}]`).fill('50');
      await page.getByRole('button', { name: 'Check answer' }).click();
      await page.locator('#form-error').filter({ hasText: '100' }).waitFor(); await capture('range-validation');
      const entries = Array.from({ length: 100 }, (_, i) => {
        const type = ['equity', 'outs', 'pot', 'range'][i % 4];
        return { type, topic: data[type][0].topic, id: data[type][0].id, at: Date.now() - (100 - i) * 3600000, score: i % 3 ? 100 : 75, error: type === 'pot' ? null : i % 3 ? 0 : 25, correct: Boolean(i % 3) };
      });
      await page.evaluate(entries => localStorage.setItem('river.history.v1', JSON.stringify(entries)), entries);
      await page.goto(`http://127.0.0.1:${port}/#progress`); await page.reload();
      await page.locator('.progress-overview').waitFor(); await capture('progress');
      await page.locator('.history-details summary').click(); await capture('progress-history');
      await page.locator('.weak-row').first().click();
      await page.locator('.filter-label').waitFor(); await capture('focused-practice');
      await page.getByRole('button', { name: 'About & install' }).click(); await capture('about');
      await page.getByRole('button', { name: 'Close about' }).click();
      await page.evaluate(() => localStorage.setItem('river.history.v1', '{broken'));
      await page.goto(`http://127.0.0.1:${port}/#equity`); await page.reload();
      await page.locator('.storage-warning').waitFor(); await capture('storage-warning');
      await page.evaluate(() => { localStorage.removeItem('river.history.v1'); localStorage.setItem('river.mode', 'estimate'); localStorage.setItem('river.seconds', '0'); });
      for (const [type, index, name] of [['equity', 0, 'estimate-equity'], ['outs', 0, 'estimate-outs'], ['pot', 0, 'estimate-pot'], ['pot', 6, 'estimate-implied'], ['range', 0, 'estimate-range'], ['range', 1, 'estimate-draw-share'], ['range', 2, 'estimate-air-share'], ['range', 12, 'estimate-combos']]) {
        await page.evaluate(({ type, index }) => localStorage.setItem('river.history.v1', JSON.stringify(Array.from({ length: index }, (_, i) => ({ type, topic: 'Capture seed', id: 'seed', at: i, score: 100, error: 0, correct: true })))), { type, index });
        await page.goto(`http://127.0.0.1:${port}/#${type}`); await page.reload();
        await page.locator('[name=guess]').waitFor(); await capture(name + '-question');
        await page.locator('[name=guess]').fill(String(data[type][index].estimate.exact));
        await page.getByRole('button', { name: 'Reveal estimate' }).click();
        await page.locator('#result-title').waitFor(); await capture(name + '-result');
      }
      await page.getByRole('link', { name: 'Progress', exact: true }).click();
      await capture('estimate-progress');
      await page.locator('.rule-library summary').click(); await capture('rule-library');
      await context.close();
      const failedContext = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: theme, reducedMotion: 'reduce', serviceWorkers: 'block' });
      const failedPage = await failedContext.newPage();
      await failedPage.route('**/spots.json', route => route.abort());
      await failedPage.goto(`http://127.0.0.1:${port}/`);
      await failedPage.locator('.load-error').waitFor();
      await failedPage.evaluate(async () => { await document.fonts.ready; });
      const failedPath = `screenshots/${size}-${theme}-load-error.png`;
      await failedPage.screenshot({ path: failedPath, fullPage: true, animations: 'disabled' });
      inventory.push({ path: failedPath, viewport, theme });
      await failedPage.getByRole('button', { name: 'About & install' }).click();
      await failedPage.getByRole('dialog').waitFor();
      const helpPath = `screenshots/${size}-${theme}-load-error-about.png`;
      await failedPage.screenshot({ path: helpPath, fullPage: true, animations: 'disabled' });
      inventory.push({ path: helpPath, viewport, theme });
      await failedContext.close();
      console.log(`Captured ${size}, ${theme}.`);
    }
  }
  await writeFile('screenshots/inventory.json', JSON.stringify(inventory, null, 2));
  console.log(`Saved ${inventory.length} screenshots. Visually review them before declaring completion.`);
} finally {
  await browser?.close();
  server.kill();
}
