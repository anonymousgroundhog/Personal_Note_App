import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  GitBranch, Github, RefreshCw, Upload, CheckCircle, XCircle,
  AlertTriangle, Info, Eye, EyeOff, Lock, Unlock, ExternalLink,
  ChevronDown, Plus, Loader,
} from 'lucide-react'
import { useSyncStore } from '../../stores/syncStore'
import { useVaultStore } from '../../stores/vaultStore'
import {
  getAuthenticatedUser, listBranches, createRepo, getBranch,
  createBlob, createTree, getCommit, createCommit, updateRef, createRef,
  getFullTree, parseGitConfig, parseGitHubRemote, buildGitConfig, buildGitHEAD,
  LFS_THRESHOLD,
  type GHTreeEntry,
} from '../../lib/github/githubApi'
import type { RepoInfo } from '../../stores/syncStore'

const LFS_SIZE_MB = LFS_THRESHOLD / 1024 / 1024

// ── helpers ──────────────────────────────────────────────────────────────────

async function readTextFromVault(
  root: FileSystemDirectoryHandle,
  path: string
): Promise<string | null> {
  try {
    const parts = path.split('/').filter(Boolean)
    let dir: FileSystemDirectoryHandle = root
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i])
    }
    const fh = await dir.getFileHandle(parts[parts.length - 1])
    const file = await fh.getFile()
    return file.text()
  } catch {
    return null
  }
}

async function writeTextToVault(
  root: FileSystemDirectoryHandle,
  path: string,
  content: string
): Promise<void> {
  const parts = path.split('/').filter(Boolean)
  let dir: FileSystemDirectoryHandle = root
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i], { create: true })
  }
  const fh = await dir.getFileHandle(parts[parts.length - 1], { create: true })
  const w = await fh.createWritable()
  await w.write(content)
  await w.close()
}

