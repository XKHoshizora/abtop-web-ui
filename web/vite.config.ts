import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// During `pnpm dev`, proxy the API to the Rust backend so the SPA can talk to
// real data. The production build is embedded into the Rust binary, served at
// the same origin, so no proxy is needed there.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8791',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
})
