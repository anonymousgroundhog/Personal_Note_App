import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    https: {
      cert: readFileSync(resolve(__dirname, 'certs/cert.pem')),
      key: readFileSync(resolve(__dirname, 'certs/key.pem')),
    },
  },
  optimizeDeps: {
    include: [
      'frappe-gantt',
      'ical.js',
      'dayjs',
      'dayjs/plugin/advancedFormat.js',
      'dayjs/plugin/customParseFormat.js',
      'dayjs/plugin/duration.js',
      'dayjs/plugin/isoWeek.js',
      '@braintree/sanitize-url',
      'cytoscape-cose-bilkent',
      'cytoscape-fcose',
    ],
    exclude: ['mermaid'],
  },
  build: {
    target: 'esnext',
  },
})
