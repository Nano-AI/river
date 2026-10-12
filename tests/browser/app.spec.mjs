import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
const data = JSON.parse(await readFile(new URL('../../public/spots.json', import.meta.url), 'utf8'));
test.beforeEach(async ({ context }) => { await context.addInitScript(() => localStorage.setItem('river.mode', 'classic')); });
const entry = { type: 'equity', topic: 'Flush draws', id: 'e-flush', at: 1760000000000, score: 50, error: 50, correct: false };
async function checkLayout(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const issues = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(issues.violations).toEqual([]);
}
async function answer(page, type, s) {
  const r = s.result;
  if (type === 'equity') await page.locator('[name=win]').fill(r.win.toFixed(1));
  if (type === 'outs') { await page.locator('[name=outs]').fill(String(r.count)); await page.locator('[name=chance]').fill(r.chance.toFixed(1)); }
  if (type === 'pot') await page.getByLabel(r.choice === 'call' ? 'Call' : 'Fold', { exact: true }).check();
  if (type === 'range') {
    const made = Math.round(r.fractions.made), draw = Math.round(r.fractions.draw);
    await page.locator('[name=made]').fill(String(made)); await page.locator('[name=draw]').fill(String(draw)); await page.locator('[name=air]').fill(String(100 - made - draw));
  }
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.locator('#result-title')).toHaveText('Nice read.');
}
for (const type of ['equity', 'outs', 'pot', 'range']) test(`${type}: all spots, grades, details, persistence, light/dark accessibility`, async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#' + type);
  await expect(page.locator('#answer-form')).toBeVisible();
  await checkLayout(page);
  for (const s of data[type]) {
    await answer(page, type, s);
    await page.getByText('Show the math', { exact: false }).click();
    await expect(page.locator('.math-content')).toBeVisible();
    await page.getByRole('button', { name: 'Next spot' }).click();
  }
  await page.getByRole('button', { name: /Switch to dark mode/ }).click();
  await checkLayout(page);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('link', { name: 'Progress', exact: true }).click();
  await expect(page.locator('.progress-overview')).toContainText(String(data[type].length));
  await checkLayout(page);
  expect(errors).toEqual([]);
});
test('estimates validate, draft survives navigation, dialog is keyboard accessible', async ({ page }) => {
  await page.goto('/#range');
  for (const name of ['made', 'draw', 'air']) await page.locator(`[name=${name}]`).fill('50');
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.getByRole('alert')).toContainText('add up to 100');
  await page.getByRole('link', { name: 'Skip to practice' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#range$/);
  await expect(page.locator('#main')).toBeFocused();
  for (const name of ['made', 'draw', 'air']) await expect(page.locator(`[name=${name}]`)).toHaveValue('50');
  await page.getByRole('link', { name: 'Equity', exact: true }).click();
  await page.locator('[name=win]').fill('37');
  await page.getByRole('link', { name: 'Outs & odds', exact: true }).click();
  await page.getByRole('link', { name: 'Equity', exact: true }).click();
  await expect(page.locator('[name=win]')).toHaveValue('37');
  await page.getByRole('button', { name: 'About & install' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await checkLayout(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'About & install' })).toBeFocused();
});
test('failed loading keeps install help usable and retry follows the selected screen', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/spots.json', route => route.abort());
  await page.goto('/#outs');
  await expect(page.locator('.load-error')).toBeVisible();
  await page.getByRole('button', { name: 'About & install' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.locator('.offline-message')).toContainText('first successful load');
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Progress', exact: true }).click();
  await page.unroute('**/spots.json');
  await page.getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('.empty-progress')).toBeVisible();
  await expect(page).toHaveURL(/#progress$/);
  expect(errors).toEqual([]);
});
test('progress empty and populated states, weak topic retry and reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#progress');
  await expect(page.locator('.empty-progress')).toBeVisible();
  await checkLayout(page);
  await page.evaluate(e => localStorage.setItem('river.history.v1', JSON.stringify([e, e, e])), entry);
  await page.reload();
  await expect(page.locator('.weak-row')).toHaveCount(1);
  await checkLayout(page);
  await page.locator('.weak-row').click();
  await expect(page.locator('.filter-label')).toContainText('Flush draws');
  expect(await page.locator('.playing-card').first().evaluate(el => getComputedStyle(el).animationName)).toBe('calm-fade');
});
test('manifest, service worker and complete offline practice survive reload', async ({ page, context, browserName }) => {
  test.skip(browserName === 'webkit', 'Playwright WebKit has incomplete service-worker inspection support; Chromium checks the actual offline lifecycle.');
  await page.goto('/');
  await expect(page.locator('#offline-status')).toHaveText('Ready offline');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  const manifest = await page.evaluate(async () => (await fetch('./manifest.webmanifest')).json());
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons.map(i => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  await context.setOffline(true);
  await page.reload();
  await answer(page, 'equity', data.equity[0]);
  await page.getByRole('link', { name: 'Outs & odds', exact: true }).click();
  await answer(page, 'outs', data.outs[0]);
  await page.getByRole('link', { name: 'Pot odds', exact: true }).click();
  await answer(page, 'pot', data.pot[0]);
  await page.getByRole('link', { name: 'Range reading', exact: true }).click();
  await answer(page, 'range', data.range[0]);
});
test('320px portrait has no horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  for (const type of ['equity', 'outs', 'pot', 'range', 'progress']) {
    await page.goto('/#' + type);
    await expect(page.locator('#main')).toBeVisible();
    await checkLayout(page);
  }
});