/** List ALL files recursively (including non-.md) for sync purposes */
async function listAllFiles(
  dir: FileSystemDirectoryHandle,
  prefix = ''
): Promise<Array<{ path: string; handle: FileSystemFileHandle; size: number }>> {
  const result: Array<{ path: string; handle: FileSystemFileHandle; size: number }> = []
  for await (const [name, handle] of (dir as unknown as AsyncIterable<[string, FileSystemHandle]>)) {
    // Skip .git folder and common non-content dirs
    if (name === '.git' || name === 'node_modules' || name === '.DS_Store') continue
    const path = prefix ? `${prefix}/${name}` : name
    if (handle.kind === 'file') {
      const file = await (handle as FileSystemFileHandle).getFile()
      result.push({ path, handle: handle as FileSystemFileHandle, size: file.size })
    } else if (handle.kind === 'directory') {
      const sub = await listAllFiles(handle as FileSystemDirectoryHandle, path)
      result.push(...sub)
    }
  }
  return result
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SyncView() {
  const { token, setToken, repoInfo, setRepoInfo, branches, setBranches,
    selectedBranch, setSelectedBranch, status, setStatus, progress, setProgress,
    log, addLog, clearLog, lastSyncAt, setLastSyncAt } = useSyncStore()
  const { rootHandle } = useVaultStore()

  const [tokenInput, setTokenInput] = useState(token)
  const [showToken, setShowToken] = useState(false)
  const [tokenUser, setTokenUser] = useState<{ login: string; name: string } | null>(null)
  const [tokenError, setTokenError] = useState('')
  const [detecting, setDetecting] = useState(false)

  // New repo creation form
  const [showNewRepoForm, setShowNewRepoForm] = useState(false)
  const [newRepoName, setNewRepoName] = useState('')
  const [newRepoPrivate, setNewRepoPrivate] = useState(true)
  const [newRepoDesc, setNewRepoDesc] = useState('')

  // LFS files detected during sync
  const [lfsFiles, setLfsFiles] = useState<string[]>([])

  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  // Validate token and detect repo when component mounts (if token stored)
  useEffect(() => {
    if (token && !tokenUser) {
      validateToken(token, false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const validateToken = async (t: string, save = true) => {
    if (!t.trim()) { setTokenError('Token is required'); return }
    setTokenError('')
    try {
      const user = await getAuthenticatedUser(t.trim())
      setTokenUser({ login: user.login, name: user.name })
      if (save) {
        setToken(t.trim())
        setTokenInput(t.trim())
      }
      if (rootHandle) detectRepo(t.trim())
    } catch (e) {
      setTokenError('Invalid token or no network access')
      setTokenUser(null)
    }
  }

  const detectRepo = useCallback(async (tok = token) => {
    if (!rootHandle || !tok) return
    setDetecting(true)
    addLog('info', 'Detecting repository…')
    try {
      // Try to read .git/config
      const gitConfig = await readTextFromVault(rootHandle, '.git/config')
      if (gitConfig) {
        const { remote } = parseGitConfig(gitConfig)
        if (remote) {
          const parsed = parseGitHubRemote(remote)
          if (parsed) {
            addLog('info', `Found existing repo: ${parsed.owner}/${parsed.repo}`)
            try {
              const ghRepo = await getAuthenticatedUser(tok).then(() =>
                fetch(`https://api.github.com/repos/${parsed.owner}/${parsed.repo}`, {
                  headers: { Authorization: `token ${tok}`, Accept: 'application/vnd.github+json' }
                }).then(r => r.json())
              )
              const info: RepoInfo = {
                owner: parsed.owner, repo: parsed.repo,
                fullName: `${parsed.owner}/${parsed.repo}`,
                defaultBranch: ghRepo.default_branch || 'main',
                isNew: false,
              }
              setRepoInfo(info)
              await loadBranches(tok, parsed.owner, parsed.repo, info.defaultBranch)
              addLog('success', `Connected to ${info.fullName}`)
            } catch {
              addLog('warn', 'Could not fetch repo info from GitHub — check token permissions')
            }
            return
          }
        }
      }
      addLog('info', 'No existing GitHub remote found. Create a new repository below.')
      setRepoInfo(null)
    } finally {
      setDetecting(false)
    }
  }, [rootHandle, token, addLog, setRepoInfo])

  const loadBranches = async (tok: string, owner: string, repo: string, defaultBranch: string) => {
    try {
      const brs = await listBranches(tok, owner, repo)
      const names = brs.map(b => b.name)
      setBranches(names)
      // Default to current branch from .git/HEAD if available, else repo default
      let current = defaultBranch
      if (rootHandle) {
        const head = await readTextFromVault(rootHandle, '.git/HEAD')
        if (head) {
          const m = head.match(/refs\/heads\/(.+)/)
          if (m && names.includes(m[1])) current = m[1]
        }
      }
      setSelectedBranch(current)
    } catch {
      setBranches([defaultBranch])
      setSelectedBranch(defaultBranch)
    }
  }

  const handleCreateRepo = async () => {
    if (!newRepoName.trim() || !token || !tokenUser) return
    setStatus('checking')
    addLog('info', `Creating repository ${tokenUser.login}/${newRepoName}…`)
    try {
      const ghRepo = await createRepo(token, newRepoName.trim(), {
        private: newRepoPrivate,
        description: newRepoDesc,
        auto_init: true,
      })
      const info: RepoInfo = {
        owner: ghRepo.owner.login,
        repo: ghRepo.name,
        fullName: ghRepo.full_name,
        defaultBranch: ghRepo.default_branch,
        isNew: true,
      }
      setRepoInfo(info)

      // Write .git/config and .git/HEAD into vault dir
      if (rootHandle) {
        await writeTextToVault(rootHandle, '.git/config', buildGitConfig(info.owner, info.repo, info.defaultBranch))
        await writeTextToVault(rootHandle, '.git/HEAD', buildGitHEAD(info.defaultBranch))
        addLog('info', 'Wrote .git/config and .git/HEAD to vault folder')
      }

      const brs = await listBranches(token, info.owner, info.repo)
      setBranches(brs.map(b => b.name))
      setSelectedBranch(info.defaultBranch)
      setShowNewRepoForm(false)
      addLog('success', `Created repository: ${info.fullName}`)
      setStatus('idle')
    } catch (e) {
      addLog('error', `Failed to create repository: ${e instanceof Error ? e.message : String(e)}`)
      setStatus('error')
    }
  }

  const handleSync = useCallback(async () => {
    if (!rootHandle || !token || !repoInfo || status === 'syncing') return

    setStatus('syncing')
    setProgress(0)
    clearLog()
    setLfsFiles([])

    const { owner, repo } = repoInfo
    const branch = selectedBranch

    try {
      addLog('info', `Starting sync → ${repoInfo.fullName}:${branch}`)

      // 1. Gather all local files
      addLog('info', 'Scanning local files…')
      const localFiles = await listAllFiles(rootHandle)
      addLog('info', `Found ${localFiles.length} local files`)
      setProgress(5)

      // 2. Detect oversized files
      const oversized = localFiles.filter(f => f.size > LFS_THRESHOLD)
      if (oversized.length > 0) {
        const names = oversized.map(f => f.path)
        setLfsFiles(names)
        addLog('warn', `${oversized.length} file(s) exceed ${LFS_SIZE_MB}MB and require Git LFS. They will be skipped.`)
        names.forEach(n => addLog('warn', `  LFS skip: ${n}`))
      }

      const syncableFiles = localFiles.filter(f => f.size <= LFS_THRESHOLD)
      setProgress(10)

      // 3. Get current HEAD commit + remote tree for comparison
      let parentSha: string | null = null
      let remoteFilesMap = new Map<string, string>() // path → sha

      try {
        const branchData = await getBranch(token, owner, repo, branch)
        parentSha = branchData.commit.sha
        addLog('info', `Remote HEAD: ${parentSha.slice(0, 7)}`)
        const commitData = await getCommit(token, owner, repo, parentSha)
        const remoteTree = await getFullTree(token, owner, repo, commitData.commit.tree.sha)
        remoteTree.forEach(f => remoteFilesMap.set(f.path, f.sha))
        addLog('info', `Remote has ${remoteTree.length} files`)
      } catch {
        addLog('info', 'Branch has no commits yet — performing initial push')
      }
      setProgress(20)

      // 4. Upload blobs for changed files
      addLog('info', 'Uploading changed files…')
      const treeEntries: GHTreeEntry[] = []
      let uploaded = 0
      let unchanged = 0

      for (let i = 0; i < syncableFiles.length; i++) {
        const { path, handle } = syncableFiles[i]
        const file = await handle.getFile()
        const content = await file.text()

        // Simple content hash check — compare by uploading and checking returned sha
        // For efficiency we always upload (GitHub deduplicates by sha internally)
        try {
          const blob = await createBlob(token, owner, repo, content)
          // Only include in tree if sha differs from remote (or file is new)
          if (remoteFilesMap.get(path) !== blob.sha) {
            treeEntries.push({ path, mode: '100644', type: 'blob', sha: blob.sha })
            uploaded++
          } else {
            unchanged++
          }
        } catch (e) {
          addLog('error', `Failed to upload ${path}: ${e instanceof Error ? e.message : String(e)}`)
        }

        setProgress(20 + Math.round(70 * (i + 1) / syncableFiles.length))
      }

      addLog('info', `${uploaded} file(s) changed, ${unchanged} unchanged`)

      if (treeEntries.length === 0 && parentSha) {
        addLog('success', 'Everything is up to date — nothing to commit')
        setStatus('success')
        setLastSyncAt(new Date().toLocaleString())
        setProgress(100)
        return
      }

      // 5. Create tree + commit
      addLog('info', 'Creating commit…')
      const treeResult = await createTree(token, owner, repo, treeEntries, parentSha ?? undefined)
      setProgress(93)

      const now = new Date().toLocaleString()
      const commitMsg = `Sync from Personal Note App — ${now}`
      const newCommit = await createCommit(
        token, owner, repo, commitMsg, treeResult.sha,
        parentSha ? [parentSha] : []
      )
      setProgress(97)

      // 6. Update or create branch ref
      if (parentSha) {
        await updateRef(token, owner, repo, branch, newCommit.sha)
      } else {
        try {
          await updateRef(token, owner, repo, branch, newCommit.sha)
        } catch {
          await createRef(token, owner, repo, branch, newCommit.sha)
        }
      }

      // 7. Update local .git/HEAD + refs
      if (rootHandle) {
        await writeTextToVault(rootHandle, '.git/HEAD', buildGitHEAD(branch))
        await writeTextToVault(rootHandle, `.git/refs/heads/${branch}`, newCommit.sha + '\n')
      }

      setProgress(100)
      addLog('success', `Sync complete! Commit: ${newCommit.sha.slice(0, 7)}`)
      addLog('success', `View on GitHub: ${newCommit.html_url}`)
      setLastSyncAt(now)
      setStatus('success')
    } catch (e) {
      addLog('error', `Sync failed: ${e instanceof Error ? e.message : String(e)}`)
      setStatus('error')
    }
  }, [rootHandle, token, repoInfo, selectedBranch, status, addLog, clearLog,
    setStatus, setProgress, setLastSyncAt, setBranches])

  // ── render helpers ──────────────────────────────────────────────────────────

  const inputCls = 'w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500'
  const labelCls = 'text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1'

  const logColor = (level: string) => {
    if (level === 'error') return 'text-red-500'
    if (level === 'warn') return 'text-amber-500'
    if (level === 'success') return 'text-emerald-500'
    return 'text-gray-400'
  }

  const isSyncing = status === 'syncing'

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-surface-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <Github size={20} className="text-accent-500" />
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">GitHub Sync</h1>
        {lastSyncAt && (
          <span className="text-xs text-gray-400 ml-1">Last synced: {lastSyncAt}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {repoInfo && (
            <a
              href={`https://github.com/${repoInfo.fullName}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-accent-500 hover:underline"
            >
              {repoInfo.fullName}
              <ExternalLink size={11} />
            </a>
          )}
          {status === 'success' && <CheckCircle size={16} className="text-emerald-500" />}
          {status === 'error' && <XCircle size={16} className="text-red-500" />}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-6 space-y-6">

          {/* ── Token section ── */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
              <Lock size={14} className="text-accent-500" />
              GitHub Personal Access Token
            </h2>
            <p className="text-xs text-gray-400">
              Create a token at{' '}
              <a href="https://github.com/settings/tokens/new" target="_blank" rel="noreferrer"
                className="text-accent-500 hover:underline">
                github.com/settings/tokens/new
              </a>
              {' '}with <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">repo</code> scope.
              Stored locally in your browser.
            </p>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && validateToken(tokenInput)}
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  className={inputCls + ' pr-8'}
                />
                <button
                  onClick={() => setShowToken(v => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                >
                  {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                onClick={() => validateToken(tokenInput)}
                className="px-3 py-2 bg-accent-500 text-white rounded text-sm hover:bg-accent-600 flex-shrink-0"
              >
                Connect
              </button>
            </div>
            {tokenError && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <XCircle size={12} />{tokenError}
              </p>
            )}
            {tokenUser && (
              <p className="text-xs text-emerald-500 flex items-center gap-1">
                <CheckCircle size={12} />
                Connected as <strong className="ml-1">@{tokenUser.login}</strong>
                {tokenUser.name ? ` (${tokenUser.name})` : ''}
              </p>
            )}
          </section>

          {/* ── Repository section ── */}
          {tokenUser && rootHandle && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                  <Github size={14} className="text-accent-500" />
                  Repository
                </h2>
                <button
                  onClick={() => detectRepo()}
                  disabled={detecting}
                  className="flex items-center gap-1 text-xs text-accent-500 hover:text-accent-600 disabled:opacity-50"
                >
                  {detecting ? <Loader size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  Re-detect
                </button>
              </div>

              {repoInfo ? (
                <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {repoInfo.isNew && <span className="mr-1.5 px-1.5 py-0.5 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded text-xs">new</span>}
                        {repoInfo.fullName}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">Default branch: {repoInfo.defaultBranch}</p>
                    </div>
                    <a href={`https://github.com/${repoInfo.fullName}`} target="_blank" rel="noreferrer"
                      className="text-gray-400 hover:text-accent-500">
                      <ExternalLink size={14} />
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-surface-800 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                    No GitHub repository linked to this vault folder.
                  </p>
                  <button
                    onClick={() => setShowNewRepoForm(v => !v)}
                    className="flex items-center gap-1.5 mx-auto text-sm text-accent-500 hover:text-accent-600"
                  >
                    <Plus size={14} />
                    Create new repository
                  </button>
                </div>
              )}

              {/* New repo form */}
              {showNewRepoForm && !repoInfo && (
                <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-800 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">New Repository</h3>
                  <div>
                    <label className={labelCls}>Repository name *</label>
                    <input value={newRepoName} onChange={e => setNewRepoName(e.target.value)}
                      placeholder={rootHandle.name.replace(/\s+/g, '-')}
                      className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Description</label>
                    <input value={newRepoDesc} onChange={e => setNewRepoDesc(e.target.value)}
                      placeholder="My personal notes vault"
                      className={inputCls} />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={newRepoPrivate}
                      onChange={e => setNewRepoPrivate(e.target.checked)}
                      className="accent-accent-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1">
                      {newRepoPrivate ? <Lock size={12} className="text-gray-400" /> : <Unlock size={12} className="text-gray-400" />}
                      Private repository
                    </span>
                  </label>
                  <div className="flex gap-2">
                    <button onClick={handleCreateRepo}
                      disabled={!newRepoName.trim() || isSyncing}
                      className="flex-1 px-3 py-2 bg-accent-500 text-white rounded text-sm hover:bg-accent-600 disabled:opacity-50">
                      Create Repository
                    </button>
                    <button onClick={() => setShowNewRepoForm(false)}
                      className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm hover:bg-gray-200 dark:hover:bg-gray-600">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── Branch selector + Sync ── */}
          {repoInfo && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                <GitBranch size={14} className="text-accent-500" />
                Branch
              </h2>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className={labelCls}>Sync to branch</label>
                  <div className="relative">
                    <select
                      value={selectedBranch}
                      onChange={e => setSelectedBranch(e.target.value)}
                      disabled={isSyncing}
                      className={inputCls + ' pr-8 appearance-none'}
                    >
                      {branches.map(b => (
                        <option key={b} value={b}>{b}{b === repoInfo.defaultBranch ? ' (default)' : ''}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <button
                  onClick={() => loadBranches(token, repoInfo.owner, repoInfo.repo, repoInfo.defaultBranch)}
                  className="p-2 border border-gray-300 dark:border-gray-600 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Refresh branches"
                >
                  <RefreshCw size={14} />
                </button>
              </div>

              {/* LFS warning */}
              {lfsFiles.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1 mb-1">
                    <AlertTriangle size={12} />
                    {lfsFiles.length} file{lfsFiles.length > 1 ? 's' : ''} require Git LFS (&gt;{LFS_SIZE_MB}MB) and were skipped:
                  </p>
                  <ul className="text-xs text-amber-600 dark:text-amber-500 space-y-0.5 ml-4 list-disc">
                    {lfsFiles.map(f => <li key={f}>{f}</li>)}
                  </ul>
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">
                    To include these files, set up{' '}
                    <a href="https://git-lfs.com" target="_blank" rel="noreferrer" className="underline">Git LFS</a>
                    {' '}in your local git client and push manually.
                  </p>
                </div>
              )}

              {/* Sync button */}
              <button
                onClick={handleSync}
                disabled={!rootHandle || isSyncing}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-accent-500 text-white rounded-lg hover:bg-accent-600 text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {isSyncing
                  ? <><Loader size={16} className="animate-spin" />Syncing…</>
                  : <><Upload size={16} />Sync to GitHub</>
                }
              </button>

              {/* Progress bar */}
              {isSyncing && (
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-accent-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}
            </section>
          )}

          {/* ── Sync log ── */}
          {log.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                  <Info size={14} className="text-accent-500" />
                  Sync Log
                </h2>
                <button onClick={clearLog} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  Clear
                </button>
              </div>
              <div className="bg-gray-950 dark:bg-black rounded-lg p-3 font-mono text-xs max-h-64 overflow-y-auto space-y-0.5">
                {log.map((entry, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-gray-600 flex-shrink-0">{entry.time}</span>
                    <span className={logColor(entry.level)}>{entry.message}</span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </section>
          )}

          {/* ── Info box when no vault ── */}
          {!rootHandle && (
            <div className="p-4 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-center text-gray-400 text-sm">
              Open a vault folder first to enable GitHub sync.
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
