/** Run the unchanged browser journeys against the production container. */
import config from './playwright.config.js';
export default {
  ...config,
  webServer: undefined,
  use: { ...config.use, baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:8080' },
};
