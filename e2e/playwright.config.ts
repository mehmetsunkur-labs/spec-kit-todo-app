import { defineConfig } from '@playwright/test';

const PORT = 3100;

export default defineConfig({
  testDir: 'tests',
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile-320',
      use: { browserName: 'chromium', viewport: { width: 320, height: 640 }, hasTouch: true },
    },
    {
      name: 'desktop-1280',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: 'npm run build --prefix .. && npm start --prefix ../backend',
    env: { PORT: String(PORT), DATABASE_PATH: '../e2e/.tmp/e2e.db', LOG_LEVEL: 'warn' },
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
