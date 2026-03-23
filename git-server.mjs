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
import { existsSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, join } from 'path'
import { tmpdir, homedir } from 'os'
import { randomBytes } from 'crypto'
import { WebSocketServer } from 'ws'
import pty from 'node-pty'

const PORT = 3001
const execFileAsync = promisify(execFile)

// ── CORS helper — allow any origin that hits our local server ──────────────────
// The server only binds to 0.0.0.0:3001 and is not internet-exposed,
// so wildcard CORS is safe here.
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
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
  setCors(res)
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

  // GET /run/caps — check which runtimes are available
  if (req.method === 'GET' && url.pathname === '/run/caps') {
    const checks = [
      { key: 'python', cmd: 'python3', args: ['--version'] },
      { key: 'node',   cmd: 'node',    args: ['--version'] },
      { key: 'java',   cmd: 'java',    args: ['--version'] },
      { key: 'bash',   cmd: 'bash',    args: ['--version'] },
    ]
    const caps = {}
    await Promise.all(checks.map(({ key, cmd, args }) =>
      promisify(execFile)(cmd, args, { timeout: 3000 })
        .then(({ stdout, stderr }) => { caps[key] = (stdout || stderr).split('\n')[0].trim() })
        .catch(() => { caps[key] = null })
    ))
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(caps))
    return
  }

  // POST /run/stream — execute code, stream output via SSE
  // Body: { language: 'python'|'node'|'bash'|'java', code: string, stdin?: string }
  if (req.method === 'POST' && url.pathname === '/run/stream') {
    let body
    try { body = await parseBody(req) } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
      return
    }

    const { language, code, stdin = '', args: userArgs = [] } = body
    if (typeof code !== 'string' || code.length > 500_000) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'invalid or too-large code body' }))
      return
    }
    // Validate args: must be array of strings with no shell metacharacters
    if (!Array.isArray(userArgs) || userArgs.some(a => typeof a !== 'string')) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'args must be an array of strings' }))
      return
    }

    // Write code to a temp file
    const id = randomBytes(8).toString('hex')
    const tmpDir = join(tmpdir(), `coderunner_${id}`)
    mkdirSync(tmpDir, { recursive: true })

    let cmd, cmdArgs, ext
    switch (language) {
      case 'python':
        ext = '.py'; cmd = 'python3'; cmdArgs = [join(tmpDir, `script${ext}`), ...userArgs]
        break
      case 'node':
        ext = '.mjs'; cmd = 'node'; cmdArgs = [join(tmpDir, `script${ext}`), ...userArgs]
        break
      case 'bash':
        ext = '.sh'; cmd = 'bash'; cmdArgs = [join(tmpDir, `script${ext}`), ...userArgs]
        break
      case 'java': {
        // Extract class name from code or default to Main
        const match = code.match(/public\s+class\s+(\w+)/)
        const className = match ? match[1] : 'Main'
        ext = '.java'
        writeFileSync(join(tmpDir, `${className}${ext}`), code)
        // Compile first, then run
        const compileProc = spawn('javac', [join(tmpDir, `${className}${ext}`)], {
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 15000,
        })
        let compileErr = ''
        compileProc.stderr.on('data', d => { compileErr += d.toString() })
        compileProc.on('close', code => {
          if (code !== 0) {
            res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
            const send = (type, data) => res.write(`data: ${JSON.stringify({ type, data })}\n\n`)
            send('stderr', compileErr)
            send('done', { code, stdout: '', stderr: compileErr })
            res.end()
          } else {
            res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
            const send = (type, data) => res.write(`data: ${JSON.stringify({ type, data })}\n\n`)
            const run = spawn('java', ['-cp', tmpDir, className, ...userArgs], {
              stdio: ['pipe', 'pipe', 'pipe'],
              timeout: 30000,
            })
            if (stdin) run.stdin.write(stdin)
            run.stdin.end()
            run.stdout.on('data', d => send('stdout', d.toString()))
            run.stderr.on('data', d => send('stderr', d.toString()))
            run.on('close', code => { send('done', { code }); res.end() })
            run.on('error', err => { send('stderr', err.message); send('done', { code: -1 }); res.end() })
          }
        })
        compileProc.on('error', err => {
          if (!res.headersSent) res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' })
          const send = (type, data) => res.write(`data: ${JSON.stringify({ type, data })}\n\n`)
          send('stderr', err.message); send('done', { code: -1 }); res.end()
        })
        return
      }
      default:
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: `unsupported language: ${language}` }))
        return
    }

    writeFileSync(join(tmpDir, `script${ext}`), code)

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })
    const send = (type, data) => res.write(`data: ${JSON.stringify({ type, data })}\n\n`)

    const proc = spawn(cmd, cmdArgs, {
      cwd: tmpDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    })
    if (stdin) proc.stdin.write(stdin)
    proc.stdin.end()
    proc.stdout.on('data', d => send('stdout', d.toString()))
    proc.stderr.on('data', d => send('stderr', d.toString()))
    proc.on('close', code => { send('done', { code }); res.end() })
    proc.on('error', err => { send('stderr', err.message); send('done', { code: -1 }); res.end() })
    return
  }

  // GET /search?q=...&page=1  — proxy Brave Search HTML, parse to clean JSON results
  if (req.method === 'GET' && url.pathname === '/search') {
    const q = url.searchParams.get('q')?.trim()
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10))
    if (!q) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'missing q' }))
      return
    }
    try {
      // Brave Search HTML — offset increments by 10 per page
      const offset = (page - 1) * 10
      const braveUrl = `https://search.brave.com/search?q=${encodeURIComponent(q)}&offset=${offset}&source=web`
      const response = await fetch(braveUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'identity',
        },
        signal: AbortSignal.timeout(12000),
      })
      const html = await response.text()

      function stripTags(s) {
        return s.replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
          .replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, ' ').trim()
      }

      const results = []

      // Each organic result is wrapped in <div class="snippet ..."> containing a title link and description
      // Pattern: grab each result block then extract url, title, snippet from it
      const blockRe = /<div[^>]+class="[^"]*snippet[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g
      let bm
      while ((bm = blockRe.exec(html)) !== null && results.length < 10) {
        const block = bm[1]
        // Extract URL from first <a href="https://...">
        const urlMatch = block.match(/<a[^>]+href="(https?:\/\/[^"]+)"/)
        if (!urlMatch) continue
        const href = urlMatch[1]
        // Skip Brave internal / ad links
        if (href.includes('search.brave.com') || href.includes('brave.com/search')) continue
        // Extract title text from the link
        const titleMatch = block.match(/<a[^>]+href="https?:\/\/[^"]*"[^>]*>([\s\S]*?)<\/a>/)
        const title = titleMatch ? stripTags(titleMatch[1]) : ''
        // Extract snippet — look for p or div with description text
        const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/) ||
                             block.match(/class="[^"]*snippet-description[^"]*"[^>]*>([\s\S]*?)<\//)
        const snippet = snippetMatch ? stripTags(snippetMatch[1]) : ''
        if (title && href) results.push({ title, url: href, snippet })
      }

      // Fallback: simpler link+title extraction if block pattern found nothing
      if (results.length === 0) {
        const linkRe = /<a[^>]+href="(https?:\/\/(?!search\.brave\.com)[^"]+)"[^>]*>\s*<span[^>]*>([\s\S]*?)<\/span>/g
        let lm
        while ((lm = linkRe.exec(html)) !== null && results.length < 10) {
          const href = lm[1]
          const title = stripTags(lm[2])
          if (title.length > 5 && !href.includes('brave.com')) {
            results.push({ title, url: href, snippet: '' })
          }
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ results, query: q, page }))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  // POST /ai/models  — proxy GET /api/models (then /v1/models fallback) to an AI server
  // POST /ai/chat    — proxy POST /api/chat/completions (then /v1/chat/completions) and stream back
  // Body: { serverUrl, apiKey, ...rest }
  if (req.method === 'POST' && (url.pathname === '/ai/models' || url.pathname === '/ai/chat')) {
    let body = ''
    req.on('data', d => { body += d })
    await new Promise(resolve => req.on('end', resolve))
    let payload
    try { payload = JSON.parse(body) } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid JSON' }))
      return
    }

    const { serverUrl, apiKey, ...rest } = payload
    if (!serverUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'serverUrl required' }))
      return
    }

    const base = serverUrl.replace(/\/$/, '')
    const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' }
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

    if (url.pathname === '/ai/models') {
      // OpenWebUI: GET /api/models
      // Fallback for plain Ollama/OpenAI-compat servers: GET /v1/models
      let lastStatus = 0
      let lastErr = ''
      for (const path of ['/api/models', '/v1/models']) {
        let upstream
        try {
          upstream = await fetch(`${base}${path}`, {
            headers,
            signal: AbortSignal.timeout(10000),
          })
        } catch (e) {
          lastErr = e.message
          continue
        }
        if (upstream.status === 401 || upstream.status === 403) {
          // Auth error — don't try the next path, surface it immediately
          const body = await upstream.text()
          res.writeHead(upstream.status, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: `Authentication failed (HTTP ${upstream.status}). Check your API key.`, detail: body }))
          return
        }
        if (!upstream.ok) { lastStatus = upstream.status; lastErr = `HTTP ${upstream.status}`; continue }
        const data = await upstream.json()
        // Normalise: OpenWebUI wraps in { data: [...] }, Ollama returns { models: [...] }, OpenAI returns { data: [...] }
        const rawList = data.data ?? data.models ?? (Array.isArray(data) ? data : [])
        const models = rawList.map(m => ({
          id: m.id ?? m.name,
          name: m.name ?? m.id,
          owned_by: m.owned_by,
        })).filter(m => m.id)
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ data: models }))
        return
      }
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: `Could not reach AI server at ${base}. ${lastErr}`.trim() }))
      return
    }

    // /ai/chat — forward to OpenWebUI /api/chat/completions and pipe stream back
    // Falls back to /v1/chat/completions for plain OpenAI-compat servers
    let upstream = null
    let lastChatErr = ''
    for (const path of ['/api/chat/completions', '/v1/chat/completions']) {
      let r
      try {
        r = await fetch(`${base}${path}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(rest),
          // No AbortSignal timeout — streaming responses can be arbitrarily long.
          // The client-side AbortController handles cancellation.
        })
      } catch (e) {
        lastChatErr = e.message
        continue
      }
      if (r.status === 401 || r.status === 403) {
        const body = await r.text()
        res.writeHead(r.status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: `Authentication failed (HTTP ${r.status}). Check your API key.`, detail: body }))
        return
      }
      if (r.status === 404) { lastChatErr = `HTTP 404 at ${path}`; continue }  // try next path
      upstream = r
      break
    }
    if (!upstream) {
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: `Could not reach AI server at ${base}. ${lastChatErr}`.trim() }))
      return
    }
    if (!upstream.ok) {
      const errText = await upstream.text()
      res.writeHead(upstream.status, { 'Content-Type': 'application/json' })
      res.end(errText)
      return
    }
    // Pipe the streaming SSE response straight through to the browser
    res.writeHead(200, {
      'Content-Type': upstream.headers.get('content-type') || 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Transfer-Encoding': 'chunked',
      
    })
    const reader = upstream.body.getReader()
    // Stop streaming if the browser disconnects
    req.on('close', () => reader.cancel())
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        res.write(value)
      }
    } finally {
      reader.releaseLock()
      res.end()
    }
    return
  }

  // GET /proxy?url=https://... — fetch a remote page server-side and return it,
  // stripping headers that block embedding and rewriting relative URLs so the
  // page renders correctly inside the iframe.
  if (req.method === 'GET' && url.pathname === '/proxy') {
    const target = url.searchParams.get('url')
    if (!target || !/^https?:\/\//i.test(target)) {
      res.writeHead(400); res.end('Bad url'); return
    }
    try {
      const targetUrl = new URL(target)
      const upstream = await fetch(target, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'identity',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(30000),
      })

      const contentType = upstream.headers.get('content-type') || 'text/html'

      // For non-HTML resources (images, CSS, JS) — just pipe them through
      if (!contentType.includes('text/html')) {
        res.writeHead(upstream.status, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=300',
        })
        const buf = await upstream.arrayBuffer()
        res.end(Buffer.from(buf))
        return
      }

      let html = await upstream.text()
      const base = `${targetUrl.protocol}//${targetUrl.host}`
      const pageUrl = target

      // Inject a <base> tag so relative links resolve correctly,
      // and a small script that intercepts link clicks to route them through the proxy
      const baseTag = `<base href="${base}/">`
      const proxyBase = `${req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'}://${req.headers.host}`
      const interceptScript = `<script>
(function(){
  var BASE = ${JSON.stringify(base)};
  var PROXY = ${JSON.stringify(`${proxyBase}/proxy?url=`)};
  function proxyHref(href){
    try {
      var u = new URL(href, BASE);
      return PROXY + encodeURIComponent(u.href);
    } catch(e){ return href; }
  }
  document.addEventListener('click', function(e){
    var a = e.target.closest('a');
    if(!a) return;
    var href = a.getAttribute('href');
    if(!href || href.startsWith('#') || href.startsWith('javascript')) return;
    e.preventDefault();
    window.location.href = proxyHref(href);
  }, true);
  // Rewrite form actions
  document.addEventListener('submit', function(e){
    var form = e.target;
    var action = form.getAttribute('action');
    if(action && !action.startsWith('javascript')){
      try {
        form.action = PROXY + encodeURIComponent(new URL(action, BASE).href);
      } catch(ex){}
    }
  }, true);
})();
</script>`

      // Insert base tag right after <head> or at the start
      if (/<head[\s>]/i.test(html)) {
        html = html.replace(/(<head[^>]*>)/i, `$1${baseTag}`)
      } else {
        html = baseTag + html
      }

      // Insert intercept script before </body> or at end
      if (/<\/body>/i.test(html)) {
        html = html.replace(/<\/body>/i, `${interceptScript}</body>`)
      } else {
        html += interceptScript
      }

      // Rewrite absolute src/href/action attributes so sub-resources load via our proxy
      html = html.replace(/(src|href|action)=["'](https?:\/\/[^"']+)["']/gi, (match, attr, u) => {
        return `${attr}="${proxyBase}/proxy?url=${encodeURIComponent(u)}"`
      })

      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        // Strip all headers that block iframe embedding
        'X-Frame-Options': 'ALLOWALL',
        'Content-Security-Policy': '',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      })
      res.end(html)
    } catch (e) {
      const msg = e.message || String(e)
      const hint = (msg.includes('ENOTFOUND') || msg.includes('ECONNREFUSED') || msg.includes('ECONNRESET'))
        ? `<p style="color:#b45309;background:#fef3c7;padding:.75rem 1rem;border-radius:.5rem;font-size:.85rem;margin-top:1rem">
            <strong>Tip:</strong> This looks like a network error reaching <code>${target}</code>.<br>
            Make sure the server is running and reachable from <em>this machine</em> (the one running git-server.mjs).
            If it's an HTTP (non-HTTPS) address on an internal network, that is supported.
           </p>`
        : ''
      res.writeHead(502, { 'Content-Type': 'text/html' })
      res.end(`<html><body style="font-family:sans-serif;padding:2rem;color:#555">
        <h2 style="margin:0 0 .5rem">Could not load page</h2>
        <p style="font-family:monospace;background:#f3f4f6;padding:.5rem .75rem;border-radius:.4rem;display:inline-block">${msg}</p>
        ${hint}
        <p style="margin-top:1.25rem"><a href="${target}" target="_top" style="color:#3b82f6">Open in browser instead ↗</a></p>
      </body></html>`)
    }
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

