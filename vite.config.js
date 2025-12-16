import { defineConfig } from 'vite'

export default defineConfig({
  base: '/linkwalk/',
  build: {
    // Three.js apps commonly exceed the default 500kb warning.
    // This does not affect runtime size; it only quiets the warning.
    chunkSizeWarningLimit: 1200,
  },
})
