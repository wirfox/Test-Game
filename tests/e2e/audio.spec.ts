import { expect, test, type Page } from '@playwright/test';
import { collectErrors, startGame } from './helpers';

const audio = (page: Page) => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.audio);

test('no sound and no audio context before the first click', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'title');
  await page.waitForTimeout(500);
  const a = await audio(page);
  expect(a.contextState).not.toBe('running');
  expect(a.played).toEqual({});
  expect(errors.console).toEqual([]);
  expect(errors.page).toEqual([]);
});

test('the click on the title screen starts the audio', async ({ page }) => {
  const errors = collectErrors(page);
  await startGame(page);
  await expect.poll(async () => (await audio(page)).contextState).toBe('running');
  expect(errors.console).toEqual([]);
  expect(errors.page).toEqual([]);
});

test('walking plays footsteps', async ({ page }) => {
  await startGame(page);
  await expect.poll(async () => (await audio(page)).contextState).toBe('running');
  await page.keyboard.down('KeyW');
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.advance(3));
  const played = (await audio(page)).played;
  expect(played.footstep).toBeGreaterThanOrEqual(4);
});

test('pausing suspends the audio and resuming restarts it', async ({ page }) => {
  await startGame(page);
  await expect.poll(async () => (await audio(page)).contextState).toBe('running');
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'paused');
  await expect.poll(async () => (await audio(page)).contextState).toBe('suspended');
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('playing'));
  await expect.poll(async () => (await audio(page)).contextState).toBe('running');
});
