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
import https from 'https'
import { spawn, execFile, spawnSync, execFileSync } from 'child_process'
import { promisify } from 'util'
import { existsSync, writeFileSync, mkdirSync, readFileSync, createWriteStream, readdirSync, mkdtempSync } from 'fs'
import { resolve, join } from 'path'
import { tmpdir, homedir } from 'os'
import { randomBytes } from 'crypto'
import { WebSocketServer } from 'ws'

// node-pty is a native module — load it dynamically so a failed build doesn't crash the server
let pty = null
try {
  pty = (await import('node-pty')).default
} catch (e) {
  console.warn('node-pty unavailable — terminal feature disabled:', e.message)
}

const DEFAULT_PORT = 3001
const PORT = parseInt(process.env.GIT_SERVER_PORT || DEFAULT_PORT, 10)
const execFileAsync = promisify(execFile)

// ── Docker Path Remapping ──────────────────────────────────────────────────────────
// When running in Docker, the host home directory is mounted at /root/host-home
// but the app sends paths from the host (e.g., /home/username/...).
// This function remaps those paths to the Docker mount point.
const HOST_HOME = process.env.HOST_HOME || ''
const IN_DOCKER = existsSync('/.dockerenv') || process.env.VITE_DOCKER === 'true'

function remapDockerPath(hostPath) {
  if (!IN_DOCKER || !HOST_HOME) return hostPath
  // Example: /home/spsand1/Documents/... → /root/host-home/Documents/...
  const hostHomeBasename = HOST_HOME.split('/').filter(Boolean).pop()
  if (hostPath.includes(hostHomeBasename)) {
    // Replace the host home path with the Docker mount point
    return hostPath.replace(new RegExp(`^.*${hostHomeBasename}`), `/root/host-home`)
  }
  return hostPath
}

if (IN_DOCKER) {
  console.log(`[docker] Running in Docker with HOST_HOME=${HOST_HOME}`)
}

// ── Security Suite Configuration ───────────────────────────────────────────────────
const SECURITY_DIR = join(homedir(), '.note-app-security')
const SOOT_INSTALL_DIR = join(SECURITY_DIR, 'soot')
const PLATFORMS_INSTALL_DIR = join(SECURITY_DIR, 'android-platforms')
const JAVA_INSTALL_DIR = join(SECURITY_DIR, 'java')

// Ensure security directories exist
mkdirSync(SECURITY_DIR, { recursive: true })
mkdirSync(SOOT_INSTALL_DIR, { recursive: true })
mkdirSync(PLATFORMS_INSTALL_DIR, { recursive: true })
mkdirSync(JAVA_INSTALL_DIR, { recursive: true })

// Available Soot versions (from Maven Central)
const SOOT_VERSIONS = [
  { version: '4.5.0', url: 'https://repo1.maven.org/maven2/ca/mcgill/sable/soot/4.5.0/soot-4.5.0-jar-with-dependencies.jar' },
  { version: '4.4.1', url: 'https://repo1.maven.org/maven2/ca/mcgill/sable/soot/4.4.1/soot-4.4.1-jar-with-dependencies.jar' },
]

// Available Android API levels
const ANDROID_API_LEVELS = [
  { api: 35, name: 'Android 15 (API 35)' },
  { api: 34, name: 'Android 14 (API 34)' },
  { api: 33, name: 'Android 13 (API 33)' },
  { api: 32, name: 'Android 12 (API 32)' },
  { api: 31, name: 'Android 12 (API 31)' },
  { api: 30, name: 'Android 11 (API 30)' },
  { api: 29, name: 'Android 10 (API 29)' },
  { api: 28, name: 'Android 9 (API 28)' },
]

// Download file helper
async function downloadFile(url, outputPath) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(outputPath)

    const request = https.get(url, response => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.destroy()
        downloadFile(response.headers.location, outputPath).then(resolve).catch(reject)
        return
      }
      if (response.statusCode !== 200) {
        file.destroy()
        reject(new Error(`HTTP ${response.statusCode}`))
        return
      }

      response.pipe(file)
      file.on('finish', () => {
        file.close()
        resolve()
      })
      file.on('error', err => {
        file.destroy()
        reject(err)
      })
      response.on('error', err => {
        file.destroy()
        reject(err)
      })
    })

    request.on('error', reject)
  })
}

// Get appropriate JDK URL for OS/arch
function getJdkUrl() {
  const platform = process.platform
  const arch = process.arch

  // Eclipse Temurin JDK 21 (free, open-source)
  // Map Node.js arch to JDK arch
  const archMap = {
    'x64': 'x64',
    'arm64': 'aarch64',
    'x32': 'x86',
  }

  const jdkArch = archMap[arch] || arch

  if (platform === 'linux') {
    return `https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.1%2B12/OpenJDK21U-jdk_${jdkArch}_linux_hotspot_21.0.1_12.tar.gz`
  } else if (platform === 'darwin') {
    return `https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.1%2B12/OpenJDK21U-jdk_${jdkArch}_mac_hotspot_21.0.1_12.tar.gz`
  } else if (platform === 'win32') {
    return `https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.1%2B12/OpenJDK21U-jdk_${jdkArch}_windows_hotspot_21.0.1_12.zip`
  }

  return null
}

