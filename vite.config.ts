import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'
import fs from 'fs'

// Vite plugin for jimple file reading
function jimpleReaderPlugin() {
  return {
    name: 'jimple-reader',
    configureServer(server) {
      // Add middleware in PRE phase to run before proxy
      server.middlewares.use((req, res, next) => {
        if (req.method === 'POST' && req.url === '/security/jimple/read-file') {
          let body = ''

          req.on('data', chunk => {
            body += chunk.toString()
          })

          req.on('end', () => {
            try {
              const { folderPath, className } = JSON.parse(body)

              if (!folderPath || !className) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'Missing folderPath or className' }))
                return
              }

              // Try multiple path formats:
              // 1. Flat: /folder/com.example.MainActivity.jimple
              // 2. Nested: /folder/com/example/MainActivity.jimple
              const flatPath = path.join(folderPath, `${className}.jimple`)
              const classPath = className.replace(/\./g, '/')
              const nestedPath = path.join(folderPath, `${classPath}.jimple`)

              let filePath = null
              let content = null

              // Try flat path first
              try {
                if (fs.existsSync(flatPath)) {
                  const resolvedPath = path.resolve(flatPath)
                  const resolvedFolder = path.resolve(folderPath)
                  if (resolvedPath.startsWith(resolvedFolder)) {
                    content = fs.readFileSync(flatPath, 'utf-8')
                    filePath = flatPath
                  }
                }
              } catch (e) {
                // Ignore
              }

              // Try nested path if flat didn't work
              if (!content) {
                try {
                  if (fs.existsSync(nestedPath)) {
                    const resolvedPath = path.resolve(nestedPath)
                    const resolvedFolder = path.resolve(folderPath)
                    if (resolvedPath.startsWith(resolvedFolder)) {
                      content = fs.readFileSync(nestedPath, 'utf-8')
                      filePath = nestedPath
                    }
                  }
                } catch (e) {
                  // Ignore
                }
              }

              if (!content) {
                res.statusCode = 404
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: `File not found for class ${className}. Tried: ${flatPath}, ${nestedPath}` }))
                return
              }

              // Security: verify resolved path is within folderPath
              const resolvedPath = path.resolve(filePath)
              const resolvedFolder = path.resolve(folderPath)

              if (!resolvedPath.startsWith(resolvedFolder)) {
                res.statusCode = 400
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'Invalid path' }))
                return
              }
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ content }))
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Failed to read file'
              console.error('[jimple-reader]', message)
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: message }))
            }
          })
        } else {
          next()
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), basicSsl(), jimpleReaderPlugin()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/security': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        bypass: (req) => {
          // Don't proxy the jimple/read-file endpoint (let plugin handle it)
          if (req.url === '/security/jimple/read-file') {
            return false
          }
        },
      },
      '/git': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/terminal': {
        target: 'ws://localhost:3001',
        ws: true,
        changeOrigin: true,
      },
      '/discord': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
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
