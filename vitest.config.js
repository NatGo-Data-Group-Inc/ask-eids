import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve('client/src'),
      '@shared': path.resolve('shared'),
    },
  },
  test: {
    globals: true,
    setupFiles: ['./client/src/test/setupTests.js'],
    environment: 'jsdom',
    include: ['client/src/test/**/*.test.{js,jsx}', 'server/test/**/*.test.js'],
    environmentMatchGlobs: [
      ['server/test/**/*.test.js', 'node'],
    ],
  },
});
