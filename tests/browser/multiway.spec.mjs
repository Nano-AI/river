import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('hidden multiway table is readable, grades a rough estimate, and preserves hidden ranges', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#time-limit')).toHaveValue('0');
  await page.getByLabel('Table format').selectOption('multiway');
  await expect(page.locator('.opponent-seat')).toHaveCount(3);
  await expect(page.getByRole('img', { name: 'Hidden card', exact: true })).toHaveCount(6);
  await expect(page.locator('.opponent-seats')).toContainText('Range: KQ');
  const input = page.getByRole('spinbutton', { name: /Your pot-share equity/ });
  await input.fill('25');
  await expect(page.getByLabel('Adjust your estimate')).toHaveValue('25');
  await page.getByLabel('Adjust your estimate').focus();
  await page.keyboard.press('ArrowRight');
  await expect(input).toHaveValue('26');
  await page.getByRole('button', { name: 'Reveal estimate' }).click();
  await expect(page.locator('.accepted-range')).toBeVisible();
  await expect(page.locator('.worked-steps')).toBeVisible();
  await expect(page.locator('.worked-example mfrac')).toBeVisible();
  await expect(page.locator('.hero-hand .hand-label')).toContainText('Flush draw (4/5 ♠)');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  await expect(page.getByRole('img', { name: 'Hidden card', exact: true })).toHaveCount(6);
  await page.getByRole('button', { name: 'Next spot' }).click();
  await expect(page.locator('.opponent-seat')).toHaveCount(3);
  for (const theme of ['light', 'dark']) {
    if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('Classic shows precise and whole-number grace limits for the pictured set', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Classic', exact: true }).click();
  await page.getByLabel('Table format').selectOption('multiway');
  await page.getByRole('spinbutton', { name: /Your estimate/ }).fill('27');
  await page.getByRole('button', { name: 'Check answer' }).click();
  await page.getByRole('button', { name: 'Next spot' }).click();
  await expect(page.locator('.hero-hand .hand-label')).toContainText('Three of a kind');
  await page.getByRole('spinbutton', { name: /Your estimate/ }).fill('75');
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.locator('#result-title')).toHaveText('5.92 points away.');
  await expect(page.locator('.accepted-range')).toContainText('75.93%–85.92%');
  await expect(page.locator('.accepted-range')).toContainText('76–85%');
  await expect(page.locator('.worked-example mfrac')).toBeVisible();
  await page.getByText('Show the math', { exact: false }).click();
  await expect(page.locator('.math-content')).toContainText('52 cards. Best five cards win. No duplicates.');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([]);
  for (const width of [320, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('390px table keeps the estimate action above the bottom navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByLabel('Table format').selectOption('multiway');
  const action = await page.getByRole('button', { name: 'Reveal estimate' }).boundingBox();
  const navigation = await page.getByRole('navigation', { name: 'Choose a drill' }).boundingBox();
  expect(action.y + action.height).toBeLessThanOrEqual(navigation.y);
  for (const width of [320, 360, 430]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
