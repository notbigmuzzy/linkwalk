import { defineConfig } from 'vite'

export default defineConfig({
  base: '/linkwalk/',
  build: {
    minify: 'esbuild',
    chunkSizeWarningLimit: 1200,
  },
})
