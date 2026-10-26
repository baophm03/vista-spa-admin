import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Ảnh/video/file upload do backend serve tĩnh (MinIO) — proxy để URL tương đối hoạt động ở dev
    proxy: {
      '/images': 'http://localhost:3001',
      '/videos': 'http://localhost:3001',
      '/files': 'http://localhost:3001',
    },
  },
})

