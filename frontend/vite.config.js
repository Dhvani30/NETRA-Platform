import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        // Keep /api/v1 intact: FastAPI serves that prefix directly.
        timeout: 0,
        proxyTimeout: 0,
      },
    },
  },
})
