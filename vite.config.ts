import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
