import { chromium } from 'playwright';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import assert from 'node:assert/strict';

const data = JSON.parse(await readFile('public/spots.json', 'utf8'));
const root = 'screenshots/animations';
await mkdir(root, { recursive: true });
const server = spawn(process.execPath, ['scripts/serve.mjs', 'dist'], { env: { ...process.env, PORT: '0', BASE_PATH: '/poker/' }, stdio: ['ignore', 'pipe', 'inherit'] });
let browser;
const inventory = [];
try {
  const [line] = await once(server.stdout, 'data');
  const url = line.toString().match(/http:\/\/127\.0\.0\.1:\d+/)[0] + '/poker/';
  browser = await chromium.launch();
  for (const reduced of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: reduced ? 'reduce' : 'no-preference', recordVideo: { dir: root, size: { width: 390, height: 844 } } });
    const page = await context.newPage();
    await context.addInitScript(() => { localStorage.setItem('river.mode', 'estimate'); localStorage.setItem('river.seconds', '0'); });
    const capture = async (name, action) => {
      await action();
      // Real elapsed time keeps CSS, Web Animations and the RAF pot counter in sync.
      const start = performance.now();
      for (const time of [0, 120, 300, 550, 900, 1500]) {
        await delay(Math.max(0, time - (performance.now() - start)));
        const elapsedMs = Math.round(performance.now() - start);
        const path = `${root}/${reduced ? 'reduced' : 'full'}-${name}-${String(time).padStart(4, '0')}.png`;
        await page.screenshot({ path, fullPage: true });
        inventory.push({ path, targetMs: time, elapsedMs, completedMs: Math.round(performance.now() - start), reduced });
      }
    };
    const start = async (type, index = 0) => {
      await page.goto(url + '#' + type);
      await page.evaluate(({ type, index }) => localStorage.setItem('river.history.v1', JSON.stringify(Array.from({ length: index }, (_, i) => ({ type, topic: 'Capture seed', id: 'seed', at: i, score: 100, error: 0, correct: true })))), { type, index });
      await page.reload();
      await page.locator('#answer-form').waitFor();
    };
    await capture('deal-flip-board-streets', () => start('equity', 10));
    await capture('chips-pot-count', () => start('pot'));
    assert.equal(await page.locator('.pot-counter').textContent(), '$' + (data.pot[0].pot + data.pot[0].bet));
    await start('equity');
    await page.locator('[name=guess]').fill(String(data.equity[0].estimate.exact));
    await capture('correct-equity-fill-markers', () => page.getByRole('button', { name: 'Reveal estimate' }).click());
    await capture('next-spot-transition', () => page.getByRole('button', { name: 'Next spot' }).click());
    await page.locator('[name=guess]').fill('0');
    await capture('incorrect-reveal', () => page.getByRole('button', { name: 'Reveal estimate' }).click());
    await start('outs');
    for (let i = 0; i < 2; i++) {
      await page.locator('[name=guess]').fill(String(data.outs[i].estimate.exact));
      await page.getByRole('button', { name: 'Reveal estimate' }).click();
      await page.getByRole('button', { name: 'Next spot' }).click();
    }
    await page.locator('[name=guess]').fill(String(data.outs[2].estimate.exact));
    await capture('streak-celebration', () => page.getByRole('button', { name: 'Reveal estimate' }).click());
    await capture('screen-transition', () => page.getByRole('link', { name: 'Progress', exact: true }).click());
    const video = page.video();
    await context.close();
    await video.saveAs(`${root}/${reduced ? 'reduced' : 'full'}-motion.webm`);
  }
  await writeFile(`${root}/inventory.json`, JSON.stringify(inventory, null, 2));
  await writeFile(`${root}/STATUS.md`, `Captured ${inventory.length} actual browser frames and two videos at /poker/. Review before declaring visual completion.\n`);
  console.log(`Captured ${inventory.length} frames and two motion videos.`);
} catch (error) {
  await writeFile(`${root}/STATUS.md`, `# Animation capture blocked\n\nNo successful capture is claimed. Browser or capture error:\n\n\`\`\`\n${error.message}\n\`\`\`\n`);
  throw error;
} finally { await browser?.close(); server.kill(); }
