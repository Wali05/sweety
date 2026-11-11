import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Fail instead of silently moving to another port: the API's CORS
    // default (CLIENT_ORIGIN) expects the client on 5173.
    strictPort: true,
    // Forward API paths to the Express server so the client can use
    // same-origin URLs like /auth/login during development.
    proxy: {
      '/auth': API_TARGET,
      '/readings': API_TARGET,
      '/reports': API_TARGET,
      '/health': API_TARGET,
    },
  },
  // Used by `npm test` (Vitest). fetch is mocked in every test, so no API
  // server is needed.
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    include: ['src/**/*.test.{js,jsx}'],
    restoreMocks: true,
    unstubGlobals: true,
  },
});
