import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const data = JSON.parse(await readFile('public/spots.json', 'utf8'));
test('/poker/ precaches both modes, lessons and assets and reopens offline', async ({ page, context }) => {
  await page.goto('./');
  await expect(page.locator('#offline-status')).toHaveText('Ready offline');
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(new URL(scope).pathname).toBe('/poker/');
  const manifest = await page.evaluate(async () => (await fetch('./manifest.webmanifest')).json());
  expect(new URL(manifest.start_url, page.url()).pathname).toBe('/poker/');
  await page.locator('#time-limit').selectOption('0');
  await page.close();
  await context.setOffline(true);
  const offline = await context.newPage();
  await offline.goto('./');
  for (const type of ['equity', 'outs', 'pot', 'range']) {
    await offline.goto('./#' + type);
    await offline.locator('[name=guess]').fill(String(data[type][0].estimate.exact));
    await offline.getByRole('button', { name: 'Reveal estimate' }).click();
    await expect(offline.locator('.estimate-score')).toContainText('100.00');
  }
  for (const type of ['equity', 'outs', 'pot', 'range']) {
    await offline.goto('./#' + type);
    await offline.getByRole('button', { name: 'Classic', exact: true }).click();
    const r = data[type][1].result;
    if (type === 'equity') await offline.locator('[name=win]').fill(r.win.toFixed(1));
    if (type === 'outs') {
      await offline.locator('[name=outs]').fill(String(r.count));
      await offline.locator('[name=chance]').fill(r.chance.toFixed(1));
    }
    if (type === 'pot') await offline.getByLabel(r.choice === 'call' ? 'Call' : 'Fold', { exact: true }).check();
    if (type === 'range') {
      const made = Math.round(r.fractions.made), draw = Math.round(r.fractions.draw);
      for (const [name, value] of Object.entries({ made, draw, air: 100 - made - draw })) await offline.locator(`[name=${name}]`).fill(String(value));
    }
    await offline.getByRole('button', { name: 'Check answer' }).click();
    await expect(offline.locator('#result-title')).toHaveText('Nice read.');
  }
  await offline.getByRole('link', { name: 'Progress', exact: true }).click();
  await offline.locator('.rule-library summary').click();
  await expect(offline.locator('.rule-row')).toHaveCount(Object.keys(data.rules).length);
  await offline.reload();
  await expect(offline.locator('.estimate-progress')).toBeVisible();
  const history = await offline.evaluate(() => JSON.parse(localStorage.getItem('river.history.v1')));
  expect(history).toHaveLength(8);
  expect(history.filter(e => e.mode === 'estimate')).toHaveLength(4);
});
