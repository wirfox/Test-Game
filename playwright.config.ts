import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

// The cloud container ships a preinstalled Chromium; elsewhere Playwright uses its own.
const PREINSTALLED_CHROMIUM = '/opt/pw-browsers/chromium';
const executablePath = existsSync(PREINSTALLED_CHROMIUM) ? PREINSTALLED_CHROMIUM : undefined;

export default defineConfig({
  testDir: './tests/e2e',
  // One worker: parallel headless WebGL contexts contend for the GPU.
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://127.0.0.1:5188',
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5188',
    reuseExistingServer: !process.env.CI,
    timeout: 20_000,
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chromium',
        viewport: { width: 1280, height: 720 },
        launchOptions: executablePath ? { executablePath } : {},
      },
    },
  ],
});
