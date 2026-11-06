import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  server: {
    port: 5173,
    host: '127.0.0.1',
    // The API (pnpm start:api) runs on 3100; the dev server forwards /api, including the live stream.
    proxy: { '/api': { target: 'http://127.0.0.1:3100', changeOrigin: false } },
  },
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false },
});
