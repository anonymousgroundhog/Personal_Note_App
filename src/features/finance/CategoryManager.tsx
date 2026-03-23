import React, { useState } from 'react'
import { Plus, Trash2, Check, X, Tag } from 'lucide-react'
import { useFinanceStore } from './financeStore'

const PALETTE = [
  '#ef4444','#f97316','#f59e0b','#eab308',
  '#84cc16','#22c55e','#10b981','#14b8a6',
  '#06b6d4','#3b82f6','#6366f1','#8b5cf6',
  '#a855f7','#ec4899','#6b7280','#1e293b',
]

const inputCls = 'text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500'

export default function CategoryManager() {
  const { categories, transactions, addCategory, updateCategory, deleteCategory } = useFinanceStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState('')
  const [editIsIncome, setEditIsIncome] = useState(false)
  const [showPicker, setShowPicker] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [newMode, setNewMode] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(PALETTE[0])
  const [newIsIncome, setNewIsIncome] = useState(false)

  function startEdit(id: string) {
    const cat = categories.find(c => c.id === id)!
    setEditingId(id); setEditName(cat.name); setEditColor(cat.color); setEditIsIncome(cat.isIncome)
  }

  function saveEdit() {
    if (!editingId || !editName.trim()) return
    updateCategory(editingId, { name: editName.trim(), color: editColor, isIncome: editIsIncome })
    setEditingId(null)
  }

  function cancelEdit() { setEditingId(null) }

  function handleDelete(id: string) {
    if (confirmDeleteId === id) {
      deleteCategory(id)
      setConfirmDeleteId(null)
    } else {
      setConfirmDeleteId(id)
      setTimeout(() => setConfirmDeleteId(null), 2500)
    }
  }

  function handleAdd() {
    if (!newName.trim()) return
    addCategory({ name: newName.trim(), color: newColor, isIncome: newIsIncome })
    setNewName(''); setNewColor(PALETTE[0]); setNewIsIncome(false); setNewMode(false)
  }

  function txCount(id: string) {
    return transactions.filter(t => t.categoryId === id).length
  }

  function ColorPicker({ current, onPick }: { current: string; onPick: (c: string) => void }) {
    return (
      <div className="absolute z-50 top-full left-0 mt-1 p-2 bg-white dark:bg-surface-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg grid grid-cols-4 gap-1.5">
        {PALETTE.map(c => (
          <button key={c} onClick={() => onPick(c)}
            className="w-6 h-6 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
            style={{ background: c }}>
            {c === current && <Check size={12} className="text-white" />}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Categories</h2>
          <p className="text-xs text-gray-400 mt-0.5">Organize transactions by category. Assign colors and mark as income or expense.</p>
        </div>
        <button onClick={() => setNewMode(true)} disabled={newMode}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-500 hover:bg-accent-600 text-white rounded text-sm font-medium disabled:opacity-40 transition-colors">
          <Plus size={14} /> Add Category
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Add new row */}
        {newMode && (
          <div className="flex items-center gap-3 px-4 py-3 bg-accent-500/5 border-b border-gray-200 dark:border-gray-700">
            <div className="relative flex-shrink-0">
              <button onClick={() => setShowPicker(showPicker === 'new' ? null : 'new')}
                className="w-7 h-7 rounded-full border-2 border-white dark:border-surface-700 shadow-sm hover:scale-110 transition-transform"
                style={{ background: newColor }} />
              {showPicker === 'new' && <ColorPicker current={newColor} onPick={c => { setNewColor(c); setShowPicker(null) }} />}
            </div>
            <input
              autoFocus
              type="text" value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setNewMode(false) }}
              placeholder="Category name…"
              className={`${inputCls} flex-1`}
            />
            <select value={newIsIncome ? 'income' : 'expense'} onChange={e => setNewIsIncome(e.target.value === 'income')}
              className={`${inputCls} w-28`}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <button onClick={handleAdd} disabled={!newName.trim()} className="p-1.5 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded disabled:opacity-40">
              <Check size={15} />
            </button>
            <button onClick={() => setNewMode(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded">
              <X size={15} />
            </button>
          </div>
        )}

        {/* Category list */}
        {categories.length === 0 && !newMode ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
            <Tag size={28} className="opacity-30" />
            <p className="text-sm">No categories yet</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {categories.map(cat => {
              const count = txCount(cat.id)
              const isEditing = editingId === cat.id
              return (
                <li key={cat.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-surface-800 group">
                  {/* Color swatch */}
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={() => setShowPicker(showPicker === cat.id ? null : cat.id)}
                      className="w-7 h-7 rounded-full border-2 border-white dark:border-surface-700 shadow-sm hover:scale-110 transition-transform"
                      style={{ background: isEditing ? editColor : cat.color }}
                      title="Change color"
                    />
                    {showPicker === cat.id && isEditing && (
                      <ColorPicker current={editColor} onPick={c => { setEditColor(c); setShowPicker(null) }} />
                    )}
                  </div>

                  {/* Name */}
                  {isEditing ? (
                    <input
                      autoFocus
                      type="text" value={editName} onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }}
                      className={`${inputCls} flex-1`}
                    />
                  ) : (
                    <span
                      className="flex-1 text-sm text-gray-700 dark:text-gray-300 cursor-pointer hover:text-accent-500"
                      onClick={() => startEdit(cat.id)}
                    >
                      {cat.name}
                    </span>
                  )}

                  {/* Type */}
                  {isEditing ? (
                    <select value={editIsIncome ? 'income' : 'expense'} onChange={e => setEditIsIncome(e.target.value === 'income')}
                      className={`${inputCls} w-28 py-1`}>
                      <option value="expense">Expense</option>
                      <option value="income">Income</option>
                    </select>
                  ) : (
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${cat.isIncome ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                      {cat.isIncome ? 'Income' : 'Expense'}
                    </span>
                  )}

                  {/* Tx count */}
                  <span className="text-xs text-gray-400 w-14 text-right">
                    {count} tx{count !== 1 ? 's' : ''}
                  </span>

                  {/* Actions */}
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <button onClick={saveEdit} className="p-1.5 text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"><Check size={14} /></button>
                      <button onClick={cancelEdit} className="p-1.5 text-gray-400 hover:text-gray-600 rounded"><X size={14} /></button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleDelete(cat.id)}
                      className={`opacity-0 group-hover:opacity-100 p-1.5 rounded transition-all ${confirmDeleteId === cat.id ? 'text-red-500 bg-red-50 dark:bg-red-900/20 opacity-100' : 'text-gray-400 hover:text-red-500'}`}
                      title={confirmDeleteId === cat.id ? 'Click again to confirm' : count > 0 ? `Delete (${count} transactions will be uncategorized)` : 'Delete'}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {confirmDeleteId && (
        <p className="text-xs text-amber-500 mt-2 flex items-center gap-1">
          ⚠ Click delete again to confirm. {txCount(confirmDeleteId) > 0 ? `${txCount(confirmDeleteId)} transactions will become uncategorized.` : ''}
        </p>
      )}
    </div>
  )
}
