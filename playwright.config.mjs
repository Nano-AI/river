import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  timeout: 30000,
  retries: 0,
  workers: process.env.CI ? 1 : 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { colorScheme: 'light', baseURL: 'http://127.0.0.1:4174', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [{ command: 'node scripts/serve.mjs dist', env: { PORT: '4174' }, port: 4174, reuseExistingServer: false }, { command: 'node scripts/serve.mjs dist', env: { PORT: '4176', BASE_PATH: '/poker/' }, port: 4176, reuseExistingServer: false }],
  projects: [
    { name: 'phone-chromium', testIgnore: '**/subpath.spec.mjs', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
    { name: 'laptop-chromium', testIgnore: '**/subpath.spec.mjs', use: { browserName: 'chromium', viewport: { width: 1440, height: 1000 } } },
    { name: 'phone-webkit', testIgnore: '**/subpath.spec.mjs', use: { ...devices['iPhone 13'], viewport: { width: 390, height: 844 } } },
    { name: 'poker-subpath', testMatch: '**/subpath.spec.mjs', use: { ...devices['Pixel 7'], baseURL: 'http://127.0.0.1:4176/poker/' } },
  ],
});
