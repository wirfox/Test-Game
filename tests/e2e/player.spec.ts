import { expect, test, type Page } from '@playwright/test';
import { collectErrors, startGame } from './helpers';

const diag = (page: Page) => page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!);

async function advance(page: Page, seconds: number) {
  await page.evaluate((s) => window.__THREE_GAME_TEST_HOOKS__!.advance(s), seconds);
}
async function teleport(page: Page, x: number, z: number, yaw: number) {
  await page.evaluate(([x, z, yaw]) => window.__THREE_GAME_TEST_HOOKS__!.teleport(x, z, yaw), [x, z, yaw]);
}
function insideWalkable(x: number, z: number): boolean {
  const room = x >= -4 && x <= 4 && z >= -3 && z <= 3;
  const corridor = x >= -8 && x <= -4 && z >= -0.7 && z <= 0.7;
  return room || corridor;
}

test('spawns at the corridor start, standing on the floor', async ({ page }) => {
  await startGame(page);
  await advance(page, 0.5);
  const d = await diag(page);
  expect(d.player.position.x).toBeCloseTo(-7.3, 1);
  expect(d.player.position.z).toBeCloseTo(0, 1);
  expect(d.player.position.y).toBeCloseTo(0, 1);
  expect(d.player.grounded).toBe(true);
});

test('walks forward', async ({ page }) => {
  await startGame(page);
  const start = (await diag(page)).player.position.x;
  await page.keyboard.down('KeyW');
  await advance(page, 2);
  const d = await diag(page);
  expect(d.player.position.x - start).toBeGreaterThan(2.5);
  expect(d.player.position.x - start).toBeLessThan(3.5);
  expect(d.player.speed).toBeCloseTo(1.7, 1);
  await page.keyboard.up('KeyW');
  await advance(page, 0.5);
  expect((await diag(page)).player.speed).toBeLessThan(0.05);
});

test('sprints with shift', async ({ page }) => {
  await startGame(page);
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyW');
  await advance(page, 1);
  expect((await diag(page)).player.speed).toBeCloseTo(2.9, 1);
});

test('walls stop the player', async ({ page }) => {
  await startGame(page);
  await teleport(page, 3.0, 2.6, 0);
  await page.keyboard.down('KeyW');
  await advance(page, 3);
  const d = await diag(page);
  expect(d.player.position.x).toBeLessThanOrEqual(4 - 0.3 + 0.05);
  expect(d.player.position.x).toBeGreaterThan(3.5);
});

test('furniture stops the player', async ({ page }) => {
  await startGame(page);
  // Sofa spans z in [1.35, 2.25]; walk at it from the north side of the room.
  await teleport(page, -1.5, 0, Math.PI / 2);
  await page.keyboard.down('KeyW');
  await advance(page, 3);
  const z = (await diag(page)).player.position.z;
  expect(z).toBeLessThanOrEqual(1.35 - 0.3 + 0.05);
  expect(z).toBeGreaterThan(0.8);
});

test('walks through the doorway from the corridor into the room', async ({ page }) => {
  await startGame(page);
  await page.keyboard.down('KeyW');
  await advance(page, 4);
  expect((await diag(page)).player.position.x).toBeGreaterThan(-3.5);
});

test('survives a long frame without leaving the level', async ({ page }) => {
  await startGame(page);
  await teleport(page, 3.5, 2.6, 0);
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyW');
  await advance(page, 0.5);
  // Measure inside one call so the real render loop cannot add time in between.
  const gained = await page.evaluate(() => {
    const before = window.__THREE_GAME_DIAGNOSTICS__!.elapsed;
    window.__THREE_GAME_TEST_HOOKS__!.simulateFrame(5);
    return window.__THREE_GAME_DIAGNOSTICS__!.elapsed - before;
  });
  const d = await diag(page);
  expect(insideWalkable(d.player.position.x, d.player.position.z)).toBe(true);
  expect(gained).toBeGreaterThan(0);
  expect(gained).toBeLessThanOrEqual(0.1 + 1e-6);
});

test('look hook rotates the camera and clamps pitch', async ({ page }) => {
  await startGame(page);
  const before = (await diag(page)).player.yaw;
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.look(500, 0));
  expect((await diag(page)).player.yaw - before).toBeCloseTo(1.0, 2);
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.look(0, 5000));
  expect((await diag(page)).player.pitch).toBeCloseTo(-1.48, 2);
  await page.evaluate(() => window.__THREE_GAME_TEST_HOOKS__!.look(0, -50000));
  expect((await diag(page)).player.pitch).toBeCloseTo(1.48, 2);
});

test('real mouse movement turns the view while the pointer is locked', async ({ page }) => {
  await startGame(page);
  await page.waitForFunction(() => document.pointerLockElement !== null);
  const before = (await diag(page)).player.yaw;
  await page.mouse.move(740, 360);
  await expect.poll(async () => (await diag(page)).player.yaw - before).toBeGreaterThan(0.05);
});

test('escape pauses, click resumes, without errors', async ({ page }) => {
  const errors = collectErrors(page);
  await startGame(page);
  await page.waitForFunction(() => document.pointerLockElement !== null);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'paused');
  await expect(page.getByText('Cliquer pour reprendre')).toBeVisible();
  expect(await page.evaluate(() => document.pointerLockElement)).toBeNull();
  const frozen = (await diag(page)).elapsed;
  await page.waitForTimeout(300);
  expect((await diag(page)).elapsed).toBe(frozen);
  // Chromium refuses to re-lock right after Escape; the game must cope and resume on a later click.
  await expect(async () => {
    await page.mouse.click(640, 360);
    expect((await diag(page)).state).toBe('playing');
  }).toPass({ timeout: 8000, intervals: [500] });
  expect(errors.console).toEqual([]);
  expect(errors.page).toEqual([]);
});

test('keys held when the window loses focus are released', async ({ page }) => {
  await startGame(page);
  await page.keyboard.down('KeyW');
  await advance(page, 0.5);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await advance(page, 0.5);
  expect((await diag(page)).player.speed).toBeLessThan(0.05);
});

test('shows movement help on start', async ({ page }) => {
  await startGame(page);
  await expect(page.getByText(/se déplacer · Maj courir · F lampe · E interagir/)).toBeVisible();
});

test('losing the pointer lock pauses the game', async ({ page }) => {
  await startGame(page);
  await page.waitForFunction(() => document.pointerLockElement !== null);
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'paused');
  await expect(page.getByText('Cliquer pour reprendre')).toBeVisible();
});

test('slides along a wall instead of sticking', async ({ page }) => {
  await startGame(page);
  // Facing 45 degrees into the north wall (z = 3) from the open middle of the room.
  await teleport(page, -3, 2.4, Math.PI / 4);
  await page.keyboard.down('KeyW');
  await advance(page, 3);
  const p = (await diag(page)).player.position;
  expect(p.z).toBeLessThanOrEqual(3 - 0.3 + 0.05);
  expect(p.x).toBeGreaterThan(-3 + 2.5);
});

test('does not get stuck in a room corner', async ({ page }) => {
  await startGame(page);
  await teleport(page, -3.4, 2.4, (3 * Math.PI) / 4); // toward the north-west corner
  await page.keyboard.down('KeyW');
  await advance(page, 2);
  await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyS');
  await advance(page, 1.5);
  const p = (await diag(page)).player.position;
  expect(p.x).toBeGreaterThan(-3.0);
  expect(p.z).toBeLessThan(2.2);
});
