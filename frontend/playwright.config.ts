import { defineConfig, devices } from '@playwright/test';

const externalBaseUrl = process.env['E2E_BASE_URL'];

/**
 * E2E runs against the SSR production build, not the dev server — the whole
 * point is to verify what a user and a crawler actually receive, including
 * prerendered HTML, hydration and the reduced-motion / no-WebGL fallbacks.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 2 : undefined,
  reporter: process.env['CI'] ? [['github'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: externalBaseUrl ?? 'http://localhost:4000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    {
      // Content parity must hold with motion disabled — under this setting the
      // 3D tier is 'off' and the `three` chunk is never fetched.
      name: 'reduced-motion',
      use: { ...devices['Desktop Chrome'], reducedMotion: 'reduce' },
    },
  ],

  webServer: externalBaseUrl
    ? undefined
    : {
        command: 'node dist/fk-catering/server/server.mjs',
        url: 'http://localhost:4000/fr',
        reuseExistingServer: !process.env['CI'],
        timeout: 120_000,
      },
});
