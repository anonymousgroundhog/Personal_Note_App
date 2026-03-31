import React, { useState, useCallback, useEffect, useRef } from 'react'
import {
  Github, RefreshCw, Upload, Download, CheckCircle, XCircle,
  AlertTriangle, Info, GitBranch, Plus, Loader, Terminal,
  ChevronDown, GitMerge, FolderGit2, ExternalLink, FolderOpen,
} from 'lucide-react'
import { useSyncStore } from '../../stores/syncStore'
import { useVaultStore } from '../../stores/vaultStore'
import { git, gitStream, getGitCaps, isServerReachable } from '../../lib/github/gitClient'
import { DirectoryBrowser } from '../../components/DirectoryBrowser'
import type { GitCaps } from '../../lib/github/gitClient'

// ── helpers ───────────────────────────────────────────────────────────────────

/** Get the filesystem path of the vault from its FileSystemDirectoryHandle name.
 *  The File System Access API doesn't expose the full path, so we ask the user
 *  to confirm / paste it once — stored in localStorage. */
const VAULT_PATH_KEY = 'vault_fs_path'
function loadVaultPath(): string {
  try { return localStorage.getItem(VAULT_PATH_KEY) ?? '' } catch { return '' }
}
function saveVaultPath(p: string) {
  try { localStorage.setItem(VAULT_PATH_KEY, p) } catch { /* noop */ }
}

// ── SyncView ──────────────────────────────────────────────────────────────────

