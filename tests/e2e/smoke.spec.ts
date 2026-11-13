import { expect, test } from '@playwright/test';
import { collectErrors, startGame, waitForFrames } from './helpers';

test('boots to title without console errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'title');
  await expect(page.getByText('Cliquer pour commencer')).toBeVisible();
  await waitForFrames(page);
  expect(errors.console).toEqual([]);
  expect(errors.page).toEqual([]);
});

test('click starts the game', async ({ page }) => {
  const errors = collectErrors(page);
  await startGame(page);
  const before = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.frame);
  await waitForFrames(page, 5);
  const after = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.frame);
  expect(after).toBeGreaterThan(before);
  await expect(page.getByText('Cliquer pour commencer')).toBeHidden();
  expect(errors.console).toEqual([]);
  expect(errors.page).toEqual([]);
});

test('advance() steps simulated time', async ({ page }) => {
  await startGame(page);
  const delta = await page.evaluate(() => {
    const before = window.__THREE_GAME_DIAGNOSTICS__!.elapsed;
    window.__THREE_GAME_TEST_HOOKS__!.advance(2);
    return window.__THREE_GAME_DIAGNOSTICS__!.elapsed - before;
  });
  expect(delta).toBeGreaterThan(1.98);
  expect(delta).toBeLessThan(2.02);
});

test('simulation does not run on the title screen', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'title');
  await waitForFrames(page, 10);
  expect(await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.elapsed)).toBe(0);
});

test('resize keeps aspect', async ({ page }) => {
  await startGame(page);
  for (const [width, height] of [
    [2560, 1080],
    [800, 600],
  ]) {
    await page.setViewportSize({ width, height });
    await expect
      .poll(async () =>
        page.evaluate(() => {
          const c = window.__THREE_GAME_DIAGNOSTICS__!.canvas;
          return c.width / c.height;
        }),
      )
      .toBeCloseTo(width / height, 2);
  }
});

test('real-time loop advances simulated time at about wall-clock speed', async ({ page }) => {
  await startGame(page);
  const start = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.elapsed);
  await page.waitForTimeout(1000);
  const gained = (await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.elapsed)) - start;
  expect(gained).toBeGreaterThan(0.7);
  expect(gained).toBeLessThan(1.3);
});
