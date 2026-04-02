/**
 * gitClient.ts — browser-side client for git-server.mjs
 *
 * All calls go to http://localhost:3001 which runs git commands in a
 * subprocess on the user's machine using their existing git config,
 * SSH keys, credentials, and git-lfs installation.
 */

export const GIT_SERVER = 'http://localhost:3001'

export interface GitResult {
  stdout: string
  stderr: string
  code: number
}

export interface GitCaps {
  git: boolean
  gitVersion: string
  lfs: boolean
  lfsVersion: string
}

/** Check what's available on the machine */
export async function getGitCaps(): Promise<GitCaps> {
  const res = await fetch(`${GIT_SERVER}/git/caps`)
  if (!res.ok) throw new Error('git-server not reachable')
  return res.json()
}

/** Run a git command (buffered — waits for exit) */
export async function git(cwd: string, args: string[]): Promise<GitResult> {
  const res = await fetch(`${GIT_SERVER}/git`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cwd, args }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'unknown' }))
    throw new Error((err as { error?: string }).error ?? 'git-server error')
  }
  return res.json()
}

/** Run a git command and stream output via SSE, calling onLine for each chunk */
export async function gitStream(
  cwd: string,
  args: string[],
  onLine: (type: 'stdout' | 'stderr' | 'done', data: string | { code: number; stdout: string; stderr: string }) => void
): Promise<{ code: number }> {
  const res = await fetch(`${GIT_SERVER}/git/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cwd, args }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'unknown' }))
    throw new Error((err as { error?: string }).error ?? 'git-server error')
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let finalCode = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const msg = JSON.parse(line.slice(6)) as { type: string; data: unknown }
        if (msg.type === 'stdout') onLine('stdout', msg.data as string)
        else if (msg.type === 'stderr') onLine('stderr', msg.data as string)
        else if (msg.type === 'done') {
          const d = msg.data as { code: number; stdout: string; stderr: string }
          finalCode = d.code
          onLine('done', d)
        }
      } catch { /* skip malformed */ }
    }
  }

  return { code: finalCode }
}

/** Open a native OS folder picker and return the selected path, or null if cancelled */
export async function browseDirectory(startPath?: string): Promise<string | null> {
  const params = startPath ? `?start=${encodeURIComponent(startPath)}` : ''
  const res = await fetch(`${GIT_SERVER}/browse/directory${params}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'unknown' }))
    throw new Error((err as { error?: string }).error ?? 'browse failed')
  }
  const { path } = await res.json() as { path: string }
  return path || null
}

/** Check if git-server is reachable */
export async function isServerReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${GIT_SERVER}/git/caps`, { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}
