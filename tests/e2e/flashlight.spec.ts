import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { collectErrors, startGame } from './helpers';

const diag = (page: Page) => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!);
const teleport = (page: Page, x: number, z: number, yaw: number) =>
  page.evaluate(([x, z, yaw]) => window.__THREE_GAME_TEST_HOOKS__!.teleport(x, z, yaw), [x, z, yaw]);

/** Mean brightness (0-255) of the central quarter of the canvas. */
async function centreBrightness(page: Page): Promise<number> {
  const png = PNG.sync.read(await page.locator('#game-canvas').screenshot());
  let sum = 0;
  let n = 0;
  for (let y = Math.floor(png.height * 0.375); y < png.height * 0.625; y += 2) {
    for (let x = Math.floor(png.width * 0.375); x < png.width * 0.625; x += 2) {
      const o = (y * png.width + x) * 4;
      sum += (png.data[o] + png.data[o + 1] + png.data[o + 2]) / 3;
      n += 1;
    }
  }
  return sum / n;
}

test('flashlight starts on and F toggles it', async ({ page }) => {
  await startGame(page);
  expect((await diag(page)).flashlight.on).toBe(true);
  await page.keyboard.press('KeyF');
  await expect.poll(async () => (await diag(page)).flashlight.on).toBe(false);
  await page.keyboard.press('KeyF');
  await expect.poll(async () => (await diag(page)).flashlight.on).toBe(true);
});

test('the beam lights the room and the room is dark without it', async ({ page }) => {
  await startGame(page);
  await page.setViewportSize({ width: 480, height: 270 });
  // Facing the shelf and east wall from 2 m away.
  await teleport(page, 1.5, 1.6, 0);
  await page.waitForTimeout(400);
  const lit = await centreBrightness(page);
  await page.keyboard.press('KeyF');
  await expect.poll(async () => (await diag(page)).flashlight.on).toBe(false);
  await page.waitForTimeout(400);
  const dark = await centreBrightness(page);
  expect(lit).toBeGreaterThan(25);
  expect(dark).toBeLessThan(6);
});

test('restores power at the fuse box with E', async ({ page }) => {
  const errors = collectErrors(page);
  await startGame(page);
  await teleport(page, 3.2, -2.0, 0);
  await expect(page.getByText('E — Rétablir le courant')).toBeVisible();
  await page.keyboard.press('KeyE');
  await expect.poll(async () => (await diag(page)).objective.powerOn).toBe(true);
  await expect(page.getByText('E — Rétablir le courant')).toBeHidden();
  expect(errors.console).toEqual([]);
  expect(errors.page).toEqual([]);
});

test('cannot reach the fuse box from behind the partition', async ({ page }) => {
  await startGame(page);
  await teleport(page, 1.0, -2.0, 0);
  await page.waitForTimeout(200);
  await expect(page.getByText('E — Rétablir le courant')).toBeHidden();
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(300);
  expect((await diag(page)).objective.powerOn).toBe(false);
});

test('no prompt when looking away from the fuse box', async ({ page }) => {
  await startGame(page);
  await teleport(page, 3.2, -2.0, Math.PI);
  await page.waitForTimeout(200);
  await expect(page.getByText('E — Rétablir le courant')).toBeHidden();
});
