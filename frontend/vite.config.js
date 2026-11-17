import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    // Erlaubt den Zugriff über die Codespaces-Adresse (…app.github.dev)
    allowedHosts: ['.app.github.dev'],
    // Alles unter /api wird an das Backend auf Port 3000 weitergeleitet
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        rewrite: path => path.replace(/^\/api/, '')
      }
    }
  }
})
