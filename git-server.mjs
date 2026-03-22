/**
 * git-server.mjs — local companion server for Personal Note App
 *
 * Listens on http://localhost:3001 and executes git (and git-lfs) commands
 * on behalf of the browser app.  Only binds to localhost — not exposed to
 * the network.
 *
 * Endpoints
 * ---------
 * POST /git          { cwd, args: string[] }  → { stdout, stderr, code }
 * POST /git/stream   { cwd, args: string[] }  → text/event-stream  (SSE)
 * GET  /git/caps                              → { git, lfs }  (capability check)
 *
 * Start with:  node git-server.mjs
 * Or via npm:  see package.json "dev" script
 */

import { createServer } from 'http'
import { spawn, execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { resolve } from 'path'

const PORT = 3001
const execFileAsync = promisify(execFile)

// ── CORS helper (only allow localhost origins) ─────────────────────────────────
function setCors(res, req) {
  const origin = req.headers.origin || ''
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

// ── Capability detection ───────────────────────────────────────────────────────
async function detectCaps() {
  const caps = { git: false, gitVersion: '', lfs: false, lfsVersion: '' }
  try {
    const { stdout: gv } = await execFileAsync('git', ['--version'])
    caps.git = true
    caps.gitVersion = gv.trim()
  } catch { /* git not found */ }
  try {
    const { stdout: lv } = await execFileAsync('git', ['lfs', 'version'])
    caps.lfs = true
    caps.lfsVersion = lv.trim()
  } catch { /* lfs not installed */ }
  return caps
}

// ── Validate / sanitise request ────────────────────────────────────────────────
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk; if (data.length > 1e6) reject(new Error('body too large')) })
    req.on('end', () => {
      try { resolve(JSON.parse(data)) } catch { reject(new Error('invalid JSON')) }
    })
    req.on('error', reject)
  })
}

const ALLOWED_GIT_CMDS = new Set([
  'init', 'status', 'add', 'commit', 'push', 'pull', 'fetch',
  'branch', 'checkout', 'remote', 'log', 'diff', 'stash',
  'lfs', 'config', 'rev-parse', 'show-ref', 'ls-remote',
])

function validateArgs(args) {
  if (!Array.isArray(args) || args.length === 0) throw new Error('args must be a non-empty array')
  if (typeof args[0] !== 'string') throw new Error('first arg must be a string')
  const cmd = args[0].toLowerCase()
  if (!ALLOWED_GIT_CMDS.has(cmd)) throw new Error(`git command not allowed: ${cmd}`)
  // No shell metacharacters in individual args
  for (const a of args) {
    if (typeof a !== 'string') throw new Error('all args must be strings')
    if (/[;&|`$<>]/.test(a)) throw new Error(`unsafe character in arg: ${a}`)
  }
  return args
}

// ── Run git, collect output ────────────────────────────────────────────────────
function runGit(cwd, args, onData, onEnd) {
  const proc = spawn('git', args, {
    cwd,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = '', stderr = ''
  proc.stdout.on('data', d => { const s = d.toString(); stdout += s; onData?.({ stream: 'out', text: s }) })
  proc.stderr.on('data', d => { const s = d.toString(); stderr += s; onData?.({ stream: 'err', text: s }) })
  proc.on('close', code => onEnd({ stdout, stderr, code }))
  proc.on('error', err => onEnd({ stdout, stderr: err.message, code: -1 }))
  return proc
}

// ── HTTP server ────────────────────────────────────────────────────────────────
const server = createServer(async (req, res) => {
  setCors(res, req)
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const url = new URL(req.url, `http://localhost:${PORT}`)

  // GET /git/caps
  if (req.method === 'GET' && url.pathname === '/git/caps') {
    const caps = await detectCaps()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(caps))
    return
  }

  // POST /git  (buffered — returns when command finishes)
  if (req.method === 'POST' && url.pathname === '/git') {
    try {
      const body = await parseBody(req)
      const args = validateArgs(body.args)
      const cwd = resolve(body.cwd || '.')
      if (!existsSync(cwd)) throw new Error(`directory not found: ${cwd}`)
      runGit(cwd, args, null, (result) => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      })
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  // POST /git/stream  (SSE — streams output line by line)
  if (req.method === 'POST' && url.pathname === '/git/stream') {
    try {
      const body = await parseBody(req)
      const args = validateArgs(body.args)
      const cwd = resolve(body.cwd || '.')
      if (!existsSync(cwd)) throw new Error(`directory not found: ${cwd}`)

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })

      const send = (type, data) => res.write(`data: ${JSON.stringify({ type, data })}\n\n`)

      runGit(cwd, args,
        ({ stream, text }) => send(stream === 'err' ? 'stderr' : 'stdout', text),
        ({ stdout, stderr, code }) => {
          send('done', { code, stdout, stderr })
          res.end()
        }
      )
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

const caps = await detectCaps()
server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  git-server listening on http://localhost:${PORT}`)
  console.log(`  git : ${caps.git ? caps.gitVersion : 'NOT FOUND'}`)
  console.log(`  lfs : ${caps.lfs ? caps.lfsVersion : 'not installed'}`)
  console.log()
})