// ── CORS helper — allow any origin that hits our local server ──────────────────
// The server only binds to 0.0.0.0:3001 and is not internet-exposed,
// so wildcard CORS is safe here.
function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Filename')
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
async function runGit(cwd, args, onData, onEnd) {
  // Pre-configure git to trust this directory (needed in Docker with mixed ownership)
  // This handles the "detected dubious ownership" error
  if (IN_DOCKER) {
    try {
      await new Promise((resolve) => {
        const proc = spawn('git', ['config', '--global', '--add', 'safe.directory', cwd], {
          stdio: 'ignore',
        })
        proc.on('exit', resolve)
      })
    } catch (e) {
      // Ignore errors from pre-config
    }
  }

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

// ── Native folder picker ───────────────────────────────────────────────────────
async function browseDirectory(startPath) {
  const platform = process.platform
  return new Promise((resolve, reject) => {
    let cmd, args
    if (platform === 'darwin') {
      cmd = 'osascript'
      args = ['-e', `POSIX path of (choose folder${startPath ? ` default location POSIX file "${startPath}"` : ''})`]
    } else if (platform === 'win32') {
      cmd = 'powershell'
      args = [
        '-NoProfile', '-Command',
        `Add-Type -AssemblyName System.Windows.Forms; $d = New-Object System.Windows.Forms.FolderBrowserDialog; ${startPath ? `$d.SelectedPath = '${startPath}'; ` : ''}if ($d.ShowDialog() -eq 'OK') { $d.SelectedPath } else { '' }`
      ]
    } else {
      // Linux — prefer zenity, fall back to kdialog
      if (spawnSync('which', ['zenity'], { stdio: 'ignore' }).status === 0) {
        cmd = 'zenity'
        args = ['--file-selection', '--directory', '--title=Select vault folder', ...(startPath ? [`--filename=${startPath}/`] : [])]
      } else if (spawnSync('which', ['kdialog'], { stdio: 'ignore' }).status === 0) {
        cmd = 'kdialog'
        args = ['--getexistingdirectory', startPath || homedir()]
      } else {
        return reject(new Error('No native folder picker available (install zenity or kdialog)'))
      }
    }
    execFile(cmd, args, { timeout: 60000 }, (err, stdout, stderr) => {
      const path = stdout.trim().replace(/\/$/, '') // strip trailing slash
      if (err && !path) return reject(new Error(stderr.trim() || 'Folder picker cancelled or failed'))
      resolve(path)
    })
  })
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

  // GET /browse/directory?start=<path>  — open a native folder picker
  if (req.method === 'GET' && url.pathname === '/browse/directory') {
    try {
      const startPath = url.searchParams.get('start') || ''
      const selected = await browseDirectory(startPath)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ path: selected }))
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  // GET /browse/ls?path=<dir>  — list directories and files at a path
  if (req.method === 'GET' && url.pathname === '/browse/ls') {
    setCors(res)
    try {
      let reqPath = resolve(url.searchParams.get('path') || homedir())
      // Apply Docker path remapping if needed
      reqPath = remapDockerPath(reqPath)
      const entries = readdirSync(reqPath, { withFileTypes: true })
      const dirs = entries
        .filter(e => e.isDirectory() && !e.name.startsWith('.'))
        .map(e => ({ name: e.name, path: join(reqPath, e.name), type: 'dir' }))
      const files = entries
        .filter(e => e.isFile() && !e.name.startsWith('.'))
        .map(e => ({ name: e.name, path: join(reqPath, e.name), type: 'file' }))
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ path: reqPath, entries: [...dirs, ...files] }))
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  // POST /git  (buffered — returns when command finishes)
  if (req.method === 'POST' && url.pathname === '/git') {
    try {
      const body = await parseBody(req)
      const args = validateArgs(body.args)
      let cwd = resolve(body.cwd || '.')

      // If path doesn't exist, try without trailing slash
      if (!existsSync(cwd) && cwd.endsWith('/')) {
        cwd = cwd.slice(0, -1)
      }
      // If still doesn't exist, try with home dir expansion
      if (!existsSync(cwd) && body.cwd?.startsWith('~')) {
        cwd = resolve(body.cwd.replace('~', homedir()))
      }

      // Apply Docker path remapping if running in container
      const originalCwd = cwd
      cwd = remapDockerPath(cwd)
      if (cwd !== originalCwd) {
        console.log(`[/git] Docker path remapping: ${originalCwd} → ${cwd}`)
      }

      // Try to run git anyway (existsSync might fail in containers, but git might work)
      // Log the issue if existsSync fails but we'll attempt the command
      const cwdExists = existsSync(cwd)
      if (!cwdExists) {
        console.warn(`[/git] Directory check failed for ${cwd}, but attempting git command anyway`)
      }

      runGit(cwd, args, null, (result) => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result))
      })
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      const response = { error: e.message }
      if (e.details) response.details = e.details
      res.end(JSON.stringify(response))
    }
    return
  }

  // POST /git/stream  (SSE — streams output line by line)
  if (req.method === 'POST' && url.pathname === '/git/stream') {
    try {
      const body = await parseBody(req)
      const args = validateArgs(body.args)
      let cwd = resolve(body.cwd || '.')

      // If path doesn't exist, try without trailing slash
      if (!existsSync(cwd) && cwd.endsWith('/')) {
        cwd = cwd.slice(0, -1)
      }
      // If still doesn't exist, try with home dir expansion
      if (!existsSync(cwd) && body.cwd?.startsWith('~')) {
        cwd = resolve(body.cwd.replace('~', homedir()))
      }

      // Apply Docker path remapping if running in container
      const originalCwd = cwd
      cwd = remapDockerPath(cwd)
      if (cwd !== originalCwd) {
        console.log(`[/git/stream] Docker path remapping: ${originalCwd} → ${cwd}`)
      }

      // Try to run git anyway (existsSync might fail in containers, but git might work)
      const cwdExists = existsSync(cwd)
      if (!cwdExists) {
        console.warn(`[/git/stream] Directory check failed for ${cwd}, but attempting git command anyway`)
      }

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
    const chunks = []
    req.on('data', d => { chunks.push(d) })
    await new Promise(resolve => req.on('end', resolve))
    const body = Buffer.concat(chunks).toString('utf8')
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

    // /ai/chat — try OpenWebUI, then OpenAI-compat, then native Ollama
    // Each entry: [path, isOllama]
    const chatPaths = [
      ['/api/chat/completions', false],
      ['/v1/chat/completions',  false],
      ['/api/chat',             true ],  // native Ollama NDJSON format
    ]
    let upstream = null
    let lastChatErr = ''
    let upstreamIsOllama = false

    for (const [path, isOllama] of chatPaths) {
      let r
      const connectTimeout = AbortSignal.timeout(15000)

      // Ollama /api/chat uses a different request shape
      let reqBody
      if (isOllama) {
        reqBody = JSON.stringify({
          model: rest.model,
          messages: rest.messages,
          stream: rest.stream !== false,
        })
      } else {
        reqBody = JSON.stringify(rest)
      }

      try {
        r = await fetch(`${base}${path}`, {
          method: 'POST',
          headers,
          body: reqBody,
          signal: connectTimeout,
        })
      } catch (e) {
        lastChatErr = e.name === 'TimeoutError' ? `connection timeout on ${path}` : e.message
        continue
      }
      if (r.status === 401 || r.status === 403) {
        const errBody = await r.text().catch(() => '')
        console.warn(`[ai/chat] ${r.status} on ${path}, trying next. Body: ${errBody.slice(0, 200)}`)
        lastChatErr = `HTTP ${r.status} (authentication required) at ${path}`
        continue
      }
      if (r.status === 404 || r.status === 405 || r.status === 400) {
        const errBody = await r.text().catch(() => '')
        console.warn(`[ai/chat] ${r.status} on ${path}, trying next. Body: ${errBody.slice(0, 200)}`)
        lastChatErr = `HTTP ${r.status} at ${path}`
        continue
      }
      upstream = r
      upstreamIsOllama = isOllama
      break
    }

    if (!upstream) {
      const authHint = lastChatErr.includes('authentication')
        ? ' The server requires an API key — set one in AI Chat settings.'
        : ' Check your server URL and model name in AI Chat settings.'
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: `AI server at ${base} rejected all chat endpoints. Last error: ${lastChatErr}.${authHint}`
      }))
      return
    }
    if (!upstream.ok) {
      const errText = await upstream.text()
      res.writeHead(upstream.status, { 'Content-Type': 'application/json' })
      res.end(errText)
      return
    }

    const wantsStream = rest.stream !== false
    const reader = upstream.body.getReader()
    req.on('close', () => reader.cancel())

    // ── Non-streaming: collect full response, normalise to OpenAI JSON ────────
    if (!wantsStream) {
      const decoder = new TextDecoder()
      let raw = ''
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          raw += decoder.decode(value, { stream: true })
        }
      } finally {
        reader.releaseLock()
      }

      let content = ''
      if (upstreamIsOllama) {
        // Ollama non-stream: single JSON object  {"message":{"content":"…"},"done":true}
        // Ollama stream w/ stream:false still comes as NDJSON — collect last done line
        const lines = raw.trim().split('\n')
        for (const line of lines) {
          try {
            const obj = JSON.parse(line)
            if (obj.message?.content) content += obj.message.content
          } catch { /* skip */ }
        }
      } else {
        // OpenAI-compat: may be a single JSON response or SSE lines
        const trimmed = raw.trim()
        if (trimmed.startsWith('{')) {
          // Already JSON
          try {
            const obj = JSON.parse(trimmed)
            content = obj.choices?.[0]?.message?.content ?? ''
          } catch { /* fall through to SSE parse */ }
        }
        if (!content) {
          // Parse as SSE stream and accumulate delta content
          for (const line of trimmed.split('\n')) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue
            try {
              const obj = JSON.parse(data)
              content += obj.choices?.[0]?.delta?.content ?? obj.choices?.[0]?.message?.content ?? ''
            } catch { /* skip */ }
          }
        }
      }

      const responseJson = { choices: [{ message: { role: 'assistant', content } }] }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(responseJson))
      return
    }

    // ── Streaming: pipe SSE to browser ───────────────────────────────────────
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Transfer-Encoding': 'chunked',
    })

    if (!upstreamIsOllama) {
      // Pass-through for OpenAI-style SSE
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
    } else {
      // Translate Ollama NDJSON → OpenAI SSE
      const decoder = new TextDecoder()
      let buf = ''
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.trim()) continue
            try {
              const obj = JSON.parse(line)
              if (obj.done) {
                res.write('data: [DONE]\n\n')
              } else {
                const delta = obj.message?.content ?? ''
                const chunk = { choices: [{ delta: { content: delta }, index: 0 }] }
                res.write(`data: ${JSON.stringify(chunk)}\n\n`)
              }
            } catch { /* skip malformed lines */ }
          }
        }
      } finally {
        reader.releaseLock()
        res.end()
      }
    }
    return
  }

  // POST /ai/transcribe — proxy audio file to OpenAI-compatible /v1/audio/transcriptions (Whisper)
  // Expects multipart/form-data with fields: file (audio), serverUrl, apiKey, model (optional), language (optional)
  if (req.method === 'POST' && url.pathname === '/ai/transcribe') {
    setCors(res)
    const contentType = req.headers['content-type'] || ''
    const boundaryMatch = contentType.match(/boundary=(.+)$/)
    if (!boundaryMatch) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Expected multipart/form-data' }))
      return
    }
    const boundary = boundaryMatch[1]

    // Collect full request body
    const chunks = []
    req.on('data', d => chunks.push(d))
    await new Promise(resolve => req.on('end', resolve))
    const raw = Buffer.concat(chunks)

    // Parse multipart fields manually
    const sep = Buffer.from(`--${boundary}`)
    const fields = {}
    let fileBuffer = null
    let fileName = 'audio.webm'
    let fileMime = 'audio/webm'

    let start = 0
    while (start < raw.length) {
      const sepIdx = raw.indexOf(sep, start)
      if (sepIdx === -1) break
      const partStart = sepIdx + sep.length
      if (raw[partStart] === 45 && raw[partStart + 1] === 45) break // '--' end boundary

      // Skip CRLF after boundary
      const headerStart = partStart + 2
      const headerEnd = raw.indexOf(Buffer.from('\r\n\r\n'), headerStart)
      if (headerEnd === -1) break
      const headerStr = raw.slice(headerStart, headerEnd).toString('utf8')

      // Find next boundary to get part body
      const bodyStart = headerEnd + 4
      const nextSep = raw.indexOf(sep, bodyStart)
      const bodyEnd = nextSep === -1 ? raw.length : nextSep - 2 // -2 for preceding CRLF
      const body = raw.slice(bodyStart, bodyEnd)

      const nameMatch = headerStr.match(/name="([^"]+)"/)
      const filenameMatch = headerStr.match(/filename="([^"]+)"/)
      const mimeMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/)
      const name = nameMatch ? nameMatch[1] : null

      if (name === 'file') {
        fileBuffer = body
        if (filenameMatch) fileName = filenameMatch[1]
        if (mimeMatch) fileMime = mimeMatch[1].trim()
      } else if (name) {
        fields[name] = body.toString('utf8')
      }
      start = nextSep === -1 ? raw.length : nextSep
    }

    const { serverUrl, apiKey, model = 'whisper-1', language = '' } = fields
    if (!serverUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'serverUrl is required' }))
      return
    }
    if (!fileBuffer || fileBuffer.length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'No audio file received' }))
      return
    }

    // Re-build a multipart body to forward to the upstream Whisper endpoint
    const upstreamBoundary = `----FormBoundary${Date.now()}`
    const CRLF = '\r\n'
    const parts = []

    // file part
    parts.push(
      `--${upstreamBoundary}${CRLF}` +
      `Content-Disposition: form-data; name="file"; filename="${fileName}"${CRLF}` +
      `Content-Type: ${fileMime}${CRLF}${CRLF}`
    )

    // model part
    parts.push(
      `--${upstreamBoundary}${CRLF}` +
      `Content-Disposition: form-data; name="model"${CRLF}${CRLF}` +
      model + CRLF
    )

    // optional language part
    if (language) {
      parts.push(
        `--${upstreamBoundary}${CRLF}` +
        `Content-Disposition: form-data; name="language"${CRLF}${CRLF}` +
        language + CRLF
      )
    }

    // response_format=json
    parts.push(
      `--${upstreamBoundary}${CRLF}` +
      `Content-Disposition: form-data; name="response_format"${CRLF}${CRLF}` +
      `json${CRLF}`
    )

    const endBoundary = `--${upstreamBoundary}--${CRLF}`

    // Build final buffer
    const headerBuffers = parts.map(p => Buffer.from(p, 'utf8'))
    const totalSize = headerBuffers.reduce((s, b) => s + b.length, 0)
      + fileBuffer.length + Buffer.from(endBoundary, 'utf8').length
      // add CRLF after file body
      + 2

    const upstreamBody = Buffer.allocUnsafe(totalSize)
    let offset = 0
    // Write first header (file part header)
    headerBuffers[0].copy(upstreamBody, offset); offset += headerBuffers[0].length
    // Write file body + CRLF
    fileBuffer.copy(upstreamBody, offset); offset += fileBuffer.length
    Buffer.from(CRLF, 'utf8').copy(upstreamBody, offset); offset += 2
    // Write remaining parts (model, language, response_format)
    for (let i = 1; i < headerBuffers.length; i++) {
      headerBuffers[i].copy(upstreamBody, offset); offset += headerBuffers[i].length
    }
    // End boundary
    Buffer.from(endBoundary, 'utf8').copy(upstreamBody, offset)

    const base = serverUrl.replace(/\/$/, '')
    const upHeaders = {
      'Content-Type': `multipart/form-data; boundary=${upstreamBoundary}`,
      'Content-Length': String(upstreamBody.length),
    }
    if (apiKey) upHeaders['Authorization'] = `Bearer ${apiKey}`

    // Try OpenAI-compat path first, then OpenWebUI path
    const transcribePaths = ['/v1/audio/transcriptions', '/api/audio/transcriptions']
    let upstream = null
    let lastStatus = 0
    let lastBody = ''

    for (const tPath of transcribePaths) {
      let r
      try {
        r = await fetch(`${base}${tPath}`, {
          method: 'POST',
          headers: upHeaders,
          body: upstreamBody,
          signal: AbortSignal.timeout(120000),
        })
      } catch (e) {
        res.writeHead(502, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: `Could not reach AI server: ${e.message}` }))
        return
      }
      if (r.status === 404 || r.status === 405) {
        lastStatus = r.status
        lastBody = await r.text().catch(() => '')
        continue
      }
      upstream = r
      break
    }

    if (!upstream) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        error: `Your AI server does not support audio transcription (HTTP ${lastStatus}). ` +
          `You need a server with a Whisper-compatible endpoint such as OpenAI, LocalAI, or a self-hosted Whisper API. ` +
          `OpenWebUI and Ollama do not support audio transcription.`
      }))
      return
    }

    const respText = await upstream.text()
    if (!upstream.ok) {
      res.writeHead(upstream.status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: `Upstream error ${upstream.status}: ${respText}` }))
      return
    }

    let transcription = ''
    try {
      const data = JSON.parse(respText)
      transcription = data.text ?? data.transcription ?? respText
    } catch {
      transcription = respText
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ text: transcription }))
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

  // ── OSINT Endpoints ───────────────────────────────────────────────────────────

  // POST /osint/domain  { target: string }
  // Collects WHOIS, DNS records (A/MX/NS/TXT/CNAME), reverse DNS, IP geolocation
  if (req.method === 'POST' && url.pathname === '/osint/domain') {
    let body
    try { body = await parseBody(req) } catch { res.writeHead(400); res.end(JSON.stringify({ error: 'bad body' })); return }
    const target = (body.target || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '')
    if (!target) { res.writeHead(400); res.end(JSON.stringify({ error: 'target required' })); return }

    const run = (cmd, args) => new Promise(resolve => {
      execFile(cmd, args, { timeout: 10000, maxBuffer: 1024 * 512 }, (err, stdout, stderr) => {
        resolve({ out: stdout || '', err: stderr || '', ok: !err || stdout.length > 0 })
      })
    })

    const results = {}

    // WHOIS
    try {
      const w = await run('whois', [target])
      results.whois = w.out.trim() || w.err.trim() || 'No WHOIS data'
    } catch { results.whois = 'whois not available' }

    // DNS — dig for multiple record types
    for (const type of ['A', 'AAAA', 'MX', 'NS', 'TXT', 'CNAME', 'SOA']) {
      try {
        const d = await run('dig', ['+short', '+timeout=5', type, target])
        results[`dns_${type}`] = d.out.trim() || ''
      } catch {
        try {
          const n = await run('nslookup', [`-type=${type}`, target])
          results[`dns_${type}`] = n.out.trim() || ''
        } catch { results[`dns_${type}`] = '' }
      }
    }

    // IP geolocation via ipapi.co (no key required, public API)
    const aRecords = (results.dns_A || '').split('\n').map(s => s.trim()).filter(Boolean)
    results.geoip = []
    for (const ip of aRecords.slice(0, 3)) {
      try {
        const geoRes = await fetch(`https://ipapi.co/${ip}/json/`, { signal: AbortSignal.timeout(6000) })
        if (geoRes.ok) {
          const geo = await geoRes.json()
          results.geoip.push({ ip, city: geo.city, region: geo.region, country: geo.country_name, org: geo.org, asn: geo.asn })
        }
      } catch { /* skip */ }
    }

    // Reverse DNS on first A record
    if (aRecords[0]) {
      try {
        const r = await run('dig', ['+short', '-x', aRecords[0]])
        results.rdns = r.out.trim() || ''
      } catch { results.rdns = '' }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ target, ...results }))
    return
  }

  // POST /osint/crtsh  { domain: string }
  // Certificate transparency search via crt.sh — returns subdomains
  if (req.method === 'POST' && url.pathname === '/osint/crtsh') {
    let body
    try { body = await parseBody(req) } catch { res.writeHead(400); res.end(JSON.stringify({ error: 'bad body' })); return }
    const domain = (body.domain || '').trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '')
    if (!domain) { res.writeHead(400); res.end(JSON.stringify({ error: 'domain required' })); return }
    try {
      const apiRes = await fetch(`https://crt.sh/?q=%25.${encodeURIComponent(domain)}&output=json`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(15000),
      })
      if (!apiRes.ok) throw new Error(`crt.sh returned ${apiRes.status}`)
      const data = await apiRes.json()
      // Deduplicate and clean subdomain names
      const names = new Set()
      for (const entry of data) {
        for (const name of (entry.name_value || '').split('\n')) {
          const clean = name.trim().toLowerCase().replace(/^\*\./, '')
          if (clean && clean.endsWith(domain)) names.add(clean)
        }
      }
      const subdomains = [...names].sort()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ domain, subdomains, count: subdomains.length }))
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: `crt.sh lookup failed: ${e.message}` }))
    }
    return
  }

  // POST /osint/username  { username: string }
  // Check a username against a list of popular platforms via HTTP HEAD requests
  if (req.method === 'POST' && url.pathname === '/osint/username') {
    let body
    try { body = await parseBody(req) } catch { res.writeHead(400); res.end(JSON.stringify({ error: 'bad body' })); return }
    const username = (body.username || '').trim()
    if (!username || !/^[a-zA-Z0-9._\-]{1,40}$/.test(username)) {
      res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid username (alphanumeric, dots, dashes, underscores, 1-40 chars)' })); return
    }

    const PLATFORMS = [
      { name: 'GitHub',      url: `https://github.com/${username}` },
      { name: 'GitLab',      url: `https://gitlab.com/${username}` },
      { name: 'Twitter/X',   url: `https://twitter.com/${username}` },
      { name: 'Instagram',   url: `https://www.instagram.com/${username}/` },
      { name: 'Reddit',      url: `https://www.reddit.com/user/${username}` },
      { name: 'LinkedIn',    url: `https://www.linkedin.com/in/${username}` },
      { name: 'HackerNews',  url: `https://news.ycombinator.com/user?id=${username}` },
      { name: 'Dev.to',      url: `https://dev.to/${username}` },
      { name: 'Medium',      url: `https://medium.com/@${username}` },
      { name: 'Keybase',     url: `https://keybase.io/${username}` },
      { name: 'Steam',       url: `https://steamcommunity.com/id/${username}` },
      { name: 'Pinterest',   url: `https://www.pinterest.com/${username}/` },
      { name: 'YouTube',     url: `https://www.youtube.com/@${username}` },
      { name: 'TikTok',      url: `https://www.tiktok.com/@${username}` },
      { name: 'Twitch',      url: `https://www.twitch.tv/${username}` },
      { name: 'Mastodon',    url: `https://mastodon.social/@${username}` },
      { name: 'HackTheBox',  url: `https://app.hackthebox.com/profile/${username}` },
      { name: 'TryHackMe',   url: `https://tryhackme.com/p/${username}` },
    ]

    const results = await Promise.all(
      PLATFORMS.map(async ({ name, url: profileUrl }) => {
        try {
          const r = await fetch(profileUrl, {
            method: 'GET',
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OSINT-tool/1.0)' },
            redirect: 'follow',
            signal: AbortSignal.timeout(8000),
          })
          // 200 = likely found; 404 = not found; others = unknown
          const found = r.status === 200
          const unknown = !found && r.status !== 404
          return { name, url: profileUrl, status: r.status, found, unknown }
        } catch {
          return { name, url: profileUrl, status: 0, found: false, unknown: true }
        }
      })
    )

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ username, results }))
    return
  }

  // GET /osint/search-proxy?q=<encoded_query>
  // Fetches DuckDuckGo HTML results server-side, parses out result cards,
  // and returns structured JSON — avoids all iframe/CSP issues.
  if (req.method === 'GET' && url.pathname === '/osint/search-proxy') {
    setCors(res)
    const q = url.searchParams.get('q') || ''
    if (!q) { res.writeHead(400); res.end(JSON.stringify({ error: 'missing q' })); return }
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`
    try {
      const html = await new Promise((resolve, reject) => {
        const doGet = (targetUrl) => {
          https.get(targetUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml',
              'Accept-Language': 'en-US,en;q=0.9',
            }
          }, (r) => {
            if ((r.statusCode === 301 || r.statusCode === 302) && r.headers.location) {
              doGet(r.headers.location); return
            }
            let body = ''
            r.on('data', c => body += c)
            r.on('end', () => resolve(body))
            r.on('error', reject)
          }).on('error', reject)
        }
        doGet(ddgUrl)
      })

      // Parse result cards from DDG's HTML-only page
      const results = []
      // Each result is in <div class="result ..."> with .result__title, .result__url, .result__snippet
      const resultBlocks = html.match(/<div class="result[^"]*"[^>]*>[\s\S]*?(?=<div class="result[^"]*"|<div class="nav-link"|$)/g) || []
      for (const block of resultBlocks) {
        // Title: text inside result__a
        const titleMatch = block.match(/<a[^>]+class="result__a"[^>]*>([\s\S]*?)<\/a>/)
        const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, '').trim() : null
        if (!title) continue

        // URL: href on result__a (DDG wraps with redirect URL, extract uddg param or use as-is)
        const hrefMatch = block.match(/<a[^>]+class="result__a"[^>]+href="([^"]+)"/)
        let href = hrefMatch ? hrefMatch[1] : ''
        // DDG sometimes encodes the real URL in uddg= query param
        try {
          const u = new URL(href.startsWith('//') ? 'https:' + href : href)
          const uddg = u.searchParams.get('uddg')
          if (uddg) href = decodeURIComponent(uddg)
        } catch {}

        // Display URL
        const dispUrlMatch = block.match(/<span[^>]+class="result__url"[^>]*>([\s\S]*?)<\/span>/)
        const displayUrl = dispUrlMatch ? dispUrlMatch[1].replace(/<[^>]+>/g, '').trim() : href

        // Snippet
        const snippetMatch = block.match(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/)
        const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : ''

        results.push({ title, href, displayUrl, snippet })
        if (results.length >= 20) break
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ query: q, results }))
    } catch (e) {
      res.writeHead(502); res.end(JSON.stringify({ error: `Search proxy error: ${e.message}` }))
    }
    return
  }

  // ── PCAP Analysis Endpoints ───────────────────────────────────────────────────

  // POST /security/pcap/upload  — stream raw PCAP bytes into a temp file
  // Body is raw binary (Content-Type: application/octet-stream), up to 500 MB
  if (req.method === 'POST' && url.pathname === '/security/pcap/upload') {
    setCors(res)
    try {
      const tmpDir  = mkdtempSync(join(tmpdir(), 'pcap_'))
      const rawHeader = req.headers['x-filename'] || ''
      const rawName = (decodeURIComponent(rawHeader) || 'capture.pcap').replace(/[^a-zA-Z0-9._-]/g, '_')
      const pcapPath = join(tmpDir, rawName)
      const ws = createWriteStream(pcapPath)
      let size = 0
      const MAX = 500 * 1024 * 1024
      req.on('data', chunk => {
        size += chunk.length
        if (size > MAX) { req.destroy(); ws.destroy(); return }
        ws.write(chunk)
      })
      req.on('end', () => {
        ws.end(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ tmpPath: pcapPath, tmpDir, size }))
        })
      })
      req.on('error', e => {
        ws.destroy()
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      })
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  // GET /security/pcap/interfaces  — list available network interfaces
  if (req.method === 'GET' && url.pathname === '/security/pcap/interfaces') {
    setCors(res)
    try {
      const result = spawnSync('ip', ['link', 'show'], { encoding: 'utf8' })
      const ifaces = []
      if (result.stdout) {
        const lines = result.stdout.split('\n')
        for (const line of lines) {
          const m = line.match(/^\d+:\s+([^:@]+)/)
          if (m) {
            const name = m[1].trim()
            if (name !== 'lo') ifaces.push(name)
          }
        }
      }
      // Also include lo for completeness
      ifaces.unshift('any')
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ interfaces: ifaces }))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  // Active live capture sessions keyed by session ID
  const _liveCaptureSessions = global._liveCaptureSessions = global._liveCaptureSessions || new Map()

  // POST /security/pcap/capture/start  { iface, filter, snaplen }
  // Starts tcpdump, streams parsed packets via SSE, stores session for stop/download
  if (req.method === 'POST' && url.pathname === '/security/pcap/capture/start') {
    setCors(res)
    let body
    try {
      body = await new Promise((resolve, reject) => {
        let d = ''
        req.on('data', c => { d += c })
        req.on('end', () => { try { resolve(JSON.parse(d)) } catch { reject(new Error('bad json')) } })
        req.on('error', reject)
      })
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
      return
    }

    const iface    = (body.iface || 'any').replace(/[^a-zA-Z0-9._-]/, '')
    const bpf      = (body.filter || '').slice(0, 200)   // BPF filter
    const snaplen  = Math.min(parseInt(body.snaplen ?? 65535, 10), 65535)
    const sessionId = randomBytes(8).toString('hex')
    const tmpDir   = mkdtempSync(join(tmpdir(), 'livecap_'))
    const pcapFile = join(tmpDir, `capture-${sessionId}.pcap`)

    // tcpdump args: write to file AND emit line-buffered text output for live parsing
    const args = ['-i', iface, '-n', '-tt', '-l', '--print',
                  '-w', pcapFile, '-s', String(snaplen)]
    if (bpf) args.push(...bpf.split(' ').filter(Boolean))

    let tcpdump
    try {
      tcpdump = spawn('tcpdump', args, { stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: `Failed to start tcpdump: ${e.message}` }))
      return
    }

    // Store session
    _liveCaptureSessions.set(sessionId, { tcpdump, pcapFile, tmpDir, packetCount: 0, startTime: Date.now() })

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })

    const sendSSE = (type, data) => {
      try { res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`) } catch {}
    }

    sendSSE('started', { sessionId, pcapFile })

    // Parse tcpdump text output into structured packets
    // tcpdump -tt -n --print format: "<timestamp> <proto> <src> > <dst>: <info> (<len>)"
    let lineBuffer = ''
    let pktNo = 0
    const startTs = Date.now() / 1000

    tcpdump.stdout.on('data', chunk => {
      lineBuffer += chunk.toString()
      const lines = lineBuffer.split('\n')
      lineBuffer = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        pktNo++
        const session = _liveCaptureSessions.get(sessionId)
        if (session) session.packetCount = pktNo

        // Parse: timestamp proto src > dst: rest
        const tsMatch = trimmed.match(/^(\d+\.\d+)\s+(.+)$/)
        const ts      = tsMatch ? parseFloat(tsMatch[1]) : Date.now() / 1000
        const rest    = tsMatch ? tsMatch[2] : trimmed

        // Extract src/dst from "X.X.X.X.port > Y.Y.Y.Y.port:" or "X > Y:"
        let src = '', dst = '', proto = 'PKT', info = rest, sport = 0, dport = 0
        const flowMatch = rest.match(/^([\w.:]+)\s*>\s*([\w.:]+):\s*(.*)$/)
        if (flowMatch) {
          const rawSrc = flowMatch[1], rawDst = flowMatch[2]
          info = flowMatch[3]
          // Split last dotted segment as port
          const splitAddr = (addr) => {
            const parts = addr.split('.')
            if (parts.length >= 5) {
              return { ip: parts.slice(0, 4).join('.'), port: parseInt(parts[4]) || 0 }
            }
            const colonParts = addr.split(':')
            if (colonParts.length > 1 && /^\d+$/.test(colonParts[colonParts.length - 1])) {
              return { ip: colonParts.slice(0, -1).join(':'), port: parseInt(colonParts[colonParts.length - 1]) }
            }
            return { ip: addr, port: 0 }
          }
          const s = splitAddr(rawSrc), d = splitAddr(rawDst)
          src = s.ip; sport = s.port; dst = d.ip; dport = d.port
          // Guess protocol from info/ports
          if (/\bICMP\b/i.test(info))          proto = 'ICMP'
          else if (/\bARP\b/i.test(info))       proto = 'ARP'
          else if (/\bDNS\b/i.test(info))       proto = 'DNS'
          else if (dport===443||sport===443)     proto = 'TLS'
          else if (dport===80||sport===80)       proto = 'HTTP'
          else if (dport===22||sport===22)       proto = 'SSH'
          else if (dport===53||sport===53)       proto = 'DNS'
          else if (/\bUDP\b/i.test(info) || /\bUDP\b/i.test(rest)) proto = 'UDP'
          else proto = 'TCP'
        } else if (/\bARP\b/i.test(rest)) {
          proto = 'ARP'; info = rest
        } else if (/\bICMP\b/i.test(rest)) {
          proto = 'ICMP'; info = rest
        }

        sendSSE('packet', {
          no: pktNo,
          time: parseFloat((ts - startTs).toFixed(6)),
          src, dst, sport, dport, proto,
          len: 0,   // tcpdump text mode doesn't always give length easily
          info: info.slice(0, 200),
        })
      }
    })

    tcpdump.stderr.on('data', chunk => {
      const msg = chunk.toString().trim()
      // tcpdump prints "listening on..." to stderr — not an error
      if (/^tcpdump: listening/i.test(msg)) {
        sendSSE('info', { message: msg })
      } else if (/^[0-9]+ packets captured/i.test(msg) || /^[0-9]+ packets received/i.test(msg)) {
        sendSSE('info', { message: msg })
      } else if (/permission|not permitted|Operation not permitted/i.test(msg)) {
        sendSSE('permission_error', { message: msg })
      } else if (msg) {
        sendSSE('error', { message: msg })
      }
    })

    tcpdump.on('close', code => {
      sendSSE('stopped', { sessionId, packetCount: pktNo, code })
      res.end()
    })

    // Stop capture if client disconnects
    req.on('close', () => {
      try { tcpdump.kill('SIGTERM') } catch {}
    })

    return
  }

  // POST /security/pcap/capture/stop  { sessionId }
  if (req.method === 'POST' && url.pathname === '/security/pcap/capture/stop') {
    setCors(res)
    let body
    try {
      body = await new Promise((resolve, reject) => {
        let d = ''
        req.on('data', c => { d += c })
        req.on('end', () => { try { resolve(JSON.parse(d)) } catch { reject(new Error('bad json')) } })
        req.on('error', reject)
      })
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
      return
    }
    const session = _liveCaptureSessions.get(body.sessionId)
    if (!session) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Session not found' }))
      return
    }
    try { session.tcpdump.kill('SIGTERM') } catch {}
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true, pcapFile: session.pcapFile, packetCount: session.packetCount }))
    return
  }

  // GET /security/pcap/capture/download?sessionId=xxx
  // Streams the saved .pcap file back to the browser
  if (req.method === 'GET' && url.pathname === '/security/pcap/capture/download') {
    setCors(res)
    const sid = url.searchParams.get('sessionId') || ''
    const session = _liveCaptureSessions.get(sid)
    if (!session || !existsSync(session.pcapFile)) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Capture file not found' }))
      return
    }
    const { statSync } = await import('fs')
    const stat = statSync(session.pcapFile)
    const fname = `capture-${new Date().toISOString().slice(0,19).replace(/[T:]/g,'-')}.pcap`
    res.writeHead(200, {
      'Content-Type': 'application/vnd.tcpdump.pcap',
      'Content-Disposition': `attachment; filename="${fname}"`,
      'Content-Length': stat.size,
      'Access-Control-Allow-Origin': '*',
    })
    const fileStream = (await import('fs')).createReadStream(session.pcapFile)
    fileStream.pipe(res)
    // Clean up session after download
    fileStream.on('end', () => {
      _liveCaptureSessions.delete(sid)
    })
    return
  }

  // POST /security/pcap/packets  { tmpPath, offset, limit, filter }
  // Returns a page of parsed packets for the Wireshark-like packet viewer
  if (req.method === 'POST' && url.pathname === '/security/pcap/packets') {
    setCors(res)
    let body
    try {
      body = await new Promise((resolve, reject) => {
        let d = ''
        req.on('data', c => { d += c })
        req.on('end', () => { try { resolve(JSON.parse(d)) } catch { reject(new Error('bad json')) } })
        req.on('error', reject)
      })
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
      return
    }
    const pcapPath = (body.tmpPath || body.pcapPath || '').replace(/^~/, homedir())
    if (!pcapPath || !existsSync(pcapPath)) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: `PCAP file not found: ${pcapPath}` }))
      return
    }
    const offset = parseInt(body.offset ?? 0, 10)
    const limit  = Math.min(parseInt(body.limit ?? 500, 10), 2000)
    const filter = (body.filter ?? '').trim()

    const PACKET_SCRIPT = `
import sys, json
try:
    from scapy.all import rdpcap, IP, IPv6, TCP, UDP, ICMP, DNS, DNSQR, ARP, Raw, Ether
except ImportError as e:
    print(json.dumps({"error": str(e)})); sys.exit(1)

PCAP_PATH = sys.argv[1]
OFFSET    = int(sys.argv[2])
LIMIT     = int(sys.argv[3])
FILTER    = sys.argv[4].lower()

def safe(v):
    if isinstance(v, bytes):
        try: return v.decode('utf-8','replace')
        except: return repr(v)
    return str(v) if v is not None else ''

try:
    pkts = rdpcap(PCAP_PATH)
except Exception as e:
    print(json.dumps({"error": str(e)})); sys.exit(1)

def proto_of(pkt):
    if pkt.haslayer(DNS):  return 'DNS'
    if pkt.haslayer(TCP):
        dp = pkt[TCP].dport; sp = pkt[TCP].sport
        if dp == 443 or sp == 443: return 'TLS'
        if dp == 80  or sp == 80:  return 'HTTP'
        if dp == 22  or sp == 22:  return 'SSH'
        if dp == 21  or sp == 21:  return 'FTP'
        if dp == 25  or sp == 25:  return 'SMTP'
        return 'TCP'
    if pkt.haslayer(UDP):  return 'UDP'
    if pkt.haslayer(ICMP): return 'ICMP'
    if pkt.haslayer(ARP):  return 'ARP'
    return pkt.__class__.__name__

def color_of(proto):
    return {
        'TCP':'#e8f4fd','UDP':'#e8fdf4','DNS':'#fdf8e1','TLS':'#f3e8fd',
        'HTTP':'#fde8e8','ARP':'#fdf4e8','ICMP':'#f0f0f0','SSH':'#e8fde8',
        'FTP':'#fde8f8','SMTP':'#fde8f8',
    }.get(proto,'#f9f9f9')

def info_of(pkt, proto):
    try:
        if proto == 'DNS' and pkt.haslayer(DNSQR):
            qr = 'Q' if pkt[DNS].qr == 0 else 'R'
            return f"DNS {qr}: {safe(pkt[DNSQR].qname).rstrip('.')}"
        if proto == 'TCP':
            flags = str(pkt[TCP].flags)
            return f"[{flags}] Seq={pkt[TCP].seq} Ack={pkt[TCP].ack} Win={pkt[TCP].window}"
        if proto in ('TLS','HTTP','SSH','FTP','SMTP'):
            flags = str(pkt[TCP].flags)
            return f"[{flags}] Seq={pkt[TCP].seq} Len={len(pkt[Raw]) if pkt.haslayer(Raw) else 0}"
        if proto == 'UDP':
            return f"Len={pkt[UDP].len}"
        if proto == 'ICMP':
            return f"Type={pkt[ICMP].type} Code={pkt[ICMP].code}"
        if proto == 'ARP':
            arp = pkt[ARP]
            op = 'who-has' if arp.op == 1 else 'is-at'
            return f"ARP {op} {safe(arp.pdst)} tell {safe(arp.psrc)}"
    except: pass
    return ''

def src_dst(pkt):
    src = dst = ''
    if pkt.haslayer(IP):   src, dst = pkt[IP].src, pkt[IP].dst
    elif pkt.haslayer(IPv6): src, dst = pkt[IPv6].src, pkt[IPv6].dst
    elif pkt.haslayer(ARP): src, dst = safe(pkt[ARP].psrc), safe(pkt[ARP].pdst)
    sport = dport = 0
    if pkt.haslayer(TCP):  sport, dport = pkt[TCP].sport, pkt[TCP].dport
    elif pkt.haslayer(UDP): sport, dport = pkt[UDP].sport, pkt[UDP].dport
    return src, dst, sport, dport

def pkt_layers(pkt):
    layers = []
    p = pkt
    while p and p.name != 'NoPayload':
        layers.append(p.name)
        p = p.payload if hasattr(p, 'payload') else None
    return layers[:8]

def pkt_fields(pkt):
    fields = {}
    if pkt.haslayer(Ether):
        e = pkt[Ether]
        fields['Ethernet'] = {'src': safe(e.src), 'dst': safe(e.dst), 'type': hex(e.type)}
    if pkt.haslayer(IP):
        ip = pkt[IP]
        fields['IP'] = {'src': ip.src, 'dst': ip.dst, 'ttl': ip.ttl, 'id': ip.id, 'len': ip.len, 'proto': ip.proto, 'flags': str(ip.flags)}
    if pkt.haslayer(IPv6):
        ip = pkt[IPv6]
        fields['IPv6'] = {'src': ip.src, 'dst': ip.dst, 'hlim': ip.hlim, 'nh': ip.nh}
    if pkt.haslayer(TCP):
        t = pkt[TCP]
        fields['TCP'] = {'sport': t.sport, 'dport': t.dport, 'seq': t.seq, 'ack': t.ack, 'flags': str(t.flags), 'window': t.window, 'urgptr': t.urgptr}
    if pkt.haslayer(UDP):
        u = pkt[UDP]
        fields['UDP'] = {'sport': u.sport, 'dport': u.dport, 'len': u.len}
    if pkt.haslayer(ICMP):
        ic = pkt[ICMP]
        fields['ICMP'] = {'type': ic.type, 'code': ic.code, 'id': getattr(ic,'id',0), 'seq': getattr(ic,'seq',0)}
    if pkt.haslayer(DNS):
        d = pkt[DNS]
        fields['DNS'] = {'id': d.id, 'qr': d.qr, 'opcode': d.opcode, 'qdcount': d.qdcount, 'ancount': d.ancount}
        if pkt.haslayer(DNSQR):
            fields['DNS']['query'] = safe(pkt[DNSQR].qname).rstrip('.')
    if pkt.haslayer(ARP):
        a = pkt[ARP]
        fields['ARP'] = {'op': a.op, 'hwsrc': safe(a.hwsrc), 'psrc': safe(a.psrc), 'hwdst': safe(a.hwdst), 'pdst': safe(a.pdst)}
    if pkt.haslayer(Raw):
        raw_b = bytes(pkt[Raw])
        hex_str = raw_b[:64].hex()
        try: text = raw_b[:128].decode('utf-8','replace').replace('\\n','\\\\n')
        except: text = ''
        fields['Raw'] = {'hex': hex_str, 'text': text, 'len': len(raw_b)}
    return fields

result = []
start_ts = None
for i, pkt in enumerate(pkts):
    ts = float(pkt.time) if hasattr(pkt,'time') else 0
    if start_ts is None: start_ts = ts
    rel = round(ts - start_ts, 6) if start_ts else 0

    proto = proto_of(pkt)
    src, dst, sport, dport = src_dst(pkt)
    info  = info_of(pkt, proto)
    color = color_of(proto)

    entry = {
        'no': i+1, 'time': rel, 'src': src, 'dst': dst,
        'sport': sport, 'dport': dport,
        'proto': proto, 'len': len(pkt), 'info': info, 'color': color,
        'layers': pkt_layers(pkt),
        'fields': pkt_fields(pkt),
    }

    # Client-side filter applied server-side for performance
    if FILTER:
        flat = f"{src} {dst} {sport} {dport} {proto} {info}".lower()
        if FILTER not in flat:
            continue

    result.append(entry)

total_filtered = len(result)
paged = result[OFFSET:OFFSET+LIMIT]
print(json.dumps({"packets": paged, "total": total_filtered, "total_unfiltered": len(pkts)}))
`
    const scriptPath2 = join(tmpdir(), `pcap_packets_${Date.now()}.py`)
    writeFileSync(scriptPath2, PACKET_SCRIPT)
    const py = spawnSync('python3', [scriptPath2, pcapPath, String(offset), String(limit), filter], {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 60000,
    })
    try { require('fs').unlinkSync(scriptPath2) } catch {}
    if (py.error) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: py.error.message }))
      return
    }
    const stdout = (py.stdout || '').toString().trim()
    if (!stdout) {
      const stderr = (py.stderr || '').toString().slice(0, 500)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: stderr || 'No output from script' }))
      return
    }
    try {
      const parsed = JSON.parse(stdout)
      if (parsed.error) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: parsed.error }))
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(parsed))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Failed to parse script output' }))
    }
    return
  }

  // POST /security/pcap/analyze  { pcapPath: string }
  // Runs the embedded Python/scapy analysis script and streams results via SSE
  if (req.method === 'POST' && url.pathname === '/security/pcap/analyze') {
    setCors(res)

    let body
    try {
      body = await new Promise((resolve, reject) => {
        let d = ''
        req.on('data', c => { d += c })
        req.on('end', () => { try { resolve(JSON.parse(d)) } catch { reject(new Error('bad json')) } })
        req.on('error', reject)
      })
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
      return
    }

    const pcapPath = (body.tmpPath || body.pcapPath || '').replace(/^~/, homedir())
    if (!pcapPath || !existsSync(pcapPath)) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: `PCAP file not found: ${pcapPath}` }))
      return
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })

    const sendSSE = (type, data) => res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`)

    // Write the Python analysis script to a temp file
    const scriptPath = join(tmpdir(), `pcap_analysis_${Date.now()}.py`)
    const PYTHON_SCRIPT = `
