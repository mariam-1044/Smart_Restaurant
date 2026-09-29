import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['html'], ['github']] : [['list'], ['html']],
  use: {
    baseURL: 'http://localhost:5173',
    storageState: 'auth.json',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  globalSetup: require.resolve('./e2e/global-setup'),
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ],
  webServer: process.env.CI ? [
    {
      command: 'cd Server && npm start',
      url: 'http://localhost:8080/health',
      reuseExistingServer: false,
      env: { MONGODB_URI: 'mongodb://localhost:27017/smart_restaurant_e2e', NODE_ENV: 'test' }
    },
    {
      command: 'cd Client && npm run dev',
      url: 'http://localhost:5173',
      reuseExistingServer: false
    }
  ] : undefined
});