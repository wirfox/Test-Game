import { expect, test, type Page } from '@playwright/test';
import { collectErrors, startGame } from './helpers';

const diag = (page: Page) => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!);
const advance = (page: Page, seconds: number) =>
  page.evaluate((s) => window.__THREE_GAME_TEST_HOOKS__!.advance(s), seconds);
const teleport = (page: Page, x: number, z: number, yaw: number) =>
  page.evaluate(([x, z, yaw]) => window.__THREE_GAME_TEST_HOOKS__!.teleport(x, z, yaw), [x, z, yaw]);

test('after the calm, knocks come from behind the player', async ({ page }) => {
  await startGame(page);
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__!.audio.contextState === 'running');
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.seed(7));
  // From the spawn every anchor is in view, so knocks would be postponed: stand mid-room.
  await teleport(page, 0, 0, 0);
  await advance(page, 39);
  expect((await diag(page)).haunt).toMatchObject({ phase: 'calm', counts: {} });
  await advance(page, 31);
  const d = await diag(page);
  expect(d.haunt.phase).toBe('unease');
  expect(d.haunt.counts.knock).toBeGreaterThanOrEqual(1);
  expect(d.audio.played.knock).toBe(d.haunt.counts.knock);
});

test('the flashlight flickers during unease', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.seed(7));
  await teleport(page, 0, 0, 0);
  // Stepped inside the page in one call: hundreds of round trips are too slow on software rendering.
  const sawFlicker = await page.evaluate(() => {
    for (let t = 0; t < 90; t += 0.25) {
      window.__THREE_GAME_TEST_HOOKS__!.advance(0.25);
      if (window.__THREE_GAME_DIAGNOSTICS__!.flashlight.flickering) return true;
    }
    return false;
  });
  expect(sawFlicker).toBe(true);
  expect((await diag(page)).haunt.counts.flicker).toBe(1);
});

test('restoring power plays the whole finale through to the end screen', async ({ page }) => {
  const errors = collectErrors(page);
  await startGame(page);
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__!.audio.contextState === 'running');
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('finale'));
  let d = await diag(page);
  expect(d.objective.powerOn).toBe(true);
  expect(d.haunt.phase).toBe('finale');
  expect(d.haunt.counts.powerSurge).toBe(1);

  // Surge: the ceiling lamp is on, the flashlight still works, nothing is there yet.
  await advance(page, 1.0);
  d = await diag(page);
  expect(d.flashlight.on).toBe(true);
  expect(d.haunt.apparitionVisible).toBe(false);

  // Blackout: the flashlight is dead.
  await advance(page, 1.0);
  d = await diag(page);
  expect(d.haunt.counts.blackout).toBe(1);
  expect(d.flashlight.on).toBe(false);
  expect(d.haunt.apparitionVisible).toBe(false);

  // Light returns and it is standing in the doorway. Hidden in the nook, the player has not seen it.
  await advance(page, 2.0);
  d = await diag(page);
  expect(d.flashlight.on).toBe(true);
  expect(d.haunt.apparitionVisible).toBe(true);
  expect(d.haunt.counts.apparitionLunge).toBeUndefined();

  // Step out west of the partition and look at it from 4.2 m.
  await teleport(page, 1.0, 0, Math.PI);
  await advance(page, 1.0);
  d = await diag(page);
  expect(d.haunt.apparitionVisible).toBe(false);
  expect(d.haunt.counts.apparitionLunge).toBe(1);
  expect(d.haunt.counts.apparitionVanished).toBe(1);
  expect(d.audio.played.sting).toBe(1);
  expect(d.state).toBe('playing');

  await advance(page, 3.5);
  expect((await diag(page)).state).toBe('ended');
  await expect(page.getByText('Fin du prototype')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rejouer' })).toBeVisible();
  expect(errors.console).toEqual([]);
  expect(errors.page).toEqual([]);
});

test('pressing E at the fuse box starts the finale', async ({ page }) => {
  await startGame(page);
  await teleport(page, 3.2, -2.0, 0);
  await page.keyboard.press('KeyE');
  await expect.poll(async () => (await diag(page)).haunt.phase).toBe('finale');
});

test('replay reloads to the title screen', async ({ page }) => {
  await startGame(page);
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.setState('finale'));
  await advance(page, 3.6);
  await teleport(page, 1.0, 0, Math.PI);
  await advance(page, 5);
  await page.getByRole('button', { name: 'Rejouer' }).click();
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'title');
  expect((await diag(page)).elapsed).toBe(0);
});
