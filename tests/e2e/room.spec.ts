import { expect, test } from '@playwright/test';
import { collectErrors, startGame, waitForFrames } from './helpers';

test('renders the room within the draw-call budget', async ({ page }) => {
  const errors = collectErrors(page);
  await startGame(page);
  await waitForFrames(page, 5);
  const r = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__!.renderer);
  expect(r.triangles).toBeGreaterThan(100);
  expect(r.calls).toBeLessThan(300);
  expect(errors.console).toEqual([]);
  expect(errors.page).toEqual([]);
});
