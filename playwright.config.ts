import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 45_000,
  use: {
    baseURL: 'http://127.0.0.1:3002',
    trace: 'on-first-retry'
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3002',
    reuseExistingServer: true,
    timeout: 120_000
  }
});