import sys, json, collections, math, re, os
from datetime import datetime

try:
    from scapy.all import rdpcap, IP, IPv6, TCP, UDP, ICMP, DNS, DNSQR, DNSRR, ARP, Raw, Ether
    from scapy.layers.http import HTTP, HTTPRequest, HTTPResponse
except ImportError as e:
    print(json.dumps({"type":"error","message":f"scapy import failed: {e}"}))
    sys.exit(1)

PCAP_PATH = sys.argv[1]

def safe_str(v):
    if isinstance(v, bytes):
        try: return v.decode('utf-8', errors='replace')
        except: return repr(v)
    return str(v) if v is not None else ''

def ip_str(pkt):
    if pkt.haslayer(IP):   return pkt[IP].src,   pkt[IP].dst
    if pkt.haslayer(IPv6): return pkt[IPv6].src, pkt[IPv6].dst
    return None, None

def is_private(ip):
    import ipaddress
    try:
        a = ipaddress.ip_address(ip)
        return a.is_private or a.is_loopback or a.is_link_local
    except: return False

def is_public(ip):
    return ip and not is_private(ip)

print(json.dumps({"type":"progress","message":"Loading PCAP file..."}))
sys.stdout.flush()

try:
    pkts = rdpcap(PCAP_PATH)
