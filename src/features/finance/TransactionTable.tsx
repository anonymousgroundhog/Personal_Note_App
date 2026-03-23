import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Search, ChevronUp, ChevronDown, Pencil, Trash2, Filter, X, Plus } from 'lucide-react'
import { useFinanceStore } from './financeStore'
import { formatCurrency } from './financeUtils'
import TransactionForm from './TransactionForm'
import type { Transaction } from './types'

type SortKey = 'date' | 'description' | 'amount' | 'account'
type SortDir = 'asc' | 'desc'

const inputCls = 'text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500'

// ── Inline category picker ────────────────────────────────────────────────────
interface CategoryPickerProps {
  txId: string
  currentCategoryId: string | null
  onClose: () => void
}

function CategoryPicker({ txId, currentCategoryId, onClose }: CategoryPickerProps) {
  const { categories, updateTransaction, addCategory } = useFinanceStore()
  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')
  const [showNew, setShowNew] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [onClose])

  const filtered = categories.filter(c =>
    !search.trim() || c.name.toLowerCase().includes(search.toLowerCase())
  )

  function pick(categoryId: string | null) {
    updateTransaction(txId, { categoryId })
    onClose()
  }

  function createAndPick() {
    const name = (showNew ? newName : search).trim()
    if (!name) return
    const cat = addCategory({ name, isIncome: false })
    updateTransaction(txId, { categoryId: cat.id })
    onClose()
  }

  const query = showNew ? newName : search
  const noExactMatch = query.trim() && !categories.some(c => c.name.toLowerCase() === query.toLowerCase())

  return (
    <div ref={ref} className="absolute z-50 left-0 top-full mt-1 w-52 bg-white dark:bg-surface-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden">
      <div className="p-2 border-b border-gray-100 dark:border-gray-700">
        <input
          ref={inputRef}
          value={search}
          onChange={e => { setSearch(e.target.value); setShowNew(false) }}
          onKeyDown={e => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter' && noExactMatch) createAndPick() }}
          placeholder="Search or create…"
          className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
        />
      </div>
      <div className="max-h-48 overflow-y-auto">
        {/* Clear option */}
        {currentCategoryId && (
          <button onMouseDown={() => pick(null)}
            className="w-full px-3 py-1.5 text-left text-xs text-gray-400 hover:bg-gray-50 dark:hover:bg-surface-700 flex items-center gap-2">
            <X size={10} /> Remove category
          </button>
        )}
        {filtered.map(c => (
          <button key={c.id} onMouseDown={() => pick(c.id)}
            className={`w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-surface-700 ${c.id === currentCategoryId ? 'bg-accent-500/5' : ''}`}>
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.color }} />
            <span className="text-gray-700 dark:text-gray-300 flex-1 truncate">{c.name}</span>
            {c.id === currentCategoryId && <span className="text-accent-500 text-[10px]">✓</span>}
          </button>
        ))}
        {filtered.length === 0 && !noExactMatch && (
          <p className="px-3 py-2 text-xs text-gray-400">No categories found</p>
        )}
        {/* Create new */}
        {noExactMatch && !showNew && (
          <button onMouseDown={createAndPick}
            className="w-full px-3 py-1.5 text-left text-xs text-accent-500 hover:bg-accent-500/5 flex items-center gap-1.5 border-t border-gray-100 dark:border-gray-700">
            <Plus size={10} /> Create "{search.trim()}"
          </button>
        )}
        {!search.trim() && (
          <button onMouseDown={() => { setShowNew(true); setSearch('') }}
            className="w-full px-3 py-1.5 text-left text-xs text-accent-500 hover:bg-accent-500/5 flex items-center gap-1.5 border-t border-gray-100 dark:border-gray-700">
            <Plus size={10} /> New category…
          </button>
        )}
        {showNew && (
          <div className="p-2 border-t border-gray-100 dark:border-gray-700 flex gap-1">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createAndPick(); if (e.key === 'Escape') setShowNew(false) }}
              placeholder="Category name…"
              className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
            />
            <button onMouseDown={createAndPick} disabled={!newName.trim()}
              className="px-2 py-1 bg-accent-500 text-white rounded text-xs disabled:opacity-40">
              Add
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TransactionTable() {
  const { transactions, categories, deleteTransaction } = useFinanceStore()
  const [openPickerTxId, setOpenPickerTxId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [filterCats, setFilterCats] = useState<Set<string>>(new Set())
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [editTx, setEditTx] = useState<Transaction | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const filtered = useMemo(() => {
    let list = [...transactions]
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(t =>
        t.description.toLowerCase().includes(q) ||
        t.account.toLowerCase().includes(q) ||
        t.notes.toLowerCase().includes(q)
      )
    }
    if (filterCats.size > 0) {
      list = list.filter(t => filterCats.has(t.categoryId ?? '__uncat__'))
    }
    if (filterType === 'income') list = list.filter(t => t.amount > 0)
    if (filterType === 'expense') list = list.filter(t => t.amount < 0)
    if (fromDate) list = list.filter(t => t.date >= fromDate)
    if (toDate) list = list.filter(t => t.date <= toDate)
    list.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'date') cmp = a.date.localeCompare(b.date)
      else if (sortKey === 'description') cmp = a.description.localeCompare(b.description)
      else if (sortKey === 'amount') cmp = a.amount - b.amount
      else if (sortKey === 'account') cmp = a.account.localeCompare(b.account)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [transactions, search, filterCats, filterType, fromDate, toDate, sortKey, sortDir])

  const totalFiltered = filtered.reduce((s, t) => s + t.amount, 0)

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <ChevronUp size={12} className="opacity-20" />
    return sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
  }

  function toggleCatFilter(id: string) {
    setFilterCats(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const catMap = new Map(categories.map(c => [c.id, c]))

  function handleDelete(id: string) {
    if (confirmDeleteId === id) {
      deleteTransaction(id)
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(id)
      setTimeout(() => setConfirmDeleteId(null), 2500)
    }
  }

  return (
    <div className="flex flex-1 overflow-hidden">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search transactions…"
                className={`${inputCls} pl-7 w-full`}
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Type filter */}
            <div className="flex rounded overflow-hidden border border-gray-300 dark:border-gray-600 text-xs">
              {(['all','income','expense'] as const).map(t => (
                <button key={t} onClick={() => setFilterType(t)}
                  className={`px-2.5 py-1.5 capitalize transition-colors ${filterType === t ? 'bg-accent-500 text-white' : 'bg-white dark:bg-surface-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-surface-600'}`}>
                  {t}
                </button>
              ))}
            </div>

            <button onClick={() => setShowFilters(v => !v)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded border text-xs transition-colors ${showFilters || filterCats.size > 0 || fromDate || toDate ? 'border-accent-500 text-accent-500 bg-accent-500/10' : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400'}`}>
              <Filter size={12} /> Filters {(filterCats.size > 0 || fromDate || toDate) ? `(${filterCats.size + (fromDate ? 1 : 0) + (toDate ? 1 : 0)})` : ''}
            </button>
          </div>

          {showFilters && (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 dark:text-gray-400">From</span>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className={`${inputCls} py-1`} />
                <span className="text-xs text-gray-500 dark:text-gray-400">To</span>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className={`${inputCls} py-1`} />
              </div>
              <div className="flex flex-wrap gap-1">
                {categories.map(c => (
                  <button key={c.id} onClick={() => toggleCatFilter(c.id)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors border ${filterCats.has(c.id) ? 'border-transparent text-white' : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400'}`}
                    style={filterCats.has(c.id) ? { background: c.color } : {}}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.color }} />
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
              <Search size={32} className="opacity-20" />
              <p className="text-sm">{transactions.length === 0 ? 'No transactions yet' : 'No results match your filters'}</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 dark:bg-surface-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  {([['date','Date'],['description','Description'],['account','Account']] as [SortKey,string][]).map(([k,l]) => (
                    <th key={k} onClick={() => toggleSort(k)}
                      className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none whitespace-nowrap">
                      <span className="flex items-center gap-1">{l} <SortIcon col={k} /></span>
                    </th>
                  ))}
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Category</th>
                  <th onClick={() => toggleSort('amount')}
                    className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 select-none whitespace-nowrap">
                    <span className="flex items-center justify-end gap-1">Amount <SortIcon col="amount" /></span>
                  </th>
                  <th className="px-4 py-2.5 w-16" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map(tx => {
                  const cat = tx.categoryId ? catMap.get(tx.categoryId) : null
                  return (
                    <tr key={tx.id}
                      onClick={() => setEditTx(tx)}
                      className="hover:bg-gray-50 dark:hover:bg-surface-800 cursor-pointer group">
                      <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">{tx.date}</td>
                      <td className="px-4 py-2.5 text-gray-800 dark:text-gray-200 max-w-xs">
                        <span className="truncate block">{tx.description}</span>
                        {tx.notes && <span className="text-[11px] text-gray-400 truncate block">{tx.notes}</span>}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs whitespace-nowrap">{tx.account || '—'}</td>
                      <td className="px-4 py-2.5 relative" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setOpenPickerTxId(openPickerTxId === tx.id ? null : tx.id)}
                          className="group/cat inline-flex items-center gap-1 rounded-full hover:ring-2 hover:ring-accent-400 transition-all"
                          title="Click to change category"
                        >
                          {cat ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium"
                              style={{ background: cat.color + '22', color: cat.color }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: cat.color }} />
                              {cat.name}
                            </span>
                          ) : (
                            <span className="text-[11px] text-gray-400 px-2 py-0.5 rounded-full border border-dashed border-gray-300 dark:border-gray-600 hover:border-accent-400 hover:text-accent-500 transition-colors">
                              — add
                            </span>
                          )}
                        </button>
                        {openPickerTxId === tx.id && (
                          <CategoryPicker
                            txId={tx.id}
                            currentCategoryId={tx.categoryId}
                            onClose={() => setOpenPickerTxId(null)}
                          />
                        )}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-medium tabular-nums whitespace-nowrap ${tx.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                        {formatCurrency(tx.amount)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                          <button onClick={() => setEditTx(tx)} className="p-1 text-gray-400 hover:text-accent-500 rounded">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => handleDelete(tx.id)}
                            className={`p-1 rounded ${confirmDeleteId === tx.id ? 'text-red-500' : 'text-gray-400 hover:text-red-500'}`}>
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="sticky bottom-0 bg-gray-50 dark:bg-surface-800 border-t-2 border-gray-200 dark:border-gray-700">
                <tr>
                  <td colSpan={4} className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                    {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
                  </td>
                  <td className={`px-4 py-2 text-right font-semibold text-sm tabular-nums ${totalFiltered >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                    {formatCurrency(totalFiltered)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* Edit drawer */}
      {editTx && (
        <TransactionForm transaction={editTx} onClose={() => setEditTx(null)} />
      )}
    </div>
  )
}
