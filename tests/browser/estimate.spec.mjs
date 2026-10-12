import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
const data = JSON.parse(await readFile('public/spots.json', 'utf8'));
test.beforeEach(async ({ context }) => context.addInitScript(() => { localStorage.setItem('river.mode', 'estimate'); localStorage.setItem('river.seconds', '0'); }));
for (const type of ['equity', 'outs', 'pot', 'range']) test(`Estimate ${type}: comparison, score, keyboard, theme and accessible layout`, async ({ page }) => {
  await page.goto('/#' + type);
  for (const [index, spot] of data[type].entries()) {
    await page.locator('[name=guess]').fill(String(spot.estimate.exact));
    await page.keyboard.press('Enter');
    await expect(page.locator('.estimate-score')).toContainText('100.00');
    await expect(page.locator('.estimate-comparison > div')).toHaveCount(3);
    await expect(page.locator('.marker-guess')).toHaveCount(spot.estimate.unit === '%' ? 1 : 0);
    if (index < data[type].length - 1) await page.getByRole('button', { name: 'Next spot' }).click();
  }
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('button', { name: 'Next spot' }).click();
  await expect(page.locator('#answer-form')).toBeVisible();
});
test('deadline expires once, saves a draft, and exposes untimed accessibility option', async ({ page }) => {
  await page.clock.install();
  await page.goto('/#outs');
  await page.locator('#time-limit').selectOption('10');
  await page.locator('[name=guess]').fill('35');
  await page.clock.runFor(10020);
  await expect(page.locator('.timeout-note')).toContainText('Time’s up');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('river.history.v1')).length)).toBe(1);
  await page.clock.runFor(10020);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('river.history.v1')).length)).toBe(1);
  await page.getByRole('button', { name: 'Next spot' }).click();
  await page.getByRole('link', { name: 'Equity', exact: true }).click();
  await expect(page.locator('#answer-form')).toBeVisible();
  await page.getByRole('link', { name: 'Outs & odds', exact: true }).click();
  await page.locator('#time-limit').selectOption('0');
  await page.clock.runFor(100000);
  await expect(page.locator('#answer-form')).toBeVisible();
  await page.getByRole('link', { name: 'Equity', exact: true }).click();
  await expect(page.locator('#answer-form')).toBeVisible();
  await expect(page.locator('#countdown')).toHaveText('∞');
});
test('focused heatmap celebrates a correct guess and respects reduced motion', async ({ page }) => {
  await page.goto('/');
  await page.locator('[name=guess]').fill(String(data.equity[0].estimate.exact));
  await page.getByRole('button', { name: 'Reveal estimate' }).click();
  await expect(page.locator('#result-title')).toHaveText('Spot on!');
  await expect(page.locator('.equity-heatmap')).toHaveAttribute('data-min', '30');
  await expect(page.locator('.equity-heatmap')).toHaveAttribute('data-max', '65');
  expect(await page.locator('.equity-fill').evaluate(el => getComputedStyle(el).backgroundImage)).toContain('linear-gradient');
  expect(await page.locator('.heatmap-hit').evaluate(el => getComputedStyle(el, '::before').animationName)).toBe('target-ring');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.locator('.heatmap-hit').evaluate(el => getComputedStyle(el).display)).toBe('none');
  expect(await page.locator('.marker-guess').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
});
test('draw derivations show card faces and combinations without phone overflow', async ({ page }) => {
  await page.goto('/#outs');
  await page.locator('[name=guess]').fill(String(data.outs[0].estimate.exact));
  await page.getByRole('button', { name: 'Reveal estimate' }).click();
  await expect(page.locator('.outs-set .mini-card')).toHaveCount(9);
  await expect(page.locator('.draw-derivation mfrac[linethickness="0"]')).toHaveCount(2);
  await expect(page.locator('.outs-set [data-card^="T"]')).toHaveText('10♥');
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
});
test('deal, flip, sequential streets, chips, distinct reveals, bar and streak use real browser animations', async ({ page }) => {
  await page.goto('/#equity');
  await page.locator('.fresh .card-flipper').first().waitFor();
  const animationNames = await page.evaluate(() => document.getAnimations().map(a => a.animationName).filter(Boolean));
  expect(animationNames).toContain('card-flip');
  const delays = await page.locator('.board-cards .card-flipper').evaluateAll(els => els.map(el => parseFloat(getComputedStyle(el).animationDelay)));
  expect(delays[1]).toBeGreaterThan(delays[0]); expect(delays[2]).toBeGreaterThan(delays[1]);
  await page.locator('[name=guess]').fill(String(data.equity[0].estimate.exact));
  await page.getByRole('button', { name: 'Reveal estimate' }).click();
  expect(await page.locator('.result-mark').evaluate(el => getComputedStyle(el).animationName)).toBe('correct-pop');
  expect(await page.locator('.equity-fill').evaluate(el => getComputedStyle(el).animationName)).toBe('equity-fill');
  for (let i = 1; i <= 2; i++) {
    await page.getByRole('button', { name: 'Next spot' }).click();
    await page.locator('[name=guess]').fill(String(data.equity[i].estimate.exact));
    await page.getByRole('button', { name: 'Reveal estimate' }).click();
  }
  await expect(page.locator('.streak')).toContainText('3 close reads');
  await page.getByRole('button', { name: 'Next spot' }).click();
  await page.locator('[name=guess]').fill('0'); await page.getByRole('button', { name: 'Reveal estimate' }).click();
  expect(await page.locator('.result-mark').evaluate(el => getComputedStyle(el).animationName)).toBe('reconsider');
  await page.getByRole('link', { name: 'Pot odds', exact: true }).click();
  expect(await page.locator('.chip-stack svg').first().evaluate(el => getComputedStyle(el).animationName)).toBe('chip-slide');
  await expect(page.locator('.pot-counter')).toHaveText('$150');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('link', { name: 'Range reading', exact: true }).click();
  expect(await page.locator('.playing-card').first().evaluate(el => getComputedStyle(el).animationName)).toBe('calm-fade');
  expect(await page.locator('.card-flipper').first().evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  expect(await page.evaluate(() => document.getAnimations().every(a => a.effect.getKeyframes().every(f => !('transform' in f))))).toBe(true);
});
test('phone animation has no sustained main-thread frame stalls', async ({ page }) => {
  await page.goto('/');
  await page.locator('.fresh .card-flipper').first().waitFor();
  const deltas = await page.evaluate(() => new Promise(resolve => {
    const values = []; let previous = performance.now(), start = previous;
    function frame(now) { values.push(now - previous); previous = now; if (now - start < 1600) requestAnimationFrame(frame); else resolve(values.slice(1)); }
    requestAnimationFrame(frame);
  }));
  expect(deltas.filter(t => t > 34).length / deltas.length).toBeLessThan(.1);
});

test('switching Reduce Motion during a deal cancels active travel and keeps the answer', async ({ page }) => {
  await page.goto('/#equity');
  await page.locator('[name=guess]').fill('40');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => page.evaluate(() => document.getAnimations().some(a => a.effect.getKeyframes().some(frame => 'transform' in frame)))).toBe(false);
  await expect(page.locator('[name=guess]')).toHaveValue('40');
});