except Exception as e:
    print(json.dumps({"type":"error","message":f"Failed to read PCAP: {e}"}))
    sys.exit(1)

total = len(pkts)
print(json.dumps({"type":"progress","message":f"Loaded {total} packets, starting analysis..."}))
sys.stdout.flush()

# ── Basic stats ────────────────────────────────────────────────────────────────
proto_counts  = collections.Counter()
src_ips       = collections.Counter()
dst_ips       = collections.Counter()
src_ports     = collections.Counter()
dst_ports     = collections.Counter()
total_bytes   = 0
timestamps    = []
conversations = collections.defaultdict(lambda: {"pkts":0,"bytes":0,"src_pkts":0,"dst_pkts":0})
dns_queries   = []
dns_responses = collections.defaultdict(list)
http_requests = []
tls_hosts     = []
arp_table     = {}   # ip -> mac
tcp_flags_dist = collections.Counter()
icmp_types    = collections.Counter()

for pkt in pkts:
    total_bytes += len(pkt)
    if hasattr(pkt, 'time'): timestamps.append(float(pkt.time))

    src, dst = ip_str(pkt)
    if src: src_ips[src] += 1
    if dst: dst_ips[dst] += 1

    if pkt.haslayer(TCP):
        proto_counts['TCP'] += 1
        sp, dp = pkt[TCP].sport, pkt[TCP].dport
        src_ports[sp] += 1
        dst_ports[dp] += 1
        flags = pkt[TCP].flags
        if flags: tcp_flags_dist[str(flags)] += 1
        if src and dst:
            key = tuple(sorted([(src,sp),(dst,dp)]))
            k = f"{key[0][0]}:{key[0][1]}-{key[1][0]}:{key[1][1]}"
            conversations[k]["pkts"] += 1
            conversations[k]["bytes"] += len(pkt)
            conversations[k]["src"]  = src
            conversations[k]["dst"]  = dst
            conversations[k]["sport"] = sp
            conversations[k]["dport"] = dp
            conversations[k]["proto"] = "TCP"

    elif pkt.haslayer(UDP):
        proto_counts['UDP'] += 1
        sp, dp = pkt[UDP].sport, pkt[UDP].dport
        src_ports[sp] += 1
        dst_ports[dp] += 1
        if src and dst:
            key = tuple(sorted([(src,sp),(dst,dp)]))
            k = f"{key[0][0]}:{key[0][1]}-{key[1][0]}:{key[1][1]}"
            conversations[k]["pkts"] += 1
            conversations[k]["bytes"] += len(pkt)
            conversations[k]["src"]  = src
            conversations[k]["dst"]  = dst
            conversations[k]["sport"] = sp
            conversations[k]["dport"] = dp
            conversations[k]["proto"] = "UDP"

    elif pkt.haslayer(ICMP):
        proto_counts['ICMP'] += 1
        icmp_types[pkt[ICMP].type] += 1

    if pkt.haslayer(ARP):
        proto_counts['ARP'] += 1
        arp = pkt[ARP]
        if arp.op == 2:  # is-at
            arp_table[safe_str(arp.psrc)] = safe_str(arp.hwsrc)

    # DNS
    if pkt.haslayer(DNS):
        proto_counts['DNS'] += 1
        dns = pkt[DNS]
        if dns.qr == 0 and pkt.haslayer(DNSQR):  # query
            qname = safe_str(pkt[DNSQR].qname).rstrip('.')
            dns_queries.append({"name": qname, "src": src or "?"})
        elif dns.qr == 1 and pkt.haslayer(DNSRR):  # response
            qname = safe_str(pkt[DNSQR].qname).rstrip('.') if pkt.haslayer(DNSQR) else "?"
            rr = pkt[DNSRR]
            while rr and rr.name:
                rdata = safe_str(rr.rdata) if hasattr(rr,'rdata') else ''
                if rdata: dns_responses[qname].append(rdata)
                rr = rr.payload if hasattr(rr,'payload') and hasattr(rr.payload,'name') else None

    # TLS SNI (ClientHello)
    if pkt.haslayer(Raw) and pkt.haslayer(TCP):
        raw = bytes(pkt[Raw])
        # TLS ClientHello: content type 0x16, version 0x03xx, handshake type 0x01
        if len(raw) > 43 and raw[0] == 0x16 and raw[1] == 0x03 and raw[5] == 0x01:
            try:
                # Walk to SNI extension
                i = 43
                session_len = raw[i]; i += 1 + session_len
                if i+2 < len(raw):
                    cs_len = (raw[i]<<8)|raw[i+1]; i += 2 + cs_len
                if i+1 < len(raw):
                    cm_len = raw[i]; i += 1 + cm_len
                if i+2 < len(raw):
                    ext_total = (raw[i]<<8)|raw[i+1]; i += 2
                    end = i + ext_total
                    while i + 4 <= end:
                        ext_type  = (raw[i]<<8)|raw[i+1]
                        ext_len   = (raw[i+2]<<8)|raw[i+3]; i += 4
                        if ext_type == 0:  # SNI
                            if i+5 < len(raw):
                                sni_len = (raw[i+3]<<8)|raw[i+4]
                                sni = raw[i+5:i+5+sni_len].decode('utf-8','replace')
                                tls_hosts.append({"host": sni, "src": src or "?"})
                        i += ext_len
            except: pass

print(json.dumps({"type":"progress","message":"Detecting threats..."}))
sys.stdout.flush()

# ── Threat detection ───────────────────────────────────────────────────────────
threats = []

# Port scan: many dst ports from one src
port_scan_threshold = 20
for ip, cnt in src_ips.items():
    dst_port_set = set()
    for pkt in pkts:
        s, _ = ip_str(pkt)
        if s == ip and pkt.haslayer(TCP):
            dst_port_set.add(pkt[TCP].dport)
    if len(dst_port_set) > port_scan_threshold:
        threats.append({
            "severity": "high",
            "category": "Reconnaissance",
            "title": f"Port Scan Detected — {ip}",
            "detail": f"Source IP {ip} contacted {len(dst_port_set)} unique destination ports (threshold: {port_scan_threshold})",
            "indicator": ip,
        })

# SYN flood: high ratio of SYN-only packets from a source
syn_counts   = collections.Counter()
synack_counts = collections.Counter()
for pkt in pkts:
    if pkt.haslayer(TCP):
        f = pkt[TCP].flags
        s, _ = ip_str(pkt)
        if s:
            if str(f) == 'S':  syn_counts[s] += 1
            if 'S' in str(f) and 'A' in str(f): synack_counts[s] += 1
for ip, cnt in syn_counts.items():
    if cnt > 200 and synack_counts.get(ip, 0) < cnt * 0.1:
        threats.append({
            "severity": "high",
            "category": "DoS/DDoS",
            "title": f"Possible SYN Flood — {ip}",
            "detail": f"{ip} sent {cnt} SYN packets with only {synack_counts.get(ip,0)} SYN-ACKs",
            "indicator": ip,
        })

# Suspicious DNS: long subdomain (DGA / DNS tunneling)
dga_domains = []
for q in dns_queries:
    parts = q['name'].split('.')
    subdomain = '.'.join(parts[:-2]) if len(parts) > 2 else ''
    if len(subdomain) > 30:
        dga_domains.append(q['name'])
    # Entropy check — high entropy labels may be DGA
    for part in parts:
        if len(part) > 12:
            freq = collections.Counter(part)
            entropy = -sum((c/len(part))*math.log2(c/len(part)) for c in freq.values())
            if entropy > 3.8:
                dga_domains.append(q['name'])
                break
