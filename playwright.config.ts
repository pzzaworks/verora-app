import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],

  timeout: 30000,
  expect: {
    timeout: 10000,
  },

  use: {
    baseURL: process.env.APP_URL || 'http://localhost:4101',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // Normally reused from `startup.sh`; otherwise the NEXT_PUBLIC_* variables must be set in the shell
    command: 'pnpm dev --port 4101',
    port: 4101,
    reuseExistingServer: true,
    timeout: 120000,
  },
});
