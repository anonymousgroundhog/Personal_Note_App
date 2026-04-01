import { create } from 'zustand'
import type { GHRepo, GHCommit } from '../lib/github/githubApi'

interface RepoActivity {
  commits: GHCommit[]
  loadingCommits: boolean
  errorCommits: string | null
  lastUpdatedCommits: number | null
}

interface AccountData {
  token: string
  username: string
  repos: GHRepo[]
  lastUpdated: number | null
  loading: boolean
  error: string | null
  activity: Record<string, RepoActivity>
}

interface ReposState {
  accounts: Record<string, AccountData>
  activeAccount: string | null
  addAccount: (token: string, username: string) => void
  removeAccount: (username: string) => void
  setActiveAccount: (username: string) => void
  setRepos: (username: string, repos: GHRepo[]) => void
  setLoading: (username: string, loading: boolean) => void
  setError: (username: string, error: string | null) => void
  setCommits: (username: string, repoName: string, commits: GHCommit[]) => void
  setLoadingCommits: (username: string, repoName: string, loading: boolean) => void
  setErrorCommits: (username: string, repoName: string, error: string | null) => void
  getActiveAccount: () => AccountData | null
  getAllAccounts: () => AccountData[]
}

function loadAccounts(): Record<string, AccountData> {
  try {
    const stored = localStorage.getItem('githubAccounts')
    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

function loadActiveAccount(): string | null {
  try {
    return localStorage.getItem('activeGithubAccount')
  } catch {
    return null
  }
}

export const useReposStore = create<ReposState>((set, get) => ({
  accounts: loadAccounts(),
  activeAccount: loadActiveAccount(),

  addAccount: (token: string, username: string) =>
    set((state) => {
      const updated = {
        ...state.accounts,
        [username]: {
          token,
          username,
          repos: [],
          lastUpdated: null,
          loading: false,
          error: null,
          activity: {},
        },
      }
      localStorage.setItem('githubAccounts', JSON.stringify(updated))
      return { accounts: updated, activeAccount: username }
    }),

  removeAccount: (username: string) =>
    set((state) => {
      const updated = { ...state.accounts }
      delete updated[username]
      localStorage.setItem('githubAccounts', JSON.stringify(updated))
      const newActive =
        state.activeAccount === username
          ? Object.keys(updated)[0] || null
          : state.activeAccount
      if (newActive) localStorage.setItem('activeGithubAccount', newActive)
      return { accounts: updated, activeAccount: newActive }
    }),

  setActiveAccount: (username: string) => {
    localStorage.setItem('activeGithubAccount', username)
    set({ activeAccount: username })
  },

  setRepos: (username: string, repos: GHRepo[]) =>
    set((state) => ({
      accounts: {
        ...state.accounts,
        [username]: {
          ...state.accounts[username],
          repos,
          lastUpdated: Date.now(),
          error: null,
        },
      },
    })),

  setLoading: (username: string, loading: boolean) =>
    set((state) => ({
      accounts: {
        ...state.accounts,
        [username]: {
          ...state.accounts[username],
          loading,
        },
      },
    })),

  setError: (username: string, error: string | null) =>
    set((state) => ({
      accounts: {
        ...state.accounts,
        [username]: {
          ...state.accounts[username],
          error,
        },
      },
    })),

  setCommits: (username: string, repoName: string, commits: GHCommit[]) =>
    set((state) => ({
      accounts: {
        ...state.accounts,
        [username]: {
          ...state.accounts[username],
          activity: {
            ...state.accounts[username].activity,
            [repoName]: {
              ...state.accounts[username].activity[repoName],
              commits,
              lastUpdatedCommits: Date.now(),
              errorCommits: null,
            },
          },
        },
      },
    })),

  setLoadingCommits: (username: string, repoName: string, loading: boolean) =>
    set((state) => ({
      accounts: {
        ...state.accounts,
        [username]: {
          ...state.accounts[username],
          activity: {
            ...state.accounts[username].activity,
            [repoName]: {
              ...state.accounts[username].activity[repoName],
              loadingCommits: loading,
            },
          },
        },
      },
    })),

  setErrorCommits: (username: string, repoName: string, error: string | null) =>
    set((state) => ({
      accounts: {
        ...state.accounts,
        [username]: {
          ...state.accounts[username],
          activity: {
            ...state.accounts[username].activity,
            [repoName]: {
              ...state.accounts[username].activity[repoName],
              errorCommits: error,
            },
          },
        },
      },
    })),

  getActiveAccount: () => {
    const state = get()
    return state.activeAccount ? state.accounts[state.activeAccount] || null : null
  },

  getAllAccounts: () => Object.values(get().accounts),
}))
