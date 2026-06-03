import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/MF-Star-Scrapper/',
  server: {
    watch: {
      usePolling: true,
      interval: 1000,
    },
  },
  optimizeDeps: {
    include: ['firebase/app', 'firebase/auth'],
  },
  build: {
    rolldownOptions: {
      external: [],
    },
    chunkSizeWarningLimit: 700,
  },
})
