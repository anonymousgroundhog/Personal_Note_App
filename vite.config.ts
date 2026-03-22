import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['frappe-gantt', 'ical.js'],
  },
  build: {
    target: 'esnext',
  },
})
