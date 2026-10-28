/** Exercise the live SPA serially at desktop and phone sizes. */
import { defineConfig, devices } from '@playwright/test';
import { loadEnv } from 'vite';

const env = { ...loadEnv('development', process.cwd(), ''), ...process.env };
const baseURL = env.E2E_BASE_URL || 'http://127.0.0.1:5173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'node node_modules/vite/bin/vite.js',
    env: { DEV_HOST: env.DEV_HOST || '127.0.0.1', DEV_PORT: env.DEV_PORT || '5173' },
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30000,
  },
});
