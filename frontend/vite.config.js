import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  appType: 'spa',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 4000,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:8888',
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4000,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
  },
});
