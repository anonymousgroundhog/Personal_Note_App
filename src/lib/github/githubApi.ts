// GitHub REST API v3 helpers — pure fetch, no dependencies

export const GITHUB_API = 'https://api.github.com'
export const LFS_THRESHOLD = 50 * 1024 * 1024 // 50 MB

export interface GHUser {
  login: string
  name: string
  avatar_url: string
}

export interface GHRepo {
  full_name: string
  name: string
  owner: { login: string }
  default_branch: string
  private: boolean
  html_url: string
  clone_url: string
  description?: string
  stargazers_count?: number
  forks_count?: number
  updated_at?: string
  language?: string | null
}

export interface GHBranch {
  name: string
  commit: { sha: string }
  protected: boolean
}

export interface GHTreeEntry {
  path: string
  mode: '100644' | '100755' | '040000'
  type: 'blob' | 'tree'
  sha?: string | null
  content?: string
}

export interface GHCommit {
  sha: string
  html_url: string
  commit: {
    message: string
    tree: { sha: string }
    author?: { name: string; email: string; date: string }
    committer?: { name: string; email: string; date: string }
  }
  author?: { login: string; avatar_url: string }
  committer?: { login: string; avatar_url: string }
}

export interface GHBlob {
  sha: string
  size: number
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
}

async function ghFetch<T>(token: string, path: string, opts: RequestInit = {}): Promise<T> {
  const url = path.startsWith('http') ? path : `${GITHUB_API}${path}`
  const res = await fetch(url, { ...opts, headers: { ...headers(token), ...(opts.headers as Record<string, string> ?? {}) } })
  if (!res.ok) {
    let msg = `GitHub API error ${res.status}`
    try { const j = await res.json(); msg = j.message || msg } catch { /* noop */ }
    throw new Error(msg)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function getAuthenticatedUser(token: string): Promise<GHUser> {
  return ghFetch<GHUser>(token, '/user')
}

// ── Repos ────────────────────────────────────────────────────────────────────

export async function getRepo(token: string, owner: string, repo: string): Promise<GHRepo> {
  return ghFetch<GHRepo>(token, `/repos/${owner}/${repo}`)
}

export async function listUserRepos(token: string): Promise<GHRepo[]> {
  // Fetch up to 100 repos
  return ghFetch<GHRepo[]>(token, '/user/repos?per_page=100&sort=updated')
}

export async function createRepo(
  token: string,
  name: string,
  opts: { private?: boolean; description?: string; auto_init?: boolean }
): Promise<GHRepo> {
  return ghFetch<GHRepo>(token, '/user/repos', {
    method: 'POST',
    body: JSON.stringify({ name, ...opts }),
  })
}

// ── Branches ─────────────────────────────────────────────────────────────────

export async function listBranches(token: string, owner: string, repo: string): Promise<GHBranch[]> {
  return ghFetch<GHBranch[]>(token, `/repos/${owner}/${repo}/branches?per_page=100`)
}

export async function getBranch(token: string, owner: string, repo: string, branch: string): Promise<GHBranch> {
  return ghFetch<GHBranch>(token, `/repos/${owner}/${repo}/branches/${branch}`)
}

// ── Trees / Blobs ─────────────────────────────────────────────────────────────

export async function createBlob(token: string, owner: string, repo: string, content: string): Promise<GHBlob> {
  // GitHub accepts UTF-8 content as base64
  const encoded = btoa(unescape(encodeURIComponent(content)))
  return ghFetch<GHBlob>(token, `/repos/${owner}/${repo}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({ content: encoded, encoding: 'base64' }),
  })
}

export async function createTree(
  token: string,
  owner: string,
  repo: string,
  entries: GHTreeEntry[],
  baseTree?: string
): Promise<{ sha: string }> {
  return ghFetch<{ sha: string }>(token, `/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ tree: entries, base_tree: baseTree }),
  })
}

export async function getCommit(token: string, owner: string, repo: string, sha: string): Promise<GHCommit> {
  return ghFetch<GHCommit>(token, `/repos/${owner}/${repo}/git/commits/${sha}`)
}

export async function createCommit(
  token: string,
  owner: string,
  repo: string,
  message: string,
  treeSha: string,
  parentShas: string[]
): Promise<GHCommit> {
  return ghFetch<GHCommit>(token, `/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: treeSha, parents: parentShas }),
  })
}

export async function updateRef(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  sha: string,
  force = false
): Promise<void> {
  await ghFetch(token, `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha, force }),
  })
}

export async function createRef(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  sha: string
): Promise<void> {
  await ghFetch(token, `/repos/${owner}/${repo}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
  })
}

// ── Activity / Commits ────────────────────────────────────────────────────────

export async function listCommits(
  token: string,
  owner: string,
  repo: string,
  limit = 10
): Promise<GHCommit[]> {
  return ghFetch<GHCommit[]>(token, `/repos/${owner}/${repo}/commits?per_page=${limit}`)
}

// ── Remote tree for comparison ────────────────────────────────────────────────

export interface RemoteFile {
  path: string
  sha: string
  size: number
}

export async function getFullTree(
  token: string,
  owner: string,
  repo: string,
  treeSha: string
): Promise<RemoteFile[]> {
  const res = await ghFetch<{ tree: Array<{ path: string; sha: string; size: number; type: string }> }>(
    token,
    `/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`
  )
  return res.tree.filter(e => e.type === 'blob').map(e => ({ path: e.path, sha: e.sha, size: e.size }))
}

// ── .git config helpers ───────────────────────────────────────────────────────

/** Parse a minimal git config to extract remote origin URL */
export function parseGitConfig(config: string): { remote?: string; branch?: string } {
  const remoteMatch = config.match(/\[remote "origin"\][^[]*url\s*=\s*([^\n]+)/s)
  const branchMatch = config.match(/\[branch "([^"]+)"\]/)
  const remote = remoteMatch?.[1]?.trim()
  const branch = branchMatch?.[1]?.trim()
  return { remote, branch }
}

/** Extract owner/repo from a GitHub remote URL */
export function parseGitHubRemote(url: string): { owner: string; repo: string } | null {
  // Handles https://github.com/owner/repo.git and git@github.com:owner/repo.git
  const https = url.match(/github\.com[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?$/)
  if (https) return { owner: https[1], repo: https[2] }
  return null
}

/** Write a minimal .git/config for a new repo */
export function buildGitConfig(owner: string, repo: string, branch: string): string {
  return `[core]
\trepositoryformatversion = 0
\tfilemode = false
\tbare = false
[remote "origin"]
\turl = https://github.com/${owner}/${repo}.git
\tfetch = +refs/heads/*:refs/remotes/origin/*
[branch "${branch}"]
\tremote = origin
\tmerge = refs/heads/${branch}
`
}

/** Write a minimal .git/HEAD */
export function buildGitHEAD(branch: string): string {
  return `ref: refs/heads/${branch}\n`
}
