/// <reference types="vitest/config" />
import { rm } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

// The MSW worker lives in public/ for dev. It has no place in a production bundle.
function stripMockWorker(keepForDemo: boolean): Plugin {
  return {
    name: 'oceanlink-strip-mock-worker',
    apply: 'build',
    async closeBundle() {
      if (!keepForDemo) {
        await rm(fileURLToPath(new URL('./dist/mockServiceWorker.js', import.meta.url)), {
          force: true,
        });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isDemoBuild = mode === 'demo' && env.VITE_DEMO_BUILD === 'true';

  // Mock mode is for local development only. A production bundle must never ship it.
  if (mode === 'production' && env.VITE_ENABLE_MOCKS === 'true') {
    throw new Error('VITE_ENABLE_MOCKS must not be set for a production build.');
  }

  return {
    plugins: [react(), stripMockWorker(isDemoBuild)],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy: {
        // Same-origin /api in development so the session cookie is first party.
        '/api': {
          target: env.VITE_DEV_PROXY_TARGET || 'http://localhost:8000',
          changeOrigin: false,
        },
      },
    },
    build: {
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router'],
            mui: ['@mui/material', '@emotion/react', '@emotion/styled'],
            data: ['@tanstack/react-query', 'react-hook-form', 'zod', '@hookform/resolvers'],
            i18n: ['i18next', 'react-i18next'],
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      restoreMocks: true,
    },
  };
});
