import { create } from 'zustand'
import type { Transaction, FinanceCategory } from './types'
import { groupByMonth, groupByCategory, computeRunningBalance } from './financeUtils'

const STORAGE_KEY = 'finance_data_v1'

const DEFAULT_CATEGORIES: FinanceCategory[] = [
  { id: 'cat-income',    name: 'Income',        color: '#22c55e', isIncome: true  },
  { id: 'cat-housing',   name: 'Housing',        color: '#ef4444', isIncome: false },
  { id: 'cat-food',      name: 'Food & Dining',  color: '#f59e0b', isIncome: false },
  { id: 'cat-transport', name: 'Transport',      color: '#3b82f6', isIncome: false },
  { id: 'cat-entertain', name: 'Entertainment',  color: '#8b5cf6', isIncome: false },
  { id: 'cat-health',    name: 'Health',         color: '#10b981', isIncome: false },
  { id: 'cat-shopping',  name: 'Shopping',       color: '#ec4899', isIncome: false },
  { id: 'cat-utilities', name: 'Utilities',      color: '#06b6d4', isIncome: false },
  { id: 'cat-savings',   name: 'Savings',        color: '#84cc16', isIncome: false },
  { id: 'cat-other',     name: 'Other',          color: '#6b7280', isIncome: false },
]

const PALETTE = [
  '#ef4444','#f59e0b','#22c55e','#3b82f6',
  '#8b5cf6','#ec4899','#06b6d4','#84cc16',
  '#10b981','#f97316','#6366f1','#14b8a6',
]

function load(): { transactions: Transaction[]; categories: FinanceCategory[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { transactions: [], categories: DEFAULT_CATEGORIES }
}

function save(state: { transactions: Transaction[]; categories: FinanceCategory[] }) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)) } catch {}
}

interface FinanceState {
  transactions: Transaction[]
  categories: FinanceCategory[]

  addTransaction: (partial: Omit<Transaction, 'id' | 'createdAt'>) => Transaction
  updateTransaction: (id: string, partial: Partial<Transaction>) => void
  deleteTransaction: (id: string) => void
  importTransactions: (txs: Omit<Transaction, 'id' | 'createdAt'>[]) => number

  addCategory: (partial: Omit<FinanceCategory, 'id' | 'color'> & { color?: string }) => FinanceCategory
  updateCategory: (id: string, partial: Partial<FinanceCategory>) => void
  deleteCategory: (id: string) => void

  getMonthSummaries: (count?: number) => ReturnType<typeof groupByMonth>
  getCategorySummaries: (from?: string, to?: string) => ReturnType<typeof groupByCategory>
  getRunningBalance: (from?: string, to?: string) => ReturnType<typeof computeRunningBalance>
  getAccounts: () => string[]
  getTotalBalance: () => number
}

export const useFinanceStore = create<FinanceState>((set, get) => {
  const initial = load()

  const persist = (partial: Partial<{ transactions: Transaction[]; categories: FinanceCategory[] }>) => {
    const next = { ...get(), ...partial }
    save({ transactions: next.transactions, categories: next.categories })
    return partial
  }

  return {
    ...initial,

    addTransaction: (partial) => {
      const tx: Transaction = {
        id: `tx-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        createdAt: Date.now(),
        ...partial,
      }
      set(s => persist({ transactions: [...s.transactions, tx] }))
      return tx
    },

    updateTransaction: (id, partial) => {
      set(s => persist({
        transactions: s.transactions.map(t => t.id === id ? { ...t, ...partial } : t),
      }))
    },

    deleteTransaction: (id) => {
      set(s => persist({ transactions: s.transactions.filter(t => t.id !== id) }))
    },

    importTransactions: (txs) => {
      const existing = new Set(get().transactions.map(t => `${t.date}|${t.description}|${t.amount}`))
      const toAdd: Transaction[] = []
      for (const partial of txs) {
        const key = `${partial.date}|${partial.description}|${partial.amount}`
        if (!existing.has(key)) {
          toAdd.push({
            id: `tx-${Date.now()}-${Math.random().toString(36).slice(2)}-${toAdd.length}`,
            createdAt: Date.now(),
            ...partial,
          })
          existing.add(key)
        }
      }
      if (toAdd.length > 0) {
        set(s => persist({ transactions: [...s.transactions, ...toAdd] }))
      }
      return toAdd.length
    },

    addCategory: (partial) => {
      const cats = get().categories
      const color = partial.color ?? PALETTE[cats.length % PALETTE.length]
      const cat: FinanceCategory = {
        id: `cat-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        ...partial,
        color,
      }
      set(s => persist({ categories: [...s.categories, cat] }))
      return cat
    },

    updateCategory: (id, partial) => {
      set(s => persist({
        categories: s.categories.map(c => c.id === id ? { ...c, ...partial } : c),
      }))
    },

    deleteCategory: (id) => {
      set(s => persist({
        categories: s.categories.filter(c => c.id !== id),
        transactions: s.transactions.map(t => t.categoryId === id ? { ...t, categoryId: null } : t),
      }))
    },

    getMonthSummaries: (count = 6) => groupByMonth(get().transactions, count),

    getCategorySummaries: (from?, to?) => {
      let txs = get().transactions
      if (from) txs = txs.filter(t => t.date >= from)
      if (to) txs = txs.filter(t => t.date <= to)
      return groupByCategory(txs, get().categories)
    },

    getRunningBalance: (from?, to?) => {
      let txs = get().transactions
      if (from) txs = txs.filter(t => t.date >= from)
      if (to) txs = txs.filter(t => t.date <= to)
      return computeRunningBalance(txs)
    },

    getAccounts: () => [...new Set(get().transactions.map(t => t.account).filter(Boolean))],

    getTotalBalance: () => get().transactions.reduce((sum, t) => sum + t.amount, 0),
  }
})
