import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.NODE_ENV === 'production' ? '/attendance/' : '/',
  server: {
    host: '0.0.0.0',
    port: 5173,
    hmr: { host: 'localhost' },   // HMR WebSocket через localhost, иначе браузер не получает обновления из Docker
    proxy: {
      '/api': {
        target: process.env.BACKEND_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
