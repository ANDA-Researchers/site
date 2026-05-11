import { defineConfig, devices } from '@playwright/test';

// Tests assume the Jekyll dev server is already running at
//   http://127.0.0.1:4000/site/
// (start it via `bundle exec jekyll serve --host 127.0.0.1 --port 4000`).
//
// Workspace pages auto-enable mock mode on localhost — no Supabase
// credentials needed. See workspace/dev/mock.js.

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 20_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://127.0.0.1:4000',
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
