import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.QA_BASE_URL ?? 'https://app.wizcrm.app';
const apiURL = (process.env.QA_API_URL ?? 'https://api.wizcrm.app').replace(/\/$/, '');

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'e2e-report/html' }],
    ['json', { outputFile: 'e2e-report/results.json' }],
  ],
  use: {
    baseURL,
    trace:
      process.env.QA_CYCLE === '002' || process.env.QA_CYCLE === '003'
        ? 'retain-on-failure'
        : 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  outputDir: 'e2e-report/test-results',
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  metadata: { apiURL },
});