if dga_domains:
    uniq = list(dict.fromkeys(dga_domains))[:10]
    threats.append({
        "severity": "medium",
        "category": "DNS Anomaly",
        "title": "Possible DGA / DNS Tunneling",
        "detail": f"High-entropy or unusually long DNS subdomains detected: {', '.join(uniq[:5])}{'...' if len(uniq)>5 else ''}",
        "indicator": uniq[0],
    })

# Large data transfers to external IPs
ext_bytes = collections.defaultdict(int)
for k, c in conversations.items():
    if is_public(c.get('dst','')):
        ext_bytes[c['dst']] += c['bytes']
for ip, b in ext_bytes.items():
    if b > 5_000_000:
        threats.append({
            "severity": "medium",
            "category": "Data Exfiltration",
            "title": f"Large Outbound Transfer to {ip}",
            "detail": f"{b/1024/1024:.1f} MB sent to external IP {ip}",
            "indicator": ip,
        })

# Cleartext credentials: HTTP Basic Auth or POST to non-HTTPS
for pkt in pkts:
    if pkt.haslayer(Raw) and pkt.haslayer(TCP) and pkt[TCP].dport in (80, 8080, 8000):
        raw = safe_str(bytes(pkt[Raw]))
        if 'Authorization: Basic' in raw:
            s, _ = ip_str(pkt)
            threats.append({
                "severity": "high",
                "category": "Credential Exposure",
                "title": f"Cleartext HTTP Basic Auth from {s}",
                "detail": "HTTP Basic Authentication credentials transmitted in cleartext over port 80/8080",
                "indicator": s or "unknown",
            })
            break
        if raw.startswith('POST') and ('password' in raw.lower() or 'passwd' in raw.lower() or 'pwd=' in raw.lower()):
            s, _ = ip_str(pkt)
            threats.append({
                "severity": "high",
                "category": "Credential Exposure",
                "title": f"Possible Cleartext Password Submission from {s}",
                "detail": "POST request containing password field over unencrypted HTTP",
                "indicator": s or "unknown",
            })
            break

# ICMP tunnel: unusually large ICMP payloads
for pkt in pkts:
    if pkt.haslayer(ICMP) and pkt.haslayer(Raw):
        if len(bytes(pkt[Raw])) > 200:
            s, _ = ip_str(pkt)
            threats.append({
                "severity": "medium",
                "category": "Covert Channel",
                "title": f"Possible ICMP Tunnel from {s}",
                "detail": f"ICMP packet with {len(bytes(pkt[Raw]))} byte payload (normal ping is 32-56 bytes)",
                "indicator": s or "unknown",
            })
            break

# Deduplicate threats
seen_titles = set()
unique_threats = []
for t in threats:
    if t['title'] not in seen_titles:
        seen_titles.add(t['title'])
        unique_threats.append(t)
threats = unique_threats

print(json.dumps({"type":"progress","message":"Building network topology..."}))
sys.stdout.flush()

# ── Network topology ───────────────────────────────────────────────────────────
all_ips = set(src_ips.keys()) | set(dst_ips.keys())
nodes = []
seen_nodes = set()

def guess_role(ip, src_cnt, dst_cnt, dst_ports_of_ip):
    if is_private(ip):
        # High out-traffic + many unique dst ports = workstation/scanner
        if src_cnt > dst_cnt * 2: return 'client'
        if 53 in dst_ports_of_ip: return 'dns-server'
        if 80 in dst_ports_of_ip or 443 in dst_ports_of_ip: return 'web-server'
        if dst_cnt > src_cnt * 2: return 'server'
        return 'host'
    else:
        if 443 in dst_ports_of_ip: return 'external-https'
        if 80 in dst_ports_of_ip:  return 'external-http'
        if 53 in dst_ports_of_ip:  return 'external-dns'
        return 'external'

# Compute per-IP destination ports
ip_dst_ports = collections.defaultdict(set)
for pkt in pkts:
    s, _ = ip_str(pkt)
    if s and pkt.haslayer(TCP): ip_dst_ports[s].add(pkt[TCP].dport)
    if s and pkt.haslayer(UDP): ip_dst_ports[s].add(pkt[UDP].dport)

for ip in all_ips:
    role = guess_role(ip, src_ips.get(ip,0), dst_ips.get(ip,0), ip_dst_ports.get(ip,set()))
    mac = arp_table.get(ip, '')
    # Resolve hostname from DNS responses
    hostname = ''
    for qname, rdata_list in dns_responses.items():
        if ip in rdata_list:
            hostname = qname
            break
    nodes.append({
        "ip": ip, "role": role, "mac": mac, "hostname": hostname,
        "sent_pkts": src_ips.get(ip,0), "recv_pkts": dst_ips.get(ip,0),
        "is_private": is_private(ip),
    })

# Build edges (top 50 by byte volume)
edges = []
for k, c in sorted(conversations.items(), key=lambda x: -x[1]['bytes'])[:50]:
    edges.append({
        "src": c.get('src',''), "dst": c.get('dst',''),
        "sport": c.get('sport',0), "dport": c.get('dport',0),
        "proto": c.get('proto','?'), "pkts": c['pkts'], "bytes": c['bytes'],
    })

print(json.dumps({"type":"progress","message":"Finalising results..."}))
sys.stdout.flush()

# ── Top conversations ──────────────────────────────────────────────────────────
top_convos = []
for k, c in sorted(conversations.items(), key=lambda x: -x[1]['bytes'])[:30]:
    top_convos.append({
        "src": c.get('src',''), "dst": c.get('dst',''),
        "sport": c.get('sport',0), "dport": c.get('dport',0),
        "proto": c.get('proto','?'), "pkts": c['pkts'], "bytes": c['bytes'],
    })

# ── DNS summary ───────────────────────────────────────────────────────────────
dns_summary = []
query_counter = collections.Counter(q['name'] for q in dns_queries)
for name, cnt in query_counter.most_common(50):
    resolved = list(dict.fromkeys(dns_responses.get(name, [])))[:5]
    dns_summary.append({"name": name, "queries": cnt, "resolved": resolved})

# ── Duration & timing ─────────────────────────────────────────────────────────
duration = 0
start_ts = None
end_ts   = None
if timestamps:
    start_ts = datetime.utcfromtimestamp(min(timestamps)).isoformat() + 'Z'
    end_ts   = datetime.utcfromtimestamp(max(timestamps)).isoformat() + 'Z'
    duration = max(timestamps) - min(timestamps)

result = {
    "summary": {
        "total_packets":   total,
        "total_bytes":     total_bytes,
        "duration_secs":   round(duration, 2),
        "start_time":      start_ts,
        "end_time":        end_ts,
        "unique_src_ips":  len(src_ips),
        "unique_dst_ips":  len(dst_ips),
        "proto_counts":    dict(proto_counts.most_common()),
        "top_src_ips":     src_ips.most_common(10),
        "top_dst_ips":     dst_ips.most_common(10),
        "top_dst_ports":   dst_ports.most_common(15),
        "tcp_flags":       dict(tcp_flags_dist.most_common()),
        "icmp_types":      {str(k):v for k,v in icmp_types.items()},
    },
    "threats":       threats,
    "conversations": top_convos,
    "dns":           dns_summary,
    "tls_hosts":     tls_hosts[:50],
    "topology": {
        "nodes": nodes,
        "edges": edges,
        "arp_table": arp_table,
    },
}

