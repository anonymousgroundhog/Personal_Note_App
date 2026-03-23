import React, { useState, useRef, useEffect } from 'react'
import { X, Save, Trash2 } from 'lucide-react'
import { useFinanceStore } from './financeStore'
import { formatCurrency, todayIso } from './financeUtils'
import type { Transaction } from './types'

interface Props {
  transaction?: Transaction | null
  onClose: () => void
}

const inputCls = 'w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500'
const labelCls = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'

export default function TransactionForm({ transaction, onClose }: Props) {
  const { addTransaction, updateTransaction, deleteTransaction, categories, getAccounts } = useFinanceStore()
  const accounts = getAccounts()

  const [date, setDate] = useState(transaction?.date ?? todayIso())
  const [description, setDescription] = useState(transaction?.description ?? '')
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : '')
  const [categoryId, setCategoryId] = useState<string | null>(transaction?.categoryId ?? null)
  const [categoryInput, setCategoryInput] = useState(() => {
    if (!transaction?.categoryId) return ''
    return categories.find(c => c.id === transaction.categoryId)?.name ?? ''
  })
  const [account, setAccount] = useState(transaction?.account ?? '')
  const [notes, setNotes] = useState(transaction?.notes ?? '')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showCatDropdown, setShowCatDropdown] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const catRef = useRef<HTMLDivElement>(null)

  const filteredCats = categories.filter(c =>
    !categoryInput.trim() || c.name.toLowerCase().includes(categoryInput.toLowerCase())
  )

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (catRef.current && !catRef.current.contains(e.target as Node)) setShowCatDropdown(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  function validate() {
    const errs: Record<string, string> = {}
    if (!date) errs.date = 'Date required'
    if (!description.trim()) errs.description = 'Description required'
    const num = parseFloat(amount)
    if (isNaN(num) || num === 0) errs.amount = 'Enter a non-zero amount'
    return errs
  }

  function handleSave() {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    const data = {
      date,
      description: description.trim(),
      amount: parseFloat(amount),
      categoryId,
      account: account.trim(),
      notes: notes.trim(),
    }
    if (transaction) updateTransaction(transaction.id, data)
    else addTransaction(data)
    onClose()
  }

  function handleDelete() {
    if (!transaction) return
    if (!confirmDelete) { setConfirmDelete(true); return }
    deleteTransaction(transaction.id)
    onClose()
  }

  const amountNum = parseFloat(amount)
  const isIncome = !isNaN(amountNum) && amountNum > 0

  return (
    <div className="w-80 flex-shrink-0 flex flex-col h-full border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {transaction ? 'Edit Transaction' : 'Add Transaction'}
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded">
          <X size={15} />
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Date */}
        <div>
          <label className={labelCls}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
          {errors.date && <p className="text-xs text-red-500 mt-0.5">{errors.date}</p>}
        </div>

        {/* Description */}
        <div>
          <label className={labelCls}>Description</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)}
            placeholder="What was this for?" className={inputCls} />
          {errors.description && <p className="text-xs text-red-500 mt-0.5">{errors.description}</p>}
        </div>

        {/* Amount */}
        <div>
          <label className={labelCls}>Amount</label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
            <input
              type="number" step="0.01"
              value={amount} onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
              className={`${inputCls} pl-6 ${!isNaN(amountNum) && amountNum > 0 ? 'text-green-600 dark:text-green-400' : !isNaN(amountNum) && amountNum < 0 ? 'text-red-500' : ''}`}
            />
          </div>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {!isNaN(amountNum) && amountNum !== 0
              ? isIncome ? '↑ Income' : '↓ Expense'
              : 'Positive = income · Negative = expense'}
          </p>
          {errors.amount && <p className="text-xs text-red-500 mt-0.5">{errors.amount}</p>}
        </div>

        {/* Category combobox */}
        <div ref={catRef} className="relative">
          <label className={labelCls}>Category</label>
          <input
            type="text"
            value={categoryInput}
            onChange={e => {
              setCategoryInput(e.target.value)
              setCategoryId(null)
              setShowCatDropdown(true)
            }}
            onFocus={() => setShowCatDropdown(true)}
            placeholder="Search or pick a category…"
            className={inputCls}
            autoComplete="off"
          />
          {showCatDropdown && (
            <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-white dark:bg-surface-800 border border-gray-200 dark:border-gray-700 rounded shadow-lg max-h-48 overflow-y-auto">
              {filteredCats.length === 0 && (
                <div className="px-3 py-2 text-xs text-gray-400">No matching categories</div>
              )}
              {filteredCats.map(c => (
                <button
                  key={c.id}
                  onMouseDown={() => {
                    setCategoryId(c.id)
                    setCategoryInput(c.name)
                    setShowCatDropdown(false)
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-surface-700 text-sm text-left"
                >
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
                  <span className="text-gray-700 dark:text-gray-300">{c.name}</span>
                  {c.isIncome && <span className="ml-auto text-[10px] text-green-500">income</span>}
                </button>
              ))}
              {categoryInput.trim() && !categories.some(c => c.name.toLowerCase() === categoryInput.toLowerCase()) && (
                <button
                  onMouseDown={() => {
                    // Will be handled in CategoryManager; for now just keep the text
                    setShowCatDropdown(false)
                  }}
                  className="w-full px-3 py-1.5 text-xs text-accent-500 hover:bg-gray-50 dark:hover:bg-surface-700 text-left"
                >
                  + Create "{categoryInput}"
                </button>
              )}
            </div>
          )}
        </div>

        {/* Account */}
        <div>
          <label className={labelCls}>Account / Source</label>
          <input
            type="text"
            value={account}
            onChange={e => setAccount(e.target.value)}
            placeholder="e.g. Chase Checking, Amex…"
            list="account-suggestions"
            className={inputCls}
          />
          <datalist id="account-suggestions">
            {accounts.map(a => <option key={a} value={a} />)}
          </datalist>
        </div>

        {/* Notes */}
        <div>
          <label className={labelCls}>Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)}
            rows={2} placeholder="Optional notes…"
            className={`${inputCls} resize-none`} />
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <button
          onClick={handleSave}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-accent-500 hover:bg-accent-600 text-white rounded text-sm font-medium transition-colors"
        >
          <Save size={13} /> {transaction ? 'Save' : 'Add'}
        </button>
        {transaction && (
          <button
            onClick={handleDelete}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-sm transition-colors ${confirmDelete ? 'bg-red-500 text-white' : 'border border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-red-400 hover:text-red-500'}`}
          >
            <Trash2 size={13} /> {confirmDelete ? 'Confirm' : ''}
          </button>
        )}
      </div>
    </div>
  )
}
