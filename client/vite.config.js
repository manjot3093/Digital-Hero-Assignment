import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * In development the API is proxied so the browser sees one origin and the
 * session cookie behaves exactly as it will in production behind a single
 * domain. In production VITE_API_URL points at the deployed API.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET ?? 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ['recharts'],
          motion: ['framer-motion'],
        },
      },
    },
  },
});
