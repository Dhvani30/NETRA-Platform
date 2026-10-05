import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // The frontend calls FastAPI exclusively through its versioned API prefix.
      '/api/v1': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        // Do not rewrite: FastAPI serves /api/v1 directly.
        timeout: 0,
        proxyTimeout: 0,
      },
    },
  },
})
