/** Configure the browser-local development server from environment values. */
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  return {
    plugins: [react()],
    server: {
      host: env.DEV_HOST || '127.0.0.1',
      port: Number(env.DEV_PORT || 5173),
      strictPort: true,
    },
  };
});
