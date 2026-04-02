import React, { useState, useCallback, useEffect } from 'react'
import {
  Github, RefreshCw, Loader, ExternalLink, Star, GitFork, Clock,
  AlertTriangle, Plus, Trash2, CheckCircle, Eye, EyeOff, Code,
  ChevronDown, GitCommit, HelpCircle, X,
} from 'lucide-react'
import { useReposStore } from '../../stores/reposStore'
import { listUserRepos, getAuthenticatedUser, listCommits } from '../../lib/github/githubApi'

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-surface-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-3">
            <HelpCircle size={20} className="text-accent-500" />
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Repositories Dashboard Help</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-surface-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Getting Started */}
          <section>
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
              <Github size={16} className="text-accent-500" />
              Getting Started
            </h3>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>
                <strong>1. Add Your GitHub Account</strong><br />
                Click "Add Account" and paste your GitHub personal access token. Don't have one? Create one at{' '}
                <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">
                  github.com/settings/tokens
                </code>
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500 ml-4">
                You need <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">repo</code> and{' '}
                <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">read:user</code> permissions at minimum.
              </p>
              <p>
                <strong>2. View Your Repositories</strong><br />
                Your repositories will load automatically. Click on any account card to switch between multiple GitHub accounts.
              </p>
              <p>
                <strong>3. Explore Repository Details</strong><br />
                Each repository shows metadata like stars, forks, language, and last update time. Click the repository name to visit it on GitHub.
              </p>
            </div>
          </section>

          {/* Features */}
          <section>
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
              <Code size={16} className="text-accent-500" />
              Key Features
            </h3>
            <div className="space-y-3">
              <div className="bg-gray-50 dark:bg-surface-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">📊 Repository Metadata</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  See at a glance: number of stars, forks, programming language, description, and when it was last updated.
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-surface-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">📜 Recent Commits</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Click the <ChevronDown size={12} className="inline" /> arrow next to any repository to see the 10 most recent commits. Each commit shows the message, author, and timestamp.
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-surface-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">🔀 Sort & Filter</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  <strong>Sort by:</strong> Recently updated (default), stars, or alphabetically.
                  <br />
                  <strong>Filter:</strong> Toggle "Public Only" to hide private repositories.
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-surface-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">👥 Multiple Accounts</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Add and switch between multiple GitHub accounts. Each account's repositories are tracked separately. Remove accounts anytime by clicking the trash icon.
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-surface-700 p-3 rounded-lg border border-gray-200 dark:border-gray-600">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">🔄 Auto-Refresh</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Click the refresh icon to manually fetch the latest repository data. Data is cached locally between refreshes.
                </p>
              </div>
            </div>
          </section>

          {/* Tips */}
          <section>
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
              <Star size={16} className="text-accent-500" />
              Tips & Tricks
            </h3>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex gap-3">
                <span className="text-accent-500 font-bold flex-shrink-0">•</span>
                <span><strong>Expand multiple repos:</strong> Click the chevron on several repositories to compare recent activity across projects.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-accent-500 font-bold flex-shrink-0">•</span>
                <span><strong>Check commit history:</strong> Quickly see who worked on what and when by expanding repos and reviewing commits.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-accent-500 font-bold flex-shrink-0">•</span>
                <span><strong>Direct GitHub links:</strong> Click repository names, commit hashes, or the external link icon to jump straight to GitHub.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-accent-500 font-bold flex-shrink-0">•</span>
                <span><strong>Data is cached:</strong> Repository and commit data persists in your browser, so you can work offline after the first load.</span>
              </li>
              <li className="flex gap-3">
                <span className="text-accent-500 font-bold flex-shrink-0">•</span>
                <span><strong>Manage tokens securely:</strong> Tokens are stored locally in your browser only. Never stored on any server.</span>
              </li>
            </ul>
          </section>

          {/* Troubleshooting */}
          <section>
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3 flex items-center gap-2">
              <AlertTriangle size={16} className="text-accent-500" />
              Troubleshooting
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">❌ "Invalid token" error</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Check that your token is valid and has the required scopes. Tokens expire after a certain period—you may need to generate a new one.
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">⏳ Commits not loading</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Try clicking the repository chevron again. If it persists, check your internet connection or try refreshing the page.
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">🚫 API rate limit reached</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  GitHub limits API requests. Wait an hour before making more requests, or use a different token with a fresh rate limit.
                </p>
              </div>

              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">🔓 Privacy & Security</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Your GitHub token is stored only in your browser's local storage. It's never sent to any server besides GitHub's official API. For maximum security, use a token with minimal required permissions.
                </p>
              </div>
            </div>
          </section>

          {/* Keyboard Shortcuts */}
          <section>
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3">⌨️ Quick Actions</h3>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex justify-between items-center bg-gray-50 dark:bg-surface-700 p-2.5 rounded border border-gray-200 dark:border-gray-600">
                <span>Click repo name</span>
                <code className="bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded text-xs">→ Visit on GitHub</code>
              </div>
              <div className="flex justify-between items-center bg-gray-50 dark:bg-surface-700 p-2.5 rounded border border-gray-200 dark:border-gray-600">
                <span>Click chevron</span>
                <code className="bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded text-xs">→ Show/hide commits</code>
              </div>
              <div className="flex justify-between items-center bg-gray-50 dark:bg-surface-700 p-2.5 rounded border border-gray-200 dark:border-gray-600">
                <span>Click account card</span>
                <code className="bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded text-xs">→ Switch account</code>
              </div>
              <div className="flex justify-between items-center bg-gray-50 dark:bg-surface-700 p-2.5 rounded border border-gray-200 dark:border-gray-600">
                <span>Click commit hash</span>
                <code className="bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded text-xs">→ View commit details</code>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2 rounded-lg bg-accent-500 hover:bg-accent-600 text-white text-sm font-medium transition-colors"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ReposView() {
  const {
    accounts,
    activeAccount,
    addAccount,
    removeAccount,
    setActiveAccount,
    setRepos,
    setLoading,
    setError,
    setCommits,
    setLoadingCommits,
    setErrorCommits,
    getActiveAccount,
    getAllAccounts,
  } = useReposStore()

  const [tokenInput, setTokenInput] = useState('')
  const [usernameInput, setUsernameInput] = useState('')
  const [addingAccount, setAddingAccount] = useState(false)
  const [loadingUsername, setLoadingUsername] = useState(false)
  const [sortBy, setSortBy] = useState<'updated' | 'stars' | 'name'>('updated')
  const [filterPrivate, setFilterPrivate] = useState(false)
  const [expandedRepos, setExpandedRepos] = useState<Set<string>>(new Set())
  const [showHelp, setShowHelp] = useState(false)

  const activeAcc = getActiveAccount()

  const fetchRepos = useCallback(
    async (account = activeAcc) => {
      if (!account) return
      setLoading(account.username, true)
      try {
        const repos = await listUserRepos(account.token)
        setRepos(account.username, repos)
        setError(account.username, null)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setError(account.username, msg)
      }
      setLoading(account.username, false)
    },
    [activeAcc, setLoading, setRepos, setError]
  )

  // Auto-fetch repos when active account changes
  useEffect(() => {
    if (activeAcc && activeAcc.repos.length === 0) {
      fetchRepos(activeAcc)
    }
  }, [activeAccount])

  const fetchCommits = useCallback(
    async (username: string, owner: string, repoName: string, token: string) => {
      setLoadingCommits(username, repoName, true)
      try {
        const commits = await listCommits(token, owner, repoName, 15)
        setCommits(username, repoName, commits)
        setErrorCommits(username, repoName, null)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        setErrorCommits(username, repoName, msg)
      }
      setLoadingCommits(username, repoName, false)
    },
    [setLoadingCommits, setCommits, setErrorCommits]
  )

  const toggleExpanded = (repoFullName: string, username: string, owner: string, repoName: string, token: string) => {
    const newExpanded = new Set(expandedRepos)
    if (newExpanded.has(repoFullName)) {
      newExpanded.delete(repoFullName)
    } else {
      newExpanded.add(repoFullName)
      // Fetch commits when expanding
      const activity = accounts[username]?.activity?.[repoName]
      if (!activity?.commits || activity.commits.length === 0) {
        fetchCommits(username, owner, repoName, token)
      }
    }
    setExpandedRepos(newExpanded)
  }

  const handleAddAccount = async () => {
    if (!tokenInput.trim()) return

    setLoadingUsername(true)
    try {
      const user = await getAuthenticatedUser(tokenInput.trim())
      addAccount(tokenInput.trim(), user.login)
      setTokenInput('')
      setUsernameInput('')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      alert(`Failed to authenticate: ${msg}`)
    } finally {
      setLoadingUsername(false)
    }
  }

  const handleRemoveAccount = (username: string) => {
    if (confirm(`Remove account "${username}"?`)) {
      removeAccount(username)
    }
  }

  const allAccounts = getAllAccounts()

  // Sort and filter repos
  const currentRepos = activeAcc?.repos || []
  const filteredRepos = filterPrivate ? currentRepos.filter(r => !r.private) : currentRepos
  const sortedRepos = [...filteredRepos].sort((a, b) => {
    if (sortBy === 'stars') return (b.stargazers_count || 0) - (a.stargazers_count || 0)
    if (sortBy === 'name') return a.name.localeCompare(b.name)
    return new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
  })

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return 'Never'
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`
    if (days < 365) return `${Math.floor(days / 30)} months ago`
    return `${Math.floor(days / 365)} years ago`
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-surface-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <Github size={20} className="text-accent-500" />
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Repositories</h1>
        <span className="text-xs text-gray-400 ml-2">
          {allAccounts.length} account{allAccounts.length !== 1 ? 's' : ''}
          {activeAcc && ` • ${sortedRepos.length} repos`}
        </span>
        <button
          onClick={() => setShowHelp(true)}
          className="ml-auto p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          title="Help"
        >
          <HelpCircle size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* ── Account Management ── */}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
              <Github size={14} className="text-accent-500" />
              GitHub Accounts
            </h2>

            {/* Add new account form */}
            <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800 space-y-3">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Add a GitHub account using a personal access token. Each account will be tracked separately.
              </p>
              <div className="space-y-2">
                <input
                  type="password"
                  placeholder="GitHub personal access token"
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddAccount()}
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
                />
              </div>
              <button
                onClick={handleAddAccount}
                disabled={!tokenInput.trim() || loadingUsername}
                className="flex items-center gap-2 px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {loadingUsername ? (
                  <>
                    <Loader size={14} className="animate-spin" />
                    Authenticating…
                  </>
                ) : (
                  <>
                    <Plus size={14} />
                    Add Account
                  </>
                )}
              </button>
            </div>

            {/* Account list */}
            {allAccounts.length > 0 && (
              <div className="space-y-2">
                {allAccounts.map(account => (
                  <div
                    key={account.username}
                    onClick={() => setActiveAccount(account.username)}
                    className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                      activeAccount === account.username
                        ? 'border-accent-500 bg-accent-50 dark:bg-accent-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-accent-300 dark:hover:border-accent-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium text-gray-800 dark:text-gray-200">@{account.username}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {account.repos.length} repositories
                            {account.lastUpdated && (
                              <>
                                {' • '}
                                Updated{' '}
                                {formatDate(new Date(account.lastUpdated).toISOString())}
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {activeAccount === account.username && (
                          <CheckCircle size={16} className="text-accent-500" />
                        )}
                        {account.error && (
                          <AlertTriangle size={16} className="text-red-500" title={account.error} />
                        )}
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            handleRemoveAccount(account.username)
                          }}
                          className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500"
                          title="Remove account"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Repositories ── */}
          {activeAcc && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                  <Code size={14} className="text-accent-500" />
                  {activeAcc.username}'s Repositories
                </h2>
                <button
                  onClick={() => fetchRepos(activeAcc)}
                  disabled={activeAcc.loading}
                  className="flex items-center gap-1 text-xs text-accent-500 hover:text-accent-600 disabled:opacity-50"
                >
                  {activeAcc.loading ? (
                    <Loader size={12} className="animate-spin" />
                  ) : (
                    <RefreshCw size={12} />
                  )}
                  Refresh
                </button>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3 flex-wrap">
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
                >
                  <option value="updated">Sort: Recently Updated</option>
                  <option value="stars">Sort: Stars</option>
                  <option value="name">Sort: Name</option>
                </select>
                <button
                  onClick={() => setFilterPrivate(!filterPrivate)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 text-xs rounded transition-colors ${
                    filterPrivate
                      ? 'bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  }`}
                >
                  {filterPrivate ? (
                    <EyeOff size={11} />
                  ) : (
                    <Eye size={11} />
                  )}
                  Public Only
                </button>
              </div>

              {/* Error message */}
              {activeAcc.error && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <p className="text-xs text-red-600 dark:text-red-400 flex items-center gap-2">
                    <AlertTriangle size={12} />
                    {activeAcc.error}
                  </p>
                </div>
              )}

              {/* Loading state */}
              {activeAcc.loading && (
                <div className="flex items-center justify-center gap-2 py-8 text-gray-400">
                  <Loader size={16} className="animate-spin" />
                  Loading repositories…
                </div>
              )}

              {/* Repos list */}
              {!activeAcc.loading && sortedRepos.length > 0 && (
                <div className="space-y-2">
                  {sortedRepos.map(repo => {
                    const isExpanded = expandedRepos.has(repo.full_name)
                    const activity = activeAcc.activity?.[repo.name] || { commits: [], loadingCommits: false, errorCommits: null, lastUpdatedCommits: null }
                    return (
                      <div key={repo.full_name} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:border-accent-300 dark:hover:border-accent-700 transition-colors">
                        {/* Repo header */}
                        <div className="flex items-start justify-between gap-3 p-3 hover:bg-gray-50 dark:hover:bg-surface-800">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <button
                                onClick={() => toggleExpanded(repo.full_name, activeAccount!, repo.owner.login, repo.name, activeAcc.token)}
                                className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                                title={isExpanded ? 'Hide activity' : 'Show activity'}
                              >
                                <ChevronDown
                                  size={16}
                                  className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                />
                              </button>
                              <p className="font-medium text-gray-800 dark:text-gray-200 truncate flex items-center gap-2">
                                <a
                                  href={repo.html_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="hover:text-accent-500 truncate"
                                >
                                  {repo.name}
                                </a>
                                {repo.private && (
                                  <span className="text-[10px] bg-gray-200 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-400 flex-shrink-0">
                                    Private
                                  </span>
                                )}
                              </p>
                            </div>
                            {repo.description && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 ml-6">
                                {repo.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 flex-wrap mt-2 ml-6">
                              <span className="flex items-center gap-1">
                                <Star size={12} />
                                {(repo.stargazers_count || 0).toLocaleString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <GitFork size={12} />
                                {(repo.forks_count || 0).toLocaleString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock size={12} />
                                {formatDate(repo.updated_at)}
                              </span>
                              {repo.language && (
                                <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                                  {repo.language}
                                </span>
                              )}
                            </div>
                          </div>
                          <a
                            href={repo.html_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-gray-400 hover:text-accent-500 flex-shrink-0 mt-1"
                          >
                            <ExternalLink size={14} />
                          </a>
                        </div>

                        {/* Activity section */}
                        {isExpanded && (
                          <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800 p-3 space-y-2">
                            <div className="flex items-center gap-2 mb-2">
                              <GitCommit size={13} className="text-accent-500" />
                              <h4 className="text-xs font-semibold text-gray-700 dark:text-gray-200">Recent Commits</h4>
                              {activity?.loadingCommits && (
                                <Loader size={11} className="animate-spin text-gray-400" />
                              )}
                            </div>

                            {activity?.errorCommits && (
                              <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1.5 rounded border border-red-200 dark:border-red-800">
                                {activity.errorCommits}
                              </div>
                            )}

                            {activity?.loadingCommits && (
                              <div className="flex items-center justify-center gap-2 py-4 text-gray-400">
                                <Loader size={12} className="animate-spin" />
                                Loading commits…
                              </div>
                            )}

                            {activity?.commits && activity.commits.length > 0 && !activity.loadingCommits && (
                              <div className="space-y-1.5">
                                {activity.commits.slice(0, 10).map(commit => {
                                  const commitDate = commit.commit.author?.date
                                  const message = commit.commit.message.split('\n')[0]
                                  const author = commit.commit.author?.name || 'Unknown'
                                  return (
                                    <a
                                      key={commit.sha}
                                      href={commit.html_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="block p-2 rounded hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors group"
                                    >
                                      <div className="flex items-start gap-2">
                                        <code className="text-[10px] text-gray-400 group-hover:text-accent-500 font-mono flex-shrink-0 mt-0.5">
                                          {commit.sha.slice(0, 7)}
                                        </code>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs text-gray-800 dark:text-gray-200 truncate group-hover:text-accent-500">
                                            {message}
                                          </p>
                                          <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5">
                                            <span className="truncate">{author}</span>
                                            {commitDate && (
                                              <>
                                                <span>•</span>
                                                <span className="flex-shrink-0">
                                                  {formatDate(commitDate)}
                                                </span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </a>
                                  )
                                })}
                              </div>
                            )}

                            {!activity.loadingCommits && activity.commits && activity.commits.length === 0 && !activity.errorCommits && (
                              <div className="text-xs text-gray-400 text-center py-2">
                                No commits found
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Empty state */}
              {!activeAcc.loading && sortedRepos.length === 0 && (
                <div className="text-center py-8">
                  <Code size={24} className="text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {filterPrivate ? 'No public repositories found' : 'No repositories found'}
                  </p>
                </div>
              )}
            </section>
          )}

          {/* Empty state - no accounts */}
          {allAccounts.length === 0 && (
            <div className="text-center py-12">
              <Github size={32} className="text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">
                Add a GitHub account to view your repositories
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Help Modal */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  )
}
