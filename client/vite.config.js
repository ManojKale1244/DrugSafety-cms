import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Plugin to ensure dist/404.html is automatically generated on every build for SPA reload support on Vercel
function copy404Plugin() {
  return {
    name: 'copy-404-fallback',
    closeBundle() {
      const dist = path.resolve(__dirname, 'dist');
      const idx = path.join(dist, 'index.html');
      const fallback = path.join(dist, '404.html');
      try {
        if (fs.existsSync(idx)) {
          fs.copyFileSync(idx, fallback);
          const serverIndex = path.resolve(__dirname, '../server/src/index.html');
          fs.copyFileSync(idx, serverIndex);
          console.log('✓ SPA Fallback: Generated dist/404.html and server/src/index.html');
        }
      } catch (err) {
        console.warn('Notice: Could not copy 404.html:', err.message);
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), copy404Plugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
