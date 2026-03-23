import React, { useState, useEffect, useCallback } from 'react'
import { DollarSign, LayoutDashboard, List, Upload, Tag, Plus, Save, FolderOpen, Check, AlertCircle, Loader2 } from 'lucide-react'
import { useFinanceStore } from './financeStore'
import { useVaultStore } from '../../stores/vaultStore'
import { getFileHandle, writeFile } from '../../lib/fs/fileSystemApi'
import { formatCurrency } from './financeUtils'
import FinanceDashboard from './FinanceDashboard'
import TransactionTable from './TransactionTable'
import TransactionForm from './TransactionForm'
import CsvImport from './CsvImport'
import CategoryManager from './CategoryManager'

const VAULT_FILE = 'finance/data.json'

type Tab = 'dashboard' | 'transactions' | 'import' | 'categories'
type SyncStatus = 'idle' | 'saving' | 'saved' | 'loading' | 'error'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard',    label: 'Dashboard',    icon: <LayoutDashboard size={14} /> },
  { id: 'transactions', label: 'Transactions', icon: <List size={14} /> },
  { id: 'import',       label: 'Import CSV',   icon: <Upload size={14} /> },
  { id: 'categories',   label: 'Categories',   icon: <Tag size={14} /> },
]

export default function FinanceView() {
  const [tab, setTab] = useState<Tab>('dashboard')
  const [showAddForm, setShowAddForm] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [syncMsg, setSyncMsg] = useState('')

  const { getTotalBalance, transactions, categories } = useFinanceStore()
  const { rootHandle } = useVaultStore()
  const hasVault = !!rootHandle

  const balance = getTotalBalance()

  // ── Load from vault on mount (if vault is open) ───────────────────────────
  useEffect(() => {
    if (!rootHandle) return
    loadFromVault()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootHandle])

  const loadFromVault = useCallback(async () => {
    if (!rootHandle) return
    setSyncStatus('loading')
    setSyncMsg('')
    try {
      const handle = await getFileHandle(rootHandle, VAULT_FILE, false)
      const file = await handle.getFile()
      const text = await file.text()
      const data = JSON.parse(text)
      // Merge into store — replace everything from vault
      useFinanceStore.setState({
        transactions: data.transactions ?? [],
        categories: data.categories ?? [],
      })
      // Persist to localStorage too so it survives page reload without vault
      localStorage.setItem('finance_data_v1', JSON.stringify({
        transactions: data.transactions ?? [],
        categories: data.categories ?? [],
      }))
      setSyncStatus('saved')
      setSyncMsg(`Loaded ${data.transactions?.length ?? 0} transactions from vault`)
      setTimeout(() => setSyncStatus('idle'), 3000)
    } catch (e: unknown) {
      // File doesn't exist yet — that's fine, not an error
      if (e instanceof Error && e.name === 'NotFoundError') {
        setSyncStatus('idle')
      } else {
        setSyncStatus('error')
        setSyncMsg(e instanceof Error ? e.message : 'Failed to load from vault')
        setTimeout(() => setSyncStatus('idle'), 4000)
      }
    }
  }, [rootHandle])

  const saveToVault = useCallback(async () => {
    if (!rootHandle) return
    setSyncStatus('saving')
    setSyncMsg('')
    try {
      const handle = await getFileHandle(rootHandle, VAULT_FILE, true)
      const data = { transactions, categories, savedAt: new Date().toISOString() }
      await writeFile(handle, JSON.stringify(data, null, 2))
      setSyncStatus('saved')
      setSyncMsg(`Saved ${transactions.length} transactions`)
      setTimeout(() => setSyncStatus('idle'), 3000)
    } catch (e: unknown) {
      setSyncStatus('error')
      setSyncMsg(e instanceof Error ? e.message : 'Failed to save')
      setTimeout(() => setSyncStatus('idle'), 4000)
    }
  }, [rootHandle, transactions, categories])

  // ── Sync status indicator ─────────────────────────────────────────────────
  function SyncIndicator() {
    if (!hasVault) return null
    return (
      <div className="flex items-center gap-1.5 text-xs">
        {syncStatus === 'saving' && (
          <span className="flex items-center gap-1 text-gray-400"><Loader2 size={12} className="animate-spin" /> Saving…</span>
        )}
        {syncStatus === 'loading' && (
          <span className="flex items-center gap-1 text-gray-400"><Loader2 size={12} className="animate-spin" /> Loading…</span>
        )}
        {syncStatus === 'saved' && (
          <span className="flex items-center gap-1 text-green-500"><Check size={12} /> {syncMsg}</span>
        )}
        {syncStatus === 'error' && (
          <span className="flex items-center gap-1 text-red-400" title={syncMsg}><AlertCircle size={12} /> {syncMsg}</span>
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-surface-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <DollarSign size={20} className="text-accent-500" />
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Finance</h1>

        {/* Balance pill */}
        {transactions.length > 0 && (
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold tabular-nums ${balance >= 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-red-100 dark:bg-red-900/30 text-red-500'}`}>
            {balance >= 0 ? '+' : ''}{formatCurrency(balance)}
          </span>
        )}

        <SyncIndicator />

        <div className="ml-auto flex items-center gap-2">
          {/* Vault save/load buttons */}
          {hasVault ? (
            <>
              <button
                onClick={loadFromVault}
                disabled={syncStatus === 'saving' || syncStatus === 'loading'}
                title="Load finance data from vault"
                className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-surface-800 disabled:opacity-40 transition-colors"
              >
                <FolderOpen size={13} /> Load
              </button>
              <button
                onClick={saveToVault}
                disabled={syncStatus === 'saving' || syncStatus === 'loading'}
                title={`Save to vault as ${VAULT_FILE}`}
                className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-surface-800 disabled:opacity-40 transition-colors"
              >
                <Save size={13} /> Save to Vault
              </button>
            </>
          ) : (
            <span className="text-[11px] text-gray-400 italic" title="Open a vault to enable saving">
              Open a vault to save data
            </span>
          )}

          <button
            onClick={() => { setShowAddForm(true); setTab('transactions') }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-500 hover:bg-accent-600 text-white rounded text-sm font-medium transition-colors"
          >
            <Plus size={14} /> Add Transaction
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0.5 px-4 pt-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-t transition-colors border-b-2 -mb-px ${
              tab === t.id
                ? 'border-accent-500 text-accent-500 font-medium'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div className="flex-1 flex overflow-hidden">
        {tab === 'dashboard' && <FinanceDashboard />}

        {tab === 'transactions' && (
          <div className="flex-1 flex overflow-hidden">
            <TransactionTable />
            {showAddForm && (
              <TransactionForm onClose={() => setShowAddForm(false)} />
            )}
          </div>
        )}

        {tab === 'import' && <CsvImport />}
        {tab === 'categories' && <CategoryManager />}
      </div>
    </div>
  )
}