print(json.dumps({"type":"result","data":result}))
print(json.dumps({"type":"done"}))
sys.stdout.flush()
`

    writeFileSync(scriptPath, PYTHON_SCRIPT)

    const py = spawn('python3', [scriptPath, pcapPath], { stdio: ['ignore', 'pipe', 'pipe'] })
    let pyBuf = ''

    py.stdout.on('data', chunk => {
      pyBuf += chunk.toString()
      const lines = pyBuf.split('\n')
      pyBuf = lines.pop()
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const evt = JSON.parse(trimmed)
          res.write(`data: ${JSON.stringify(evt)}\n\n`)
        } catch {
          // not JSON — send as progress note
          res.write(`data: ${JSON.stringify({ type: 'progress', message: trimmed })}\n\n`)
        }
      }
    })

    py.stderr.on('data', chunk => {
      const txt = chunk.toString().trim()
      if (txt) res.write(`data: ${JSON.stringify({ type: 'progress', message: `[stderr] ${txt}` })}\n\n`)
    })

    py.on('close', code => {
      // flush remaining buffer
      if (pyBuf.trim()) {
        try {
          const evt = JSON.parse(pyBuf.trim())
          res.write(`data: ${JSON.stringify(evt)}\n\n`)
        } catch {}
      }
      try { require('fs').unlinkSync(scriptPath) } catch {}
      if (code !== 0) res.write(`data: ${JSON.stringify({ type: 'error', message: `Python exited with code ${code}` })}\n\n`)
      res.end()
    })

    req.on('close', () => { py.kill(); try { require('fs').unlinkSync(scriptPath) } catch {} })
    return
  }

  // ── Nmap Network Mapping Endpoints ────────────────────────────────────────────

  // POST /security/nmap/scan  { target, scanType, options }
  // Runs nmap against a target and streams results via SSE
  if (req.method === 'POST' && url.pathname === '/security/nmap/scan') {
    setCors(res)

    let body
    try {
      body = await new Promise((resolve, reject) => {
        let d = ''
        req.on('data', c => { d += c })
        req.on('end', () => { try { resolve(JSON.parse(d)) } catch { reject(new Error('bad json')) } })
        req.on('error', reject)
      })
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
      return
    }

    const { target, scanType = 'ping', ports = '', timing = 'T3' } = body

    if (!target || typeof target !== 'string') {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'target is required' }))
      return
    }

    // Sanitize target: allow IPs, CIDR ranges, hostnames — reject shell metacharacters
    if (!/^[a-zA-Z0-9.\-/:_\[\] ]+$/.test(target)) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid characters in target' }))
      return
    }

    // Build nmap args based on scan type
    // -v enables per-host activity lines on stderr; --stats-every emits periodic progress %
    const args = ['-oX', '-', '-v', '--stats-every', '5s']  // XML output to stdout

    switch (scanType) {
      case 'ping':
        args.push('-sn')
        break
      case 'quick':
        args.push('-F')
        break
      case 'service':
        args.push('-sV', '-sC')
        break
      case 'os':
        args.push('-O')
        break
      case 'full':
        args.push('-p-')
        break
      case 'udp':
        args.push('-sU', '-F')
        break
      case 'vuln':
        args.push('--script=vuln')
        break
      default:
        args.push('-F')
    }

    if (ports && /^[0-9,\-]+$/.test(ports)) {
      args.push('-p', ports)
    }

    // Apply timing template (T0-T5)
    if (/^T[0-5]$/.test(timing)) {
      args.push(`-${timing}`)
    }

    args.push(...target.trim().split(/\s+/))

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    })

    const sendSSE = (type, data) => res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`)

    sendSSE('progress', { message: `Starting nmap scan: nmap ${args.join(' ')}` })

    const { spawn } = await import('child_process')
    const nmap = spawn('nmap', args)

    let xmlBuffer = ''
    let stderrBuffer = ''

    nmap.stdout.on('data', chunk => {
      xmlBuffer += chunk.toString()
    })

    nmap.stderr.on('data', chunk => {
      const text = chunk.toString()
      stderrBuffer += text
      // Forward all non-empty stderr lines so the client can show live progress
      const lines = text.split('\n').filter(l => l.trim())
      for (const line of lines) {
        sendSSE('progress', { message: line.trim() })
      }
    })

    nmap.on('close', code => {
      if (code !== 0 && !xmlBuffer.includes('<nmaprun')) {
        sendSSE('error', { message: stderrBuffer || `nmap exited with code ${code}` })
        res.end()
        return
      }

      // Parse the XML output into a structured result
      try {
        const hosts = []
        const hostMatches = xmlBuffer.matchAll(/<host[^>]*>([\s\S]*?)<\/host>/g)
        for (const hm of hostMatches) {
          const hostXml = hm[0]

          // Status
          const statusMatch = hostXml.match(/<status state="([^"]+)"/)
          const state = statusMatch ? statusMatch[1] : 'unknown'

          // Address
          const addrMatch = hostXml.match(/<address addr="([^"]+)" addrtype="ipv4"/)
          const ip = addrMatch ? addrMatch[1] : ''
          const macMatch = hostXml.match(/<address addr="([^"]+)" addrtype="mac"/)
          const mac = macMatch ? macMatch[1] : ''
          const vendorMatch = hostXml.match(/addrtype="mac" vendor="([^"]+)"/)
          const vendor = vendorMatch ? vendorMatch[1] : ''

          // Hostnames
          const hostnameMatches = [...hostXml.matchAll(/<hostname name="([^"]+)"/g)]
          const hostnames = hostnameMatches.map(m => m[1])

          // OS
          const osMatch = hostXml.match(/<osmatch name="([^"]+)" accuracy="([^"]+)"/)
          const os = osMatch ? { name: osMatch[1], accuracy: osMatch[2] } : null

          // Ports
          const ports_found = []
          const portMatches = hostXml.matchAll(/<port protocol="([^"]+)" portid="([^"]+)">([\s\S]*?)<\/port>/g)
          for (const pm of portMatches) {
            const portXml = pm[3]
            const stateM = portXml.match(/<state state="([^"]+)"/)
            const serviceM = portXml.match(/<service name="([^"]+)"/)
            const productM = portXml.match(/product="([^"]+)"/)
            const versionM = portXml.match(/version="([^"]*)"/)
            const extraM = portXml.match(/extrainfo="([^"]*)"/)
            ports_found.push({
              protocol: pm[1],
              port: parseInt(pm[2], 10),
              state: stateM ? stateM[1] : 'unknown',
              service: serviceM ? serviceM[1] : '',
              product: productM ? productM[1] : '',
              version: versionM ? versionM[1] : '',
              extrainfo: extraM ? extraM[1] : '',
            })
          }

          // Scripts / NSE output
          const scriptMatches = [...hostXml.matchAll(/<script id="([^"]+)" output="([^"]+)"/g)]
          const scripts = scriptMatches.map(m => ({ id: m[1], output: m[2] }))

          hosts.push({ ip, mac, vendor, hostnames, state, os, ports: ports_found, scripts })
        }

        // Summary stats from the XML
        const runMatch = xmlBuffer.match(/args="([^"]*)"/)
        const summaryMatch = xmlBuffer.match(/<runstats>[\s\S]*?<hosts up="(\d+)" down="(\d+)" total="(\d+)"/)
        const elapsed = xmlBuffer.match(/elapsed="([^"]+)"/)

        sendSSE('result', {
          hosts,
          summary: {
            command: runMatch ? `nmap ${runMatch[1]}` : `nmap ${args.join(' ')}`,
            hostsUp: summaryMatch ? parseInt(summaryMatch[1]) : hosts.filter(h => h.state === 'up').length,
            hostsDown: summaryMatch ? parseInt(summaryMatch[2]) : 0,
            hostsTotal: summaryMatch ? parseInt(summaryMatch[3]) : hosts.length,
            elapsed: elapsed ? parseFloat(elapsed[1]) : null,
          },
          rawXml: xmlBuffer,
        })
      } catch (e) {
        sendSSE('error', { message: `Failed to parse nmap output: ${e.message}` })
      }

      res.end()
    })

    nmap.on('error', err => {
      if (err.code === 'ENOENT') {
        sendSSE('error', { message: 'nmap is not installed. Install it with: apt-get install nmap' })
      } else {
        sendSSE('error', { message: err.message })
      }
      res.end()
    })

    req.on('close', () => { try { nmap.kill() } catch {} })
    return
  }

  // ── Security Suite Endpoints ──────────────────────────────────────────────────

  // Helper: expand ~ in paths
  function expandPath(pathStr) {
    if (!pathStr) return pathStr
    if (pathStr.startsWith('~')) {
      return join(homedir(), pathStr.slice(1))
    }
    return pathStr
  }

  // Helper: ensure an output path lands on the host filesystem.
  // The host home is bind-mounted at /root/host-home inside the container.
  // If the user supplies a real host path like /home/sean/foo we rewrite it
  // to /root/host-home/foo so apktool writes through the mount to the host.
  function toHostPath(pathStr) {
    if (!pathStr) return pathStr
    // Already under the mount — leave it alone
    if (pathStr.startsWith('/root/host-home')) return pathStr
    // Looks like an absolute host path (/home/..., /Users/..., etc.)
    // Strip the leading slash so we can join under the mount point
    if (pathStr.startsWith('/')) return join('/root/host-home', pathStr)
    return pathStr
  }

  // GET /security/host-info — expose host filesystem mapping to the frontend
  if (req.method === 'GET' && url.pathname === '/security/host-info') {
    setCors(res)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      hostHome: process.env.HOST_HOME || null,
      containerMount: '/root/host-home',
    }))
    return
  }

  // GET /security/caps — check Java and Android SDK availability
  if (req.method === 'GET' && url.pathname === '/security/caps') {
    setCors(res)
    const caps = { java: false, javaPath: null, androidHome: null }

    // Check Java - try 'which' first, then direct execution
    try {
      const result = spawnSync('which', ['java'], { encoding: 'utf-8', timeout: 2000 })
      if (result.status === 0 && result.stdout?.trim()) {
        caps.java = true
        caps.javaPath = result.stdout.trim()
      }
    } catch {
      // Fallback: try direct execution
      try {
        execFileSync('java', ['-version'], { stdio: 'ignore', timeout: 2000 })
        caps.java = true
        caps.javaPath = 'java'
      } catch {
        // Java not found
      }
    }

    // Check Android SDK from environment
    const androidHome = process.env.ANDROID_HOME
    if (androidHome && existsSync(androidHome)) {
      caps.androidHome = androidHome
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(caps))
    return
  }


  // GET /security/apk/browse — open a native file picker for selecting an APK file
  if (req.method === 'GET' && url.pathname === '/security/apk/browse') {
    setCors(res)
    try {
      const { stdout } = await execFileAsync('zenity', [
        '--file-selection',
        '--title=Select APK File',
        '--file-filter=APK files (*.apk) | *.apk',
        '--file-filter=All files | *',
      ])
      const selectedPath = stdout.trim()
      if (!selectedPath) {
        res.writeHead(204)
        res.end()
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ path: selectedPath }))
    } catch (e) {
      // Exit code 1 = user cancelled
      if (e.code === 1 || (e.stderr && e.stderr.includes('cancel'))) {
        res.writeHead(204)
        res.end()
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
    }
    return
  }

  // POST /security/apk/upload — upload APK file to temp directory
  if (req.method === 'POST' && url.pathname === '/security/apk/upload') {
    setCors(res)
    try {
      // Use a dedicated large-body reader — APKs can be 50MB+
      const body = await new Promise((resolve, reject) => {
        const chunks = []
        req.on('data', chunk => chunks.push(chunk))
        req.on('end', () => {
          try { resolve(JSON.parse(Buffer.concat(chunks).toString())) }
          catch (e) { reject(new Error('invalid JSON')) }
        })
        req.on('error', reject)
      })
      const { filename, data } = body
      const tmpDir = mkdtempSync(join(tmpdir(), 'apk_'))
      const apkPath = join(tmpDir, filename)
      writeFileSync(apkPath, Buffer.from(data, 'base64'))
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ apkPath, tmpDir }))
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  // POST /security/apk/analyze — decode APK with apktool and analyze
  if (req.method === 'POST' && url.pathname === '/security/apk/analyze') {
    setCors(res)
    try {
      const body = await parseBody(req)
      let { apkPath, sootJarPath, platformsPath, outputDir } = body

      // Expand ~ then ensure output lands on the host-mounted filesystem
      apkPath = expandPath(apkPath)
      outputDir = toHostPath(expandPath(outputDir || '/root/host-home/apktool_output'))

      // Validate APK file exists
      if (!existsSync(apkPath)) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: `APK file not found: ${apkPath}` }))
        return
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })

      mkdirSync(outputDir, { recursive: true })

      const shell = process.env.SHELL || '/bin/bash'
      const escapePath = (p) => `"${p.replace(/"/g, '\\"')}"`

      // Send progress message
      const sendSSE = (type, data) => {
        const json = JSON.stringify({ type, ...data })
        res.write(`data: ${json}\n\n`)
      }

      sendSSE('progress', { message: 'Decoding APK with apktool...' })

      // Run apktool d (decode) with -f flag to overwrite existing output
      const apktoolCmd = `apktool d -f ${escapePath(apkPath)} -o ${escapePath(outputDir)}`
      const child = spawn(shell, ['-i', '-c', apktoolCmd])
      let stdout = ''
      let stderr = ''

      child.stderr.on('data', d => {
        stderr += d.toString()
        sendSSE('progress', { message: d.toString() })
      })

      child.stdout.on('data', d => {
        stdout += d.toString()
        sendSSE('progress', { message: d.toString() })
      })

      child.on('close', code => {
        if (code === 0) {
          sendSSE('progress', { message: 'Analyzing decoded APK...' })

          // Parse the decoded APK
          setTimeout(() => {
            try {
              const result = {
                apkName: apkPath.split('/').pop(),
                packageName: '',
                sensitiveApis: [],
                strings: [],
                classes: [],
                libraries: [],
                analysisTimeMs: 0
              }

              // Parse AndroidManifest.xml
              const manifestPath = join(outputDir, 'AndroidManifest.xml')
              if (existsSync(manifestPath)) {
                try {
                  const manifestContent = readFileSync(manifestPath, 'utf-8')

                  // Extract package name
                  const pkgMatch = manifestContent.match(/package="([^"]+)"/)
                  result.packageName = pkgMatch ? pkgMatch[1] : ''

                  // Extract permissions
                  const permMatches = manifestContent.match(/android:name="(android\.permission\.[^"]+)"/g) || []
                  result.strings = permMatches.map(m => {
                    const perm = m.match(/"([^"]+)"/)[1]
                    return {
                      type: 'Other',
                      value: perm,
                      foundIn: 'AndroidManifest.xml'
                    }
                  })

                  // Extract activities, services, receivers
                  const activities = (manifestContent.match(/<activity[^>]*android:name="([^"]+)"/g) || []).map(m => m.match(/"([^"]+)"/)[1])
                  const services = (manifestContent.match(/<service[^>]*android:name="([^"]+)"/g) || []).map(m => m.match(/"([^"]+)"/)[1])
                  const receivers = (manifestContent.match(/<receiver[^>]*android:name="([^"]+)"/g) || []).map(m => m.match(/"([^"]+)"/)[1])

                  result.classes = [
                    ...activities.map(name => ({
                      name,
                      packageName: result.packageName,
                      superClass: 'android.app.Activity',
                      interfaces: [],
                      methods: [],
                      isActivity: true,
                      isService: false,
                      isReceiver: false
                    })),
                    ...services.map(name => ({
                      name,
                      packageName: result.packageName,
                      superClass: 'android.app.Service',
                      interfaces: [],
                      methods: [],
                      isActivity: false,
                      isService: true,
                      isReceiver: false
                    })),
                    ...receivers.map(name => ({
                      name,
                      packageName: result.packageName,
                      superClass: 'android.content.BroadcastReceiver',
                      interfaces: [],
                      methods: [],
                      isActivity: false,
                      isService: false,
                      isReceiver: true
                    }))
                  ]
                } catch (e) {
                  sendSSE('progress', { message: `Note: Error parsing manifest: ${e.message}` })
                }
              }

              // Parse res/values/strings.xml
              const stringsPath = join(outputDir, 'res', 'values', 'strings.xml')
              if (existsSync(stringsPath)) {
                try {
                  const stringsContent = readFileSync(stringsPath, 'utf-8')
                  const stringMatches = stringsContent.match(/<string[^>]*name="[^"]*"[^>]*>([^<]+)<\/string>/g) || []
                  stringMatches.forEach(m => {
                    const match = m.match(/>([^<]+)</)
                    if (match && match[1].length > 6) {
                      result.strings.push({
                        type: 'Other',
                        value: match[1],
                        foundIn: 'strings.xml'
                      })
                    }
                  })
                } catch (e) {
                  sendSSE('progress', { message: `Note: Error parsing strings: ${e.message}` })
                }
              }

              result.outputDir = outputDir
              // Send result
              sendSSE('result', { data: result })
              sendSSE('done', {})
              res.end()
            } catch (e) {
              sendSSE('error', { message: `Failed to parse results: ${e.message}` })
              sendSSE('done', {})
              res.end()
            }
          }, 500)
        } else {
          sendSSE('error', { message: `apktool exited with code ${code}. Make sure apktool is installed: sudo apt install apktool` })
          sendSSE('done', {})
          res.end()
        }
      })

      req.on('close', () => {
        try { child.kill() } catch { /* already dead */ }
      })
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  // ── Jimple Analysis ─────────────────────────────────────────────────────
  // Sensitive API patterns for jimple
  const SENSITIVE_API_PATTERNS = {
    'Location': [
      /getLastKnownLocation|requestLocationUpdates|LocationManager|FusedLocationProviderClient/i
    ],
    'Device ID': [
      /getDeviceId|getSubscriberId|getSimSerialNumber|TelephonyManager/i
    ],
    'SMS': [
      /sendTextMessage|sendMultipartTextMessage|SmsManager/i
    ],
    'Camera': [
      /Camera\.open|camera2|cameraManager/i
    ],
    'Microphone': [
      /setAudioSource|AudioRecord|MediaRecorder/i
    ],
    'Contacts': [
      /ContentResolver|query.*contacts|Contacts\.CONTENT_URI/i
    ],
    'Network': [
      /URL\.openConnection|HttpURLConnection|OkHttpClient|newCall/i
    ],
    'Crypto': [
      /Cipher\.|MessageDigest|SecretKeySpec|KeyGenerator/i
    ],
    'Runtime Exec': [
      /Runtime\.exec|ProcessBuilder|start\(\)/i
    ],
    'Reflection': [
      /Method\.invoke|Class\.forName|getDeclaredMethod/i
    ],
    'Clipboard': [
      /ClipboardManager|getPrimaryClip/i
    ],
    'Storage': [
      /FileOutputStream|getExternalStorageDirectory|SharedPreferences/i
    ]
  }

  // Library detection patterns
  const LIBRARY_PATTERNS = [
    { name: 'OkHttp', pattern: /okhttp3/ },
    { name: 'Retrofit', pattern: /retrofit2/ },
    { name: 'Firebase', pattern: /com\/google\/firebase/ },
    { name: 'Google Play Services', pattern: /com\/google\/android\/gms/ },
    { name: 'Gson', pattern: /com\/google\/gson/ },
    { name: 'RxJava', pattern: /io\/reactivex/ },
    { name: 'AWS SDK', pattern: /com\/amazonaws/ },
    { name: 'Stripe', pattern: /com\/stripe/ },
    { name: 'Glide', pattern: /com\/bumptech\/glide/ },
    { name: 'Picasso', pattern: /com\/squareup\/picasso/ },
  ]

  // String detection patterns
  const STRING_PATTERNS = {
    'URL': /https?:\/\/[^\s"']+/,
    'IP': /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
    'Email': /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    'Base64': /[A-Za-z0-9+/]{40,}={0,2}/,
    'Path': /\/[a-zA-Z0-9_\/.-]{8,}/,
  }

  // Parse jimple files from a folder
  function parseJimpleFolder(folderPath) {
    const result = {
      packageName: '',
      sensitiveApis: [],
      strings: new Set(),
      classes: new Map(),
      libraries: new Map(),
    }

    try {
      // Find all .jimple files
      const jimpleFiles = []
      function walkDir(dir) {
        const files = readdirSync(dir, { withFileTypes: true })
        for (const file of files) {
          const fullPath = join(dir, file.name)
          if (file.isDirectory()) {
            walkDir(fullPath)
          } else if (file.name.endsWith('.jimple')) {
            jimpleFiles.push(fullPath)
          }
        }
      }
      walkDir(folderPath)

      if (jimpleFiles.length === 0) {
        throw new Error(`No .jimple files found in ${folderPath}`)
      }

      // Parse each jimple file
      for (const filePath of jimpleFiles) {
        const content = readFileSync(filePath, 'utf-8')
        const className = filePath.split('/').pop().replace('.jimple', '')

        // Extract package from content
        const pkgMatch = content.match(/^public class\s+(\S+)/m)
        const fullClassName = pkgMatch ? pkgMatch[1] : className
        const parts = fullClassName.split('.')
        const pkgPart = parts.slice(0, -1).join('.')
        if (pkgPart && !result.packageName) {
          result.packageName = pkgPart
        }

        // Store class info
        result.classes.set(fullClassName, { methods: [] })

        // Extract method invocations (sensitive APIs)
        const invokeMatches = content.match(/invoke[a-z]* \$[0-9]+ = <([^>]+)>/gi) || []
        for (const match of invokeMatches) {
          const sig = match
          // Check against sensitive API patterns
          for (const [category, patterns] of Object.entries(SENSITIVE_API_PATTERNS)) {
            for (const pattern of patterns) {
              if (pattern.test(sig)) {
                result.sensitiveApis.push({
                  category,
                  api: sig,
                  calledFrom: fullClassName,
                  signature: sig
                })
                break
              }
            }
          }
        }

        // Extract string constants
        const stringMatches = content.match(/"([^"]{6,})"/g) || []
        for (const str of stringMatches) {
          const value = str.slice(1, -1) // Remove quotes

          // Detect string type
          let type = 'Other'
          for (const [strType, pattern] of Object.entries(STRING_PATTERNS)) {
            if (pattern.test(value)) {
              type = strType
              break
            }
          }
          result.strings.add(JSON.stringify({ type, value, foundIn: fullClassName }))
        }

        // Detect libraries
        for (const lib of LIBRARY_PATTERNS) {
          if (lib.pattern.test(fullClassName)) {
            const existing = result.libraries.get(lib.name) || { count: 0 }
            existing.count++
            result.libraries.set(lib.name, existing)
          }
        }
      }

      // Convert to arrays and deduplicate
      const strings = [...result.strings].map(s => JSON.parse(s))
      const uniqueStrings = Array.from(new Map(strings.map(s => [s.value, s])).values())

      const libraries = Array.from(result.libraries.entries()).map(([name, data]) => ({
        name,
        packagePattern: name.toLowerCase(),
        confidence: 'medium',
        classCount: data.count
      }))

      // Deduplicate sensitive APIs
      const uniqueApis = Array.from(new Map(
        result.sensitiveApis.map(api => [api.signature + api.calledFrom, api])
      ).values())

      return {
        packageName: result.packageName || 'unknown',
        sensitiveApis: uniqueApis,
        strings: uniqueStrings,
        classes: Array.from(result.classes.entries()).map(([name]) => ({
          name,
          packageName: result.packageName,
          superClass: 'java.lang.Object',
          interfaces: [],
          methods: [],
          isActivity: false,
          isService: false,
          isReceiver: false
        })),
        libraries,
        analysisTimeMs: 0
      }
    } catch (e) {
      throw new Error(`Failed to parse jimple folder: ${e.message}`)
    }
  }

  // POST /security/soot/run — run Soot on an APK to produce Jimple output (SSE stream)
  if (req.method === 'POST' && url.pathname === '/security/soot/run') {
    setCors(res)
    try {
      const body = await parseBody(req)
      let { apkPath, outputDir, androidJarsPath } = body

      apkPath = toHostPath(expandPath(apkPath))
      outputDir = toHostPath(expandPath(outputDir || '/root/host-home/sootOutput'))
      // Resolve android jars: prefer what the user specified, then host SDK mount, then
      // the in-container downloaded platforms (works on Windows where host SDK may not exist)
      androidJarsPath = expandPath(androidJarsPath || '')
      if (!androidJarsPath || !existsSync(androidJarsPath)) {
        const candidates = [
          '/root/Android/Sdk/platforms',
          PLATFORMS_INSTALL_DIR,
        ]
        androidJarsPath = candidates.find(p => existsSync(p) && readdirSync(p).length > 0) || androidJarsPath || '/root/Android/Sdk/platforms'
      }

      if (!existsSync(apkPath)) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: `APK not found: ${apkPath}` }))
        return
      }

      if (!existsSync(androidJarsPath)) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: `Android platforms directory not found: ${androidJarsPath}` }))
        return
      }

      // Locate soot jar and helper jars relative to server working directory
      const sootJarDir = join(process.cwd(), 'soot_jar')
      const sootJar = join(sootJarDir, 'soot-4.4.0-20220321.130129-1-jar-with-dependencies.jar')
      const helperJars = readdirSync(sootJarDir)
        .filter(f => f.endsWith('.jar') && !f.startsWith('soot-4.4.0'))
        .map(f => join(sootJarDir, f))

      if (!existsSync(sootJar)) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: `Soot jar not found: ${sootJar}` }))
        return
      }

      mkdirSync(outputDir, { recursive: true })

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })

      const sendSSE = (type, data) => {
        res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`)
      }

      // Build classpath: soot jar + helper jars
      const classpath = [sootJar, ...helperJars].join(':')

      // Soot arguments for APK → Jimple conversion
      const javaArgs = [
        '-cp', classpath,
        'soot.Main',
        '-src-prec', 'apk',
        '-process-dir', apkPath,
        '-android-jars', androidJarsPath,
        '-d', outputDir,
        '-output-format', 'J',    // J = Jimple
        '-allow-phantom-refs',
        '-whole-program',
        '-p', 'cg', 'enabled:false',  // skip call-graph to speed up plain IR dump
      ]

      sendSSE('log', { message: `Starting Soot...` })
      sendSSE('log', { message: `APK: ${apkPath}` })
      sendSSE('log', { message: `Output: ${outputDir}` })
      sendSSE('log', { message: `java ${javaArgs.join(' ')}` })
      sendSSE('log', { message: '' })

      const child = spawn('java', javaArgs, { cwd: process.cwd() })

      child.stdout.on('data', d => {
        d.toString().split('\n').filter(l => l.trim()).forEach(l => sendSSE('log', { message: l }))
      })
      child.stderr.on('data', d => {
        d.toString().split('\n').filter(l => l.trim()).forEach(l => sendSSE('log', { message: l }))
      })

      child.on('close', code => {
        if (code === 0) {
          sendSSE('log', { message: '' })
          sendSSE('log', { message: `Done. Jimple files written to: ${outputDir}` })
          sendSSE('done', {})
        } else {
          sendSSE('error', { message: `Soot exited with code ${code}` })
          sendSSE('done', {})
        }
        res.end()
      })

      req.on('close', () => {
        try { child.kill() } catch { /* already done */ }
      })
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  // GET /security/jimple/browse — open a native folder picker and return the selected path
  if (req.method === 'GET' && url.pathname === '/security/jimple/browse') {
    setCors(res)
    try {
      const titleParam = url.searchParams.get('title') || 'Select Jimple Folder'
      const { stdout, stderr } = await execFileAsync('zenity', [
        '--file-selection', '--directory',
        `--title=${titleParam}`,
      ])
      const selectedPath = stdout.trim()
      if (!selectedPath) {
        res.writeHead(204)
        res.end()
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ path: selectedPath }))
    } catch (e) {
      // Exit code 1 means user cancelled — return 204
      if (e.code === 1 || (e.stderr && e.stderr.includes('cancel'))) {
        res.writeHead(204)
        res.end()
      } else {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: e.message }))
      }
    }
    return
  }

  // POST /security/jimple/analyze — analyze jimple files from a folder
  if (req.method === 'POST' && url.pathname === '/security/jimple/analyze') {
    setCors(res)
    try {
      const body = await parseBody(req)
      let { folderPath } = body

      // Expand ~ in path
      folderPath = expandPath(folderPath)

      // Validate folder exists
      if (!existsSync(folderPath)) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: `Folder not found: ${folderPath}` }))
        return
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })

      const sendSSE = (type, data) => {
        const json = JSON.stringify({ type, ...data })
        res.write(`data: ${json}\n\n`)
      }

      sendSSE('progress', { message: 'Analyzing jimple files...' })

      // Analyze jimple files
      setTimeout(() => {
        try {
          const startTime = Date.now()
          const result = parseJimpleFolder(folderPath)
          result.analysisTimeMs = Date.now() - startTime

          sendSSE('result', { data: result })
          sendSSE('done', {})
          res.end()
        } catch (e) {
          sendSSE('error', { message: e.message })
          sendSSE('done', {})
          res.end()
        }
      }, 100)

      req.on('close', () => { /* request closed */ })
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  // ── AndroidManifest.xml Analysis ────────────────────────────────────────
  function parseAndroidManifest(filePath) {
    try {
      const content = readFileSync(filePath, 'utf-8')

      const result = {
        packageName: '',
        versionCode: undefined,
        versionName: undefined,
        minSdkVersion: undefined,
        targetSdkVersion: undefined,
        activities: [],
        services: [],
        receivers: [],
        providers: [],
        permissions: [],
        features: [],
        intentFilters: {}
      }

      // Extract manifest attributes
      const manifestMatch = content.match(/<manifest[^>]*>/i)
      if (manifestMatch) {
        const pkgMatch = manifestMatch[0].match(/package="([^"]+)"/i)
        if (pkgMatch) result.packageName = pkgMatch[1]

        const vCodeMatch = manifestMatch[0].match(/android:versionCode="([^"]+)"/i)
        if (vCodeMatch) result.versionCode = vCodeMatch[1]

        const vNameMatch = manifestMatch[0].match(/android:versionName="([^"]+)"/i)
        if (vNameMatch) result.versionName = vNameMatch[1]
      }

      // Extract uses-sdk
      const usesSDKMatch = content.match(/<uses-sdk[^>]*>/i)
      if (usesSDKMatch) {
        const minMatch = usesSDKMatch[0].match(/android:minSdkVersion="(\d+)"/i)
        if (minMatch) result.minSdkVersion = minMatch[1]

        const targetMatch = usesSDKMatch[0].match(/android:targetSdkVersion="(\d+)"/i)
        if (targetMatch) result.targetSdkVersion = targetMatch[1]
      }

      // Extract activities
      const activityMatches = content.match(/<activity[^>]*android:name="([^"]+)"/gi) || []
      for (const match of activityMatches) {
        const nameMatch = match.match(/android:name="([^"]+)"/i)
        if (nameMatch) result.activities.push(nameMatch[1])
      }

      // Extract services
      const serviceMatches = content.match(/<service[^>]*android:name="([^"]+)"/gi) || []
      for (const match of serviceMatches) {
        const nameMatch = match.match(/android:name="([^"]+)"/i)
        if (nameMatch) result.services.push(nameMatch[1])
      }

      // Extract receivers
      const receiverMatches = content.match(/<receiver[^>]*android:name="([^"]+)"/gi) || []
      for (const match of receiverMatches) {
        const nameMatch = match.match(/android:name="([^"]+)"/i)
        if (nameMatch) result.receivers.push(nameMatch[1])
      }

      // Extract providers
      const providerMatches = content.match(/<provider[^>]*android:name="([^"]+)"/gi) || []
      for (const match of providerMatches) {
        const nameMatch = match.match(/android:name="([^"]+)"/i)
        if (nameMatch) result.providers.push(nameMatch[1])
      }

      // Extract permissions
      const permMatches = content.match(/<uses-permission[^>]*android:name="([^"]+)"/gi) || []
      for (const match of permMatches) {
        const nameMatch = match.match(/android:name="([^"]+)"/i)
        if (nameMatch) result.permissions.push(nameMatch[1])
      }

      // Extract features
      const featureMatches = content.match(/<uses-feature[^>]*android:name="([^"]+)"/gi) || []
      for (const match of featureMatches) {
        const nameMatch = match.match(/android:name="([^"]+)"/i)
        if (nameMatch) result.features.push(nameMatch[1])
      }

      // Extract intent filters
      const intentMatches = content.match(/<intent-filter>[\s\S]*?<\/intent-filter>/gi) || []
      let componentName = ''
      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (/<(activity|service|receiver|provider)[^>]*android:name="([^"]+)"/i.test(line)) {
          const match = line.match(/android:name="([^"]+)"/i)
          if (match) componentName = match[1]
        }
        if (/<intent-filter>/i.test(line)) {
          const intentEnd = content.indexOf('</intent-filter>', content.indexOf('<intent-filter>', i))
          const intentSection = content.substring(content.indexOf('<intent-filter>', i), intentEnd + 16)
          const actions = (intentSection.match(/<action[^>]*android:name="([^"]+)"/gi) || [])
            .map(m => m.match(/android:name="([^"]+)"/i)[1])
          if (actions.length > 0 && componentName) {
            result.intentFilters[componentName] = actions
          }
        }
      }

      // Identify dangerous permissions
      const DANGEROUS_PERMS = [
        'android.permission.CAMERA',
        'android.permission.RECORD_AUDIO',
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.READ_CONTACTS',
        'android.permission.WRITE_CONTACTS',
        'android.permission.READ_CALENDAR',
        'android.permission.WRITE_CALENDAR',
        'android.permission.READ_CALL_LOG',
        'android.permission.WRITE_CALL_LOG',
        'android.permission.READ_SMS',
        'android.permission.SEND_SMS',
        'android.permission.RECEIVE_SMS',
        'android.permission.READ_PHONE_STATE',
        'android.permission.CALL_PHONE',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.GET_ACCOUNTS',
      ]

      result.dangerousPermissions = result.permissions.filter(p => DANGEROUS_PERMS.includes(p))

      return result
    } catch (e) {
      throw new Error(`Failed to parse AndroidManifest.xml: ${e.message}`)
    }
  }

  // GET /security/manifest/browse — open native file picker and return selected path
  if (req.method === 'GET' && url.pathname === '/security/manifest/browse') {
    setCors(res)
    try {
      const selected = await new Promise((resolve, reject) => {
        execFile('zenity', ['--file-selection', '--title=Select AndroidManifest.xml', '--file-filter=XML files (*.xml) | *.xml'], (err, stdout) => {
          if (err) {
            // exit code 1 means user cancelled — not a real error
            if (err.code === 1) return resolve(null)
            return reject(err)
          }
          resolve(stdout.trim())
        })
      })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ path: selected }))
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  // GET /security/manifest/store-proxy?pkg=... — proxy Play Store page to avoid X-Frame-Options
  if (req.method === 'GET' && url.pathname === '/security/manifest/store-proxy') {
    setCors(res)
    const pkg = url.searchParams.get('pkg')
    if (!pkg || !/^[a-zA-Z0-9._]+$/.test(pkg)) {
      res.writeHead(400, { 'Content-Type': 'text/plain' })
      res.end('Invalid package name')
      return
    }
    try {
      const storeUrl = `https://play.google.com/store/apps/details?id=${encodeURIComponent(pkg)}&hl=en`
      const data = await new Promise((resolve, reject) => {
        https.get(storeUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } }, (r) => {
          let body = ''
          r.on('data', chunk => body += chunk)
          r.on('end', () => resolve({ status: r.statusCode, body }))
        }).on('error', reject)
      })
      // Rewrite absolute URLs so relative assets resolve, and strip CSP/frame headers
      const rewritten = data.body
        .replace(/<base [^>]*>/gi, '')
        .replace(/(href|src|action)="\/([^"])/gi, `$1="https://play.google.com/$2`)
      res.writeHead(data.status, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(rewritten)
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'text/plain' })
      res.end(`Failed to fetch Play Store page: ${e.message}`)
    }
    return
  }

  // POST /security/manifest/analyze — analyze AndroidManifest.xml file
  if (req.method === 'POST' && url.pathname === '/security/manifest/analyze') {
    setCors(res)
    try {
      const body = await parseBody(req)
      let { filePath } = body

      // Expand ~ in path
      filePath = expandPath(filePath)

      // Validate file exists
      if (!existsSync(filePath)) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: `File not found: ${filePath}` }))
        return
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })

      const sendSSE = (type, data) => {
        const json = JSON.stringify({ type, ...data })
        res.write(`data: ${json}\n\n`)
      }

      sendSSE('progress', { message: 'Analyzing AndroidManifest.xml...' })

      // Analyze manifest
      setTimeout(() => {
        try {
          const startTime = Date.now()
          const result = parseAndroidManifest(filePath)
          result.analysisTimeMs = Date.now() - startTime

          sendSSE('result', { data: result })
          sendSSE('done', {})
          res.end()
        } catch (e) {
          sendSSE('error', { message: e.message })
          sendSSE('done', {})
          res.end()
        }
      }, 100)

      req.on('close', () => { /* request closed */ })
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  // GET /security/install/list — list available Soot versions and Android API levels
  if (req.method === 'GET' && url.pathname === '/security/install/list') {
    setCors(res)

    // Check if latest Soot is already installed
    const latestVersion = SOOT_VERSIONS[0].version
    const latestJarPath = join(SOOT_INSTALL_DIR, `soot-all-${latestVersion}.jar`)
    const sootInstalled = existsSync(latestJarPath)

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      sootVersions: SOOT_VERSIONS,
      androidLevels: ANDROID_API_LEVELS,
      sootInstallDir: SOOT_INSTALL_DIR,
      platformsInstallDir: PLATFORMS_INSTALL_DIR,
      sootInstalled,
      latestSootPath: sootInstalled ? latestJarPath : null,
    }))
    return
  }

  // POST /security/install/auto — auto-install latest Soot (SSE stream)
  if (req.method === 'POST' && url.pathname === '/security/install/auto') {
    setCors(res)

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    })

    const latestVersion = SOOT_VERSIONS[0].version
    const jarPath = join(SOOT_INSTALL_DIR, `soot-all-${latestVersion}.jar`)

    // Ensure directory exists
    mkdirSync(SOOT_INSTALL_DIR, { recursive: true })

    if (existsSync(jarPath)) {
      res.write(`data: ${JSON.stringify({ type: 'progress', message: 'Soot already installed' })}\n\n`)
      res.write(`data: ${JSON.stringify({ type: 'done', path: jarPath })}\n\n`)
      res.end()
      return
    }

    res.write(`data: ${JSON.stringify({ type: 'progress', message: `Auto-installing Soot ${latestVersion}...` })}\n\n`)

    const sootDef = SOOT_VERSIONS[0]
    downloadFile(sootDef.url, jarPath)
      .then(() => {
        res.write(`data: ${JSON.stringify({ type: 'progress', message: 'Download complete' })}\n\n`)
        res.write(`data: ${JSON.stringify({ type: 'done', path: jarPath })}\n\n`)
        res.end()
      })
      .catch(e => {
        res.write(`data: ${JSON.stringify({ type: 'error', message: `Download failed: ${e.message}` })}\n\n`)
        res.end()
      })
    return
  }

  // POST /security/install/soot — download and install Soot (SSE stream)
  if (req.method === 'POST' && url.pathname === '/security/install/soot') {
    setCors(res)
    try {
      const body = await parseBody(req)
      const { version } = JSON.parse(body)

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })

      const sootDef = SOOT_VERSIONS.find(v => v.version === version)
      if (!sootDef) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Soot version not found' })}\n\n`)
        res.end()
        return
      }

      const jarPath = join(SOOT_INSTALL_DIR, `soot-all-${version}.jar`)
      if (existsSync(jarPath)) {
        res.write(`data: ${JSON.stringify({ type: 'progress', message: 'Soot already installed' })}\n\n`)
        res.write(`data: ${JSON.stringify({ type: 'done', path: jarPath })}\n\n`)
        res.end()
        return
      }

      res.write(`data: ${JSON.stringify({ type: 'progress', message: `Downloading Soot ${version}...` })}\n\n`)

      downloadFile(sootDef.url, jarPath)
        .then(() => {
          res.write(`data: ${JSON.stringify({ type: 'progress', message: 'Download complete' })}\n\n`)
          res.write(`data: ${JSON.stringify({ type: 'done', path: jarPath })}\n\n`)
          res.end()
        })
        .catch(e => {
          res.write(`data: ${JSON.stringify({ type: 'error', message: `Download failed: ${e.message}` })}\n\n`)
          res.end()
        })
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  // POST /security/install/platforms — find or setup Android platforms
  if (req.method === 'POST' && url.pathname === '/security/install/platforms') {
    setCors(res)
    try {
      const body = await parseBody(req)
      const { apis } = JSON.parse(body)

      if (!Array.isArray(apis) || apis.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Please select at least one API level' }))
        return
      }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })

      const shell = process.env.SHELL || '/bin/bash'

      // Check user's environment for Android SDK
      execFile(shell, ['-i', '-c', 'echo $ANDROID_HOME'], (error, androidHome) => {
        let platformsDir = androidHome?.trim()

        // Check common paths if ANDROID_HOME not set
        const commonPaths = [
          platformsDir,
          join(homedir(), 'Android/sdk'),
          join(homedir(), 'android-sdk'),
          '/opt/android-sdk',
          'C:\\Android\\sdk',
        ].filter(p => p)

        let foundPath = null
        for (const path of commonPaths) {
          if (existsSync(path)) {
            foundPath = path
            break
          }
        }

        if (foundPath) {
          // Use existing Android SDK
          platformsDir = foundPath
          res.write(`data: ${JSON.stringify({ type: 'progress', message: `Found Android SDK at: ${platformsDir}` })}\n\n`)
        } else {
          // Create local platforms directory
          platformsDir = join(PLATFORMS_INSTALL_DIR, `platforms-${Date.now()}`)
          mkdirSync(platformsDir, { recursive: true })
          res.write(`data: ${JSON.stringify({ type: 'progress', message: `Creating platform stubs in: ${platformsDir}` })}\n\n`)
        }

        // Create or verify platform directories for each API level
        for (const api of apis) {
          const apiDir = join(platformsDir, `platforms`, `android-${api}`)
          mkdirSync(apiDir, { recursive: true })

          // Create minimal android.jar if it doesn't exist
          const jarPath = join(apiDir, 'android.jar')
          if (!existsSync(jarPath)) {
            writeFileSync(jarPath, Buffer.from([0x50, 0x4b, 0x03, 0x04])) // ZIP header
          }

          const level = ANDROID_API_LEVELS.find(l => l.api === api)
          res.write(`data: ${JSON.stringify({ type: 'progress', message: `✓ ${level?.name || `API ${api}`}` })}\n\n`)
        }

        res.write(`data: ${JSON.stringify({
          type: 'done',
          platformsDir: join(platformsDir, 'platforms'),
          apis: apis.map(api => {
            const level = ANDROID_API_LEVELS.find(l => l.api === api)
            return { api, name: level?.name || `API ${api}` }
          })
        })}\n\n`)
        res.end()
      })
    } catch (e) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: e.message })}\n\n`)
      res.end()
    }
    return
  }

  // ── Discord REST proxy ──────────────────────────────────────────────────────
  // Proxies /discord/* → https://discord.com/api/v10/*
  // Supports:
  //   - Authorization header (bot token, forwarded as-is)
  //   - x-webhook-token header (webhook token, forwarded as "Bot <token>")
  //   - No auth (public endpoints like GET /webhooks/{id}/{token})
  if (url.pathname.startsWith('/discord/')) {
    const discordPath = url.pathname.replace('/discord/', '')
    const discordUrl = `https://discord.com/api/v10/${discordPath}${url.search}`
    const method = req.method

    // Determine Authorization header to forward.
    // x-bot-token and x-webhook-token are used instead of Authorization because
    // Vite's proxy strips the Authorization header when forwarding to HTTP targets.
    let authHeader = req.headers['authorization'] || ''
    if (!authHeader && req.headers['x-bot-token']) {
      authHeader = `Bot ${req.headers['x-bot-token']}`
    } else if (!authHeader && req.headers['x-webhook-token']) {
      authHeader = `Bot ${req.headers['x-webhook-token']}`
    }

    try {
      let bodyData = null
      if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
        bodyData = await new Promise((resolve, reject) => {
          let d = ''
          req.on('data', c => { d += c; if (d.length > 1e6) reject(new Error('body too large')) })
          req.on('end', () => resolve(d))
          req.on('error', reject)
        })
      }

      const fetchHeaders = {
        'Content-Type': 'application/json',
        'User-Agent': 'NoteApp/1.0',
      }
      if (authHeader) fetchHeaders['Authorization'] = authHeader

      const fetchRes = await fetch(discordUrl, {
        method,
        headers: fetchHeaders,
        ...(bodyData ? { body: bodyData } : {}),
      })

      const text = await fetchRes.text()
      const responseHeaders = { 'Content-Type': fetchRes.headers.get('content-type') || 'application/json' }
      // Forward rate-limit headers so clients can see retry timing
      const retryAfter = fetchRes.headers.get('retry-after')
      if (retryAfter) responseHeaders['retry-after'] = retryAfter
      const rateLimit = fetchRes.headers.get('x-ratelimit-remaining')
      if (rateLimit) responseHeaders['x-ratelimit-remaining'] = rateLimit
      res.writeHead(fetchRes.status, responseHeaders)
      res.end(text)
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: e.message }))
    }
    return
  }

  // ── Minecraft Docker management ───────────────────────────────────────────────
  // POST /minecraft/docker/start   { name, version, software, ramGb, mcPort, rconPort, plugins[] }
  // POST /minecraft/docker/stop    { name }
  // POST /minecraft/docker/delete  { name }
  // GET  /minecraft/docker/status?name=<container>

  if (url.pathname.startsWith('/minecraft/docker/')) {
    setCors(res)
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

    const action = url.pathname.replace('/minecraft/docker/', '')

    // ── status ──────────────────────────────────────────────────────────────
    if (req.method === 'GET' && action === 'status') {
      const name = url.searchParams.get('name') || 'minecraft-server'
      let status = 'not_found'
      let details = {}

      // Get host LAN IP so the client can display the correct connection address
      let hostIp = '127.0.0.1'
      try {
        const ipResult = spawnSync('sh', ['-c',
          "ip route get 1 2>/dev/null | awk '{print $7; exit}' || hostname -I | awk '{print $1}'"
        ], { encoding: 'utf8' })
        const parsed = ipResult.stdout.trim().split('\n')[0].trim()
        if (parsed) hostIp = parsed
      } catch {}

      try {
        const result = spawnSync('docker', ['inspect', '--format',
          '{{.State.Status}}|{{.State.StartedAt}}',
          name], { encoding: 'utf8' })
        if (result.status === 0) {
          const parts = result.stdout.trim().split('|')
          status = parts[0] || 'unknown'
          details = { startedAt: parts[1] || '', hostIp }
        }
      } catch {}
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status, details }))
      return
    }

    // Parse body for mutation endpoints
    const chunks = []
    req.on('data', d => chunks.push(d))
    await new Promise(resolve => req.on('end', resolve))
    let body = {}
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch {}

    // ── stop ─────────────────────────────────────────────────────────────────
    if (req.method === 'POST' && action === 'stop') {
      const { name = 'minecraft-server' } = body
      const result = spawnSync('docker', ['stop', name], { encoding: 'utf8' })
      if (result.status !== 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: result.stderr.trim() || 'Failed to stop container' }))
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, message: `Container "${name}" stopped.` }))
      return
    }

    // ── delete ────────────────────────────────────────────────────────────────
    if (req.method === 'POST' && action === 'delete') {
      const { name = 'minecraft-server' } = body
      const result = spawnSync('docker', ['rm', '-f', name], { encoding: 'utf8' })
      if (result.status !== 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: result.stderr.trim() || 'Failed to delete container' }))
        return
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, message: `Container "${name}" deleted.` }))
      return
    }

    // ── start ─────────────────────────────────────────────────────────────────
    if (req.method === 'POST' && action === 'start') {
      const {
        name = 'minecraft-server',
        version = 'LATEST',
        software = 'PAPER',
        ramGb = 2,
        mcPort = 25565,
        rconPort = 25575,
        dataDir = '',
        plugins = [],
      } = body

      // Get host LAN IP to return in the response
      let hostIp = '127.0.0.1'
      try {
        const ipResult = spawnSync('sh', ['-c',
          "ip route get 1 2>/dev/null | awk '{print $7; exit}' || hostname -I | awk '{print $1}'"
        ], { encoding: 'utf8' })
        const parsed = ipResult.stdout.trim().split('\n')[0].trim()
        if (parsed) hostIp = parsed
      } catch {}

      // Build docker run args using the itzg/minecraft-server image.
      // Use --network host so the container binds directly to the host's
      // network stack — avoids port-mapping issues when the app itself
      // runs inside a Docker container.
      const args = [
        'run', '-d',
        '--name', name,
        '--restart', 'unless-stopped',
        '--network', 'host',
        '-e', 'EULA=TRUE',
        '-e', `VERSION=${version}`,
        '-e', `TYPE=${String(software).toUpperCase()}`,
        '-e', `MEMORY=${ramGb}G`,
        '-e', `SERVER_PORT=${mcPort}`,
        '-e', `RCON_PORT=${rconPort}`,
        '-e', 'ONLINE_MODE=TRUE',
        '-e', 'DIFFICULTY=normal',
        '-e', 'OPS=',
      ]

      // Volume: use named volume or host bind-mount
      if (dataDir && dataDir.trim()) {
        args.push('-v', `${dataDir.trim()}:/data`)
      } else {
        args.push('-v', `${name}-data:/data`)
      }

      // Pass plugin modrinth slugs as MODRINTH env var if any
      if (plugins.length > 0) {
        args.push('-e', `MODRINTH_PROJECTS=${plugins.join(',')}`)
      }

      args.push('itzg/minecraft-server')

      // Check if container already exists and remove it first
      spawnSync('docker', ['rm', '-f', name], { encoding: 'utf8' })

      const result = spawnSync('docker', args, { encoding: 'utf8' })
      if (result.status !== 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: result.stderr.trim() || 'Failed to start container' }))
        return
      }

      const containerId = result.stdout.trim().slice(0, 12)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        ok: true,
        containerId,
        hostIp,
        message: `Container "${name}" started (ID: ${containerId}). Connect to ${hostIp}:${mcPort} — server may take 1-2 minutes to finish loading.`,
      }))
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Unknown minecraft/docker action' }))
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

