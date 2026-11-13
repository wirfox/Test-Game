import type { Page } from '@playwright/test';

export function collectErrors(page: Page): { console: string[]; page: string[] } {
  const errors = { console: [] as string[], page: [] as string[] };
  page.on('console', (message) => {
    if (message.type() === 'error') errors.console.push(message.text());
  });
  page.on('pageerror', (error) => errors.page.push(error.message));
  return errors;
}

export async function waitForFrames(page: Page, count = 5): Promise<void> {
  const start = await page.evaluate(() => window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0);
  await page.waitForFunction((target) => (window.__THREE_GAME_DIAGNOSTICS__?.frame ?? 0) >= target, start + count);
}

export async function startGame(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'title');
  await page.mouse.click(640, 360);
  await page.waitForFunction(() => window.__THREE_GAME_DIAGNOSTICS__?.state === 'playing');
}