export default function SyncView() {
  const { rootHandle } = useVaultStore()
  const { status, setStatus, progress, setProgress, log, addLog, clearLog, lastSyncAt, setLastSyncAt } = useSyncStore()

  // Server / git capability state
  const [serverUp, setServerUp] = useState<boolean | null>(null)
  const [caps, setCaps] = useState<GitCaps | null>(null)
  const [checkingServer, setCheckingServer] = useState(false)

  // Vault path (needed by git CLI — File System Access API hides it)
  const [vaultPath, setVaultPath] = useState(loadVaultPath)
  const [vaultPathInput, setVaultPathInput] = useState(loadVaultPath)

  // Auto-set vault path when vault is opened and stored path matches vault name
  useEffect(() => {
    if (!rootHandle) return
    const stored = loadVaultPath()
    const storedBasename = stored.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? ''
    if (stored && storedBasename === rootHandle.name) {
      // Stored path matches the open vault — use it automatically
      setVaultPath(stored)
      setVaultPathInput(stored)
    } else if (!stored) {
      // No path stored yet — pre-fill input with vault name as a hint
      setVaultPathInput(rootHandle.name)
    }
  }, [rootHandle])

  // Repo state
  const [isRepo, setIsRepo] = useState<boolean | null>(null)
  const [remoteUrl, setRemoteUrl] = useState('')
  const [currentBranch, setCurrentBranch] = useState('')
  const [branches, setBranches] = useState<string[]>([])
  const [selectedBranch, setSelectedBranch] = useState('')
  const [hasLfs, setHasLfs] = useState(false)
  const [gitStatus, setGitStatus] = useState('')

  // Init / remote form
  const [showInitForm, setShowInitForm] = useState(false)
  const [newRemoteUrl, setNewRemoteUrl] = useState('')
  const [initBranch, setInitBranch] = useState('main')
  const [commitMsg, setCommitMsg] = useState('Sync from Personal Note App')

  const logEndRef = useRef<HTMLDivElement>(null)
  const isSyncing = status === 'syncing' || status === 'checking'

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [log])

  // ── server check ────────────────────────────────────────────────────────────

  const checkServer = useCallback(async () => {
    setCheckingServer(true)
    const up = await isServerReachable()
    setServerUp(up)
    if (up) {
      const c = await getGitCaps().catch(() => null)
      setCaps(c)
    }
    setCheckingServer(false)
  }, [])

  useEffect(() => { checkServer() }, [checkServer])

  // ── repo detection ──────────────────────────────────────────────────────────

  const detectRepo = useCallback(async (path = vaultPath) => {
    if (!path || !serverUp) return
    setStatus('checking')
    try {
      // Debug: check git config and HEAD
      const gitDirRes = await git(path, ['rev-parse', '--git-dir'])
      addLog('info', `Git directory: ${gitDirRes.stdout.trim()}`)

      const headRes = await git(path, ['rev-parse', '--abbrev-ref', 'HEAD'])
      if (headRes.code === 0) {
        addLog('info', `HEAD: ${headRes.stdout.trim()}`)
      }

      // Check if inside a git repo
      const rev = await git(path, ['rev-parse', '--is-inside-work-tree'])
      if (rev.code !== 0) {
        addLog('error', `Git detection failed (code ${rev.code}): ${rev.stderr || rev.stdout}`)
        setIsRepo(false)
        setStatus('idle')
        return
      }
      if (rev.stdout.trim() !== 'true') {
        addLog('error', `Not a git repository (unexpected output: "${rev.stdout.trim()}")`)
        setIsRepo(false)
        setStatus('idle')
        return
      }
      setIsRepo(true)

      // Fetch latest from remote to ensure we have all branches
      const fetchRes = await git(path, ['fetch', 'origin'])
      if (fetchRes.code === 0) {
        addLog('info', 'Fetched latest branches from origin')
      } else {
        addLog('warn', `Fetch warning: ${fetchRes.stderr || 'no error message'}`)
      }

      // Current branch
      const branchRes = await git(path, ['branch', '--show-current'])
      const branch = branchRes.stdout.trim() || 'main'
      if (branchRes.code !== 0) {
        addLog('warn', `Failed to get current branch: ${branchRes.stderr || branchRes.stdout}`)
      }
      addLog('info', `Current branch: ${branch}`)
      setCurrentBranch(branch)
      setSelectedBranch(branch)

      // Remote URL
      const remoteRes = await git(path, ['remote', 'get-url', 'origin'])
      setRemoteUrl(remoteRes.code === 0 ? remoteRes.stdout.trim() : '')

      // All branches (local + remote) — use show-ref for reliable parsing
      const showRefRes = await git(path, ['show-ref'])
      const allBranches = showRefRes.stdout
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          // Format: "abc123def refs/heads/main" or "abc123def refs/remotes/origin/main"
          const match = line.match(/refs\/(heads|remotes\/origin)\/(.+)$/)
          return match ? match[2] : null
        })
        .filter((b): b is string => !!b && b !== 'HEAD')  // Filter out HEAD pseudo-ref
      addLog('info', `Found ${allBranches.length} branches: ${allBranches.join(', ') || '(none)'}`)
      setBranches([...new Set([branch, ...allBranches])])

      // Check for .lfsconfig or lfs tracking
      const lfsRes = await git(path, ['lfs', 'status'])
      setHasLfs(lfsRes.code === 0)

      // Short status
      const statRes = await git(path, ['status', '--short'])
      setGitStatus(statRes.stdout.trim())

      addLog('success', `Repository detected at ${path}`)
    } catch (e) {
      addLog('error', `Detection failed: ${e instanceof Error ? e.message : String(e)}`)
      setIsRepo(false)
    }
    setStatus('idle')
  }, [vaultPath, serverUp, addLog, setStatus])

  // Auto-detect repo when server comes up and vault path is already known
  useEffect(() => {
    if (serverUp && vaultPath) detectRepo(vaultPath)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverUp, vaultPath])

  // ── init new repo ───────────────────────────────────────────────────────────

  const handleInit = useCallback(async () => {
    if (!vaultPath) return
    setStatus('syncing')
    addLog('info', 'Initialising git repository…')
    try {
      const init = await git(vaultPath, ['init', '-b', initBranch])
      if (init.code !== 0) throw new Error(init.stderr)
      addLog('info', init.stdout.trim() || 'git init OK')

      if (newRemoteUrl.trim()) {
        const remote = await git(vaultPath, ['remote', 'add', 'origin', newRemoteUrl.trim()])
        if (remote.code !== 0) throw new Error(remote.stderr)
        addLog('info', `Remote set to ${newRemoteUrl.trim()}`)
      }

      if (caps?.lfs) {
        const lfsInstall = await git(vaultPath, ['lfs', 'install'])
        addLog('info', lfsInstall.stdout.trim() || 'git lfs install OK')
      }

      addLog('success', 'Repository initialised')
      setShowInitForm(false)
      await detectRepo(vaultPath)
    } catch (e) {
      addLog('error', `Init failed: ${e instanceof Error ? e.message : String(e)}`)
    }
    setStatus('idle')
  }, [vaultPath, initBranch, newRemoteUrl, caps, addLog, detectRepo, setStatus])

  // ── core sync (push) ────────────────────────────────────────────────────────

  const handleSync = useCallback(async () => {
    if (!vaultPath || !isRepo || isSyncing) return
    setStatus('syncing')
    setProgress(0)
    clearLog()

    const branch = selectedBranch || currentBranch || 'main'
    const log_ = (lvl: Parameters<typeof addLog>[0], msg: string) => addLog(lvl, msg)

    try {
      log_('info', `Starting sync on branch "${branch}"`)

      // 1. If LFS enabled, run git lfs track common large-file extensions
      if (caps?.lfs && hasLfs) {
        log_('info', 'Checking Git LFS pointers…')
        await gitStream(vaultPath, ['lfs', 'status'], (type, data) => {
          if (type === 'stdout' && typeof data === 'string' && data.trim()) log_('info', data.trim())
        })
      }
      setProgress(10)

      // 2. Stage all changes
      log_('info', 'Staging all changes (git add -A)…')
      const addRes = await git(vaultPath, ['add', '-A'])
      if (addRes.stderr.trim()) log_('warn', addRes.stderr.trim())
      setProgress(25)

      // 3. Check if there's anything to commit
      const statusRes = await git(vaultPath, ['status', '--short'])
      const stagedSummary = statusRes.stdout.trim()
      if (!stagedSummary) {
        log_('success', 'Nothing to commit — working tree clean')
        setStatus('success')
        setLastSyncAt(new Date().toLocaleString())
        setProgress(100)
        setGitStatus('')
        return
      }

      const lineCount = stagedSummary.split('\n').filter(Boolean).length
      log_('info', `${lineCount} file(s) staged`)
      setProgress(40)

      // 4. Commit
      const msg = commitMsg.trim() || `Sync — ${new Date().toLocaleString()}`
      log_('info', `Committing: "${msg}"`)
      const commitRes = await git(vaultPath, ['commit', '-m', msg])
      if (commitRes.code !== 0) throw new Error(commitRes.stderr || commitRes.stdout)
      log_('info', commitRes.stdout.trim())
      setProgress(60)

      // 5. Push (stream so we see progress)
      if (remoteUrl) {
        log_('info', `Pushing to origin/${branch}…`)
        const pushResult = await gitStream(
          vaultPath,
          ['push', '-u', 'origin', branch],
          (type, data) => {
            if (type === 'stderr' && typeof data === 'string' && data.trim())
              log_('info', data.trim())  // git push progress goes to stderr
            if (type === 'stdout' && typeof data === 'string' && data.trim())
              log_('info', data.trim())
            if (type === 'done') {
              const d = data as { code: number }
              if (d.code !== 0) log_('error', 'Push exited with non-zero code')
            }
          }
        )
        if (pushResult.code !== 0) throw new Error('Push failed — check git output above')
        log_('success', 'Push complete')
      } else {
        log_('warn', 'No remote configured — commit saved locally only')
      }

      setProgress(100)
      log_('success', `Sync complete! Branch: ${branch}`)
      setLastSyncAt(new Date().toLocaleString())
      setStatus('success')

      // Refresh status
      const newStat = await git(vaultPath, ['status', '--short'])
      setGitStatus(newStat.stdout.trim())
    } catch (e) {
      log_('error', `Sync failed: ${e instanceof Error ? e.message : String(e)}`)
      setStatus('error')
    }
  }, [vaultPath, isRepo, isSyncing, selectedBranch, currentBranch, caps, hasLfs,
    commitMsg, remoteUrl, addLog, clearLog, setStatus, setProgress, setLastSyncAt])

  // ── pull ────────────────────────────────────────────────────────────────────

  const handlePull = useCallback(async () => {
    if (!vaultPath || !isRepo || !remoteUrl || isSyncing) return
    setStatus('syncing')
    addLog('info', `Pulling from origin/${selectedBranch || currentBranch}…`)
    try {
      const pullResult = await gitStream(
        vaultPath,
        ['pull', 'origin', selectedBranch || currentBranch],
        (type, data) => {
          if (typeof data === 'string' && data.trim()) addLog('info', data.trim())
        }
      )
      if (pullResult.code !== 0) throw new Error('Pull failed — see output above')
      addLog('success', 'Pull complete')
      const newStat = await git(vaultPath, ['status', '--short'])
      setGitStatus(newStat.stdout.trim())
      setStatus('success')
    } catch (e) {
      addLog('error', `Pull failed: ${e instanceof Error ? e.message : String(e)}`)
      setStatus('error')
    }
  }, [vaultPath, isRepo, remoteUrl, isSyncing, selectedBranch, currentBranch, addLog, setStatus])

  // ── LFS track ──────────────────────────────────────────────────────────────

  const handleLfsTrack = useCallback(async (pattern: string) => {
    if (!vaultPath || !caps?.lfs) return
    const res = await git(vaultPath, ['lfs', 'track', pattern])
    addLog(res.code === 0 ? 'success' : 'error', res.stdout.trim() || res.stderr.trim())
    // Stage .gitattributes
    await git(vaultPath, ['add', '.gitattributes'])
    addLog('info', 'Staged .gitattributes')
  }, [vaultPath, caps, addLog])

  // ── path confirmation ───────────────────────────────────────────────────────

  const confirmVaultPath = (p = vaultPathInput.trim()) => {
    if (!p) return
    setVaultPath(p)
    setVaultPathInput(p)
    saveVaultPath(p)
    clearLog()
    detectRepo(p)
  }

  const [showBrowser, setShowBrowser] = useState(false)
  const handleBrowse = () => {
    setShowBrowser(true)
  }
  const handleBrowserSelect = (path: string) => {
    setShowBrowser(false)
    confirmVaultPath(path)
  }

  // ── styles ──────────────────────────────────────────────────────────────────

  const inputCls = 'w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500'
  const labelCls = 'text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1'
  const logColor = (level: string) => {
    if (level === 'error') return 'text-red-400'
    if (level === 'warn') return 'text-amber-400'
    if (level === 'success') return 'text-emerald-400'
    return 'text-gray-400'
  }

  // ── render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-surface-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <Github size={20} className="text-accent-500" />
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">GitHub Sync</h1>
        {lastSyncAt && <span className="text-xs text-gray-400">Last synced: {lastSyncAt}</span>}
        <div className="ml-auto flex items-center gap-2">
          {status === 'success' && <CheckCircle size={16} className="text-emerald-500" />}
          {status === 'error' && <XCircle size={16} className="text-red-500" />}
          {remoteUrl && (
            <a href={remoteUrl.replace(/\.git$/, '')} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-xs text-accent-500 hover:underline">
              View on GitHub <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto p-6 space-y-6">

          {/* ── Git server status ── */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                <Terminal size={14} className="text-accent-500" />
                Git Server
              </h2>
              <button onClick={checkServer} disabled={checkingServer}
                className="flex items-center gap-1 text-xs text-accent-500 hover:text-accent-600 disabled:opacity-50">
                {checkingServer ? <Loader size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                Check
              </button>
            </div>

            {serverUp === null || checkingServer ? (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Loader size={12} className="animate-spin" />Checking git-server…
              </div>
            ) : serverUp ? (
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 space-y-1">
                <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle size={12} /> git-server running on localhost:3001
                </p>
                {caps && (
                  <>
                    <p className="text-xs text-emerald-600 dark:text-emerald-500 ml-4">
                      {caps.gitVersion}
                    </p>
                    <p className={`text-xs ml-4 flex items-center gap-1 ${caps.lfs ? 'text-emerald-600 dark:text-emerald-500' : 'text-gray-400'}`}>
                      {caps.lfs
                        ? <><CheckCircle size={11} /> {caps.lfsVersion}</>
                        : <><XCircle size={11} /> Git LFS not installed</>}
                    </p>
                  </>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 space-y-2">
                <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
                  <XCircle size={12} /> git-server not running
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Start it by running <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">npm run dev</code> (starts automatically),
                  or separately with <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">npm run git-server</code>
                </p>
              </div>
            )}
          </section>

          {/* ── Vault path ── */}
          {serverUp && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                <FolderGit2 size={14} className="text-accent-500" />
                Vault Path
                {rootHandle && (
                  <span className="text-xs font-normal text-gray-400">(vault: {rootHandle.name})</span>
                )}
              </h2>
              <div className="flex gap-2 items-center">
                <input
                  value={vaultPathInput}
                  onChange={e => setVaultPathInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && confirmVaultPath()}
                  placeholder="/home/you/my-notes  or  C:\Users\You\my-notes"
                  className={inputCls}
                />
                <button onClick={handleBrowse}
                  title="Browse for vault folder"
                  className="flex items-center gap-1.5 px-3 py-2 bg-accent-500 text-white rounded text-sm hover:bg-accent-600 flex-shrink-0">
                  <FolderOpen size={14} />
                  Browse
                </button>
              </div>
              {showBrowser && (
                <DirectoryBrowser
                  initialPath={vaultPath || vaultPathInput || undefined}
                  onSelect={handleBrowserSelect}
                  onCancel={() => setShowBrowser(false)}
                />
              )}
              {vaultPath && (
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <CheckCircle size={11} className="text-emerald-500" />
                  Using: <code className="ml-1 bg-gray-100 dark:bg-gray-800 px-1 rounded">{vaultPath}</code>
                </p>
              )}
            </section>
          )}

          {/* ── Repository status ── */}
          {serverUp && vaultPath && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                  <FolderGit2 size={14} className="text-accent-500" />
                  Repository
                </h2>
                <button onClick={() => detectRepo()} disabled={isSyncing}
                  className="flex items-center gap-1 text-xs text-accent-500 hover:text-accent-600 disabled:opacity-50">
                  <RefreshCw size={11} /> Refresh
                </button>
              </div>

              {isRepo === null ? (
                <p className="text-xs text-gray-400">Click Refresh or Set path to detect repository.</p>
              ) : isRepo ? (
                <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800 space-y-2">
                  <div className="flex items-center gap-2">
                    <GitBranch size={13} className="text-accent-500" />
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{currentBranch}</span>
                    {remoteUrl && (
                      <span className="text-xs text-gray-400 truncate ml-auto">{remoteUrl}</span>
                    )}
                  </div>
                  {hasLfs && caps?.lfs && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <CheckCircle size={11} /> Git LFS enabled
                    </p>
                  )}
                  {gitStatus && (
                    <pre className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded p-2 whitespace-pre-wrap">
                      {gitStatus}
                    </pre>
                  )}
                  {!gitStatus && (
                    <p className="text-xs text-gray-400">Working tree clean</p>
                  )}
                </div>
              ) : (
                <div className="p-3 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-surface-800 text-center space-y-2">
                  <p className="text-sm text-gray-500">No git repository found in this folder.</p>
                  <button onClick={() => setShowInitForm(v => !v)}
                    className="flex items-center gap-1.5 mx-auto text-sm text-accent-500 hover:text-accent-600">
                    <Plus size={14} /> Initialise repository
                  </button>
                </div>
              )}

              {/* Init form */}
              {showInitForm && isRepo === false && (
                <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-800 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Initialise new repository</h3>
                  <div>
                    <label className={labelCls}>Default branch name</label>
                    <input value={initBranch} onChange={e => setInitBranch(e.target.value)}
                      placeholder="main" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Remote URL (optional — add later with git remote add)</label>
                    <input value={newRemoteUrl} onChange={e => setNewRemoteUrl(e.target.value)}
                      placeholder="git@github.com:username/repo.git  or  https://github.com/…"
                      className={inputCls} />
                  </div>
                  {caps?.lfs && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <Info size={11} /> Git LFS detected — will run <code className="bg-blue-50 dark:bg-blue-900/30 px-1 rounded">git lfs install</code> automatically
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button onClick={handleInit} disabled={isSyncing}
                      className="flex-1 px-3 py-2 bg-accent-500 text-white rounded text-sm hover:bg-accent-600 disabled:opacity-50">
                      git init
                    </button>
                    <button onClick={() => setShowInitForm(false)}
                      className="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* ── Branch picker + sync controls ── */}
          {isRepo && vaultPath && serverUp && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                <GitBranch size={14} className="text-accent-500" />
                Sync
              </h2>

              {/* Branch selector */}
              <div>
                <label className={labelCls}>Branch</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
                      disabled={isSyncing}
                      className={inputCls + ' appearance-none pr-8'}>
                      {branches.map(b => (
                        <option key={b} value={b}>
                          {b}{b === currentBranch ? ' (current)' : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  </div>
                  <button onClick={() => detectRepo()} disabled={isSyncing} title="Refresh branches"
                    className="p-2 border border-gray-300 dark:border-gray-600 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>

              {/* Commit message */}
              <div>
                <label className={labelCls}>Commit message</label>
                <input value={commitMsg} onChange={e => setCommitMsg(e.target.value)}
                  placeholder="Sync from Personal Note App"
                  className={inputCls} />
              </div>

              {/* Action buttons */}
              <div className="flex gap-2">
                <button onClick={handleSync} disabled={isSyncing || !vaultPath}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-accent-500 text-white rounded-lg hover:bg-accent-600 text-sm font-medium disabled:opacity-50 transition-colors">
                  {isSyncing && status === 'syncing'
                    ? <><Loader size={16} className="animate-spin" />Syncing…</>
                    : <><Upload size={16} />Push (add → commit → push)</>}
                </button>
                {remoteUrl && (
                  <button onClick={handlePull} disabled={isSyncing}
                    className="flex items-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium disabled:opacity-50">
                    <Download size={16} />Pull
                  </button>
                )}
              </div>

              {/* Progress bar */}
              {isSyncing && (
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div className="bg-accent-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }} />
                </div>
              )}

              {/* Git LFS section */}
              {caps?.lfs && (
                <details className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <summary className="px-3 py-2 cursor-pointer text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-surface-800 flex items-center gap-1.5 list-none">
                    <GitMerge size={12} className="text-blue-500" />
                    Git LFS — track large files
                  </summary>
                  <div className="p-3 space-y-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800">
                    <p className="text-xs text-gray-400">
                      Track file patterns with Git LFS so large files (images, videos, datasets) are stored efficiently.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {['*.pdf', '*.png', '*.jpg', '*.gif', '*.mp4', '*.zip', '*.sqlite'].map(p => (
                        <button key={p} onClick={() => handleLfsTrack(p)}
                          className="px-2 py-0.5 text-xs border border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20">
                          {p}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400">
                      Or run manually: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">git lfs track "*.ext"</code>
                    </p>
                  </div>
                </details>
              )}
            </section>
          )}

          {/* ── Log ── */}
          {log.length > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                  <Info size={14} className="text-accent-500" /> Log
                </h2>
                <button onClick={clearLog} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  Clear
                </button>
              </div>
              <div className="bg-gray-950 dark:bg-black rounded-lg p-3 font-mono text-xs max-h-72 overflow-y-auto space-y-0.5">
                {log.map((entry, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-gray-600 flex-shrink-0 tabular-nums">{entry.time}</span>
                    <span className={logColor(entry.level)}>{entry.message}</span>
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </section>
          )}

        </div>
      </div>
    </div>
  )
}
