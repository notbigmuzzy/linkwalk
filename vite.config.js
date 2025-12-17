import { defineConfig } from 'vite'

export default defineConfig({
  base: '/linkwalk/',
  build: {
    chunkSizeWarningLimit: 1200,
  },
})