// ── WebSocket terminal server ──────────────────────────────────────────────────
//
// ws://host:3001/terminal
// Protocol (JSON messages both ways):
//   client → server:  { type: 'input', data: string }
//                     { type: 'resize', cols: number, rows: number }
//   server → client:  { type: 'output', data: string }
//                     { type: 'exit', code: number }

const wss = new WebSocketServer({ server })

wss.on('connection', (ws, req) => {
  // Only allow local/LAN origins
  const origin = req.headers.origin || ''
  if (!/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin)) {
    ws.close(4003, 'Forbidden origin')
    return
  }

  const shell = process.env.SHELL || '/bin/bash'
  const ptyProc = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: homedir(),
    env: { ...process.env, TERM: 'xterm-256color' },
  })

  ptyProc.onData(data => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'output', data }))
  })

  ptyProc.onExit(({ exitCode }) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'exit', code: exitCode }))
    ws.close()
  })

  ws.on('message', raw => {
    try {
      const msg = JSON.parse(raw.toString())
      if (msg.type === 'input') {
        ptyProc.write(msg.data)
      } else if (msg.type === 'resize') {
        ptyProc.resize(msg.cols, msg.rows)
      }
    } catch { /* ignore bad messages */ }
  })

  ws.on('close', () => {
    try { ptyProc.kill() } catch { /* already dead */ }
  })
})

const caps = await detectCaps()
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  git-server listening on http://0.0.0.0:${PORT}`)
  console.log(`  terminal : ws://0.0.0.0:${PORT}/terminal`)
  console.log(`  git : ${caps.git ? caps.gitVersion : 'NOT FOUND'}`)
  console.log(`  lfs : ${caps.lfs ? caps.lfsVersion : 'not installed'}`)
  console.log()
})