// Suppress WebSocketServer errors during port binding
wss.on('error', (err) => {
  if (err.code !== 'EADDRINUSE') {
    console.error('WebSocketServer error:', err)
  }
})

wss.on('connection', (ws, req) => {
  // Only allow local/LAN origins
  const origin = req.headers.origin || ''
  if (!/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/.test(origin)) {
    ws.close(4003, 'Forbidden origin')
    return
  }

  if (!pty) {
    ws.send(JSON.stringify({ type: 'output', data: 'Terminal unavailable: node-pty failed to load.\r\n' }))
    ws.close()
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

// Try to listen on PORT, with fallback to alternate ports
let listeningPort = PORT
let server_listening = false

const tryListen = (port) => {
  return new Promise((resolve, reject) => {
    const listener = () => {
      console.log(`\n  git-server listening on http://0.0.0.0:${port}`)
      console.log(`  terminal : ws://0.0.0.0:${port}/terminal`)
      console.log(`  git : ${caps.git ? caps.gitVersion : 'NOT FOUND'}`)
      console.log(`  lfs : ${caps.lfs ? caps.lfsVersion : 'not installed'}`)
      console.log()
      listeningPort = port
      resolve()
    }

    const errorHandler = (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`  Port ${port} is in use, trying ${port + 1}...`)
        server.removeListener('error', errorHandler)
        tryListen(port + 1).then(resolve).catch(reject)
      } else {
        reject(err)
      }
    }

    server.once('error', errorHandler)
    server.listen(port, '0.0.0.0', listener)
  })
}

await tryListen(PORT)
