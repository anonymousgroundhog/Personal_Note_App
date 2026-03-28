import React, { useState } from 'react'
import { Plus, Trash2, Edit2, Check, X, AlertTriangle, Copy } from 'lucide-react'
import { useAcademiaStore } from './academiaStore'

const inputCls = 'text-sm border border-gray-300 dark:border-gray-600 rounded px-2.5 py-1.5 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-accent-500'

interface YearFormState {
  label: string
  startDate: string
  endDate: string
}

function emptyForm(): YearFormState {
  const now = new Date()
  const yr = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1
  return {
    label: `${yr}-${yr + 1}`,
    startDate: `${yr}-08-01`,
    endDate: `${yr + 1}-05-31`,
  }
}

export default function YearManager() {
  const { years, activities, addYear, updateYear, deleteYear } = useAcademiaStore()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<YearFormState>(emptyForm())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<YearFormState>(emptyForm())
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [formError, setFormError] = useState('')

  const actCountFor = (id: string) => activities.filter(a => a.yearId === id).length

  const duplicateYear = (id: string) => {
    const year = years.find(y => y.id === id)
    if (!year) return
    const label = `${year.label} (copy)`
    addYear(label, year.startDate, year.endDate)
  }

  const handleAdd = () => {
    if (!form.label.trim()) { setFormError('Label is required.'); return }
    if (!form.startDate || !form.endDate) { setFormError('Start and end dates are required.'); return }
    if (years.some(y => y.label === form.label.trim())) { setFormError('An academic year with that label already exists.'); return }
    addYear(form.label.trim(), form.startDate, form.endDate)
    setForm(emptyForm())
    setShowForm(false)
    setFormError('')
  }

  const startEdit = (id: string) => {
    const y = years.find(y => y.id === id)!
    setEditingId(id)
    setEditForm({ label: y.label, startDate: y.startDate, endDate: y.endDate })
  }

  const saveEdit = () => {
    if (!editingId) return
    if (!editForm.label.trim()) return
    updateYear(editingId, { label: editForm.label.trim(), startDate: editForm.startDate, endDate: editForm.endDate })
    setEditingId(null)
  }

  const handleDelete = (id: string) => {
    deleteYear(id)
    setDeleteConfirm(null)
  }

  const sorted = years.slice().sort((a, b) => b.label.localeCompare(a.label))

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Academic Years</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Define the academic years you want to track activities for.</p>
        </div>
        <button
          onClick={() => { setShowForm(s => !s); setFormError('') }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-500 text-white rounded hover:bg-accent-600 text-sm"
        >
          <Plus size={14} /> Add Year
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="mb-5 p-4 rounded-xl border border-accent-200 dark:border-accent-800 bg-accent-50 dark:bg-accent-900/10 space-y-3">
          <p className="text-xs font-semibold text-accent-600 dark:text-accent-400 uppercase tracking-wide">New Academic Year</p>
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-32">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Label (e.g. 2024-2025)</label>
              <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="2024-2025" className={inputCls} />
            </div>
            <div className="flex-1 min-w-32">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Start Date</label>
              <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className={inputCls} />
            </div>
            <div className="flex-1 min-w-32">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">End Date</label>
              <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className={inputCls} />
            </div>
          </div>
          {formError && <p className="text-xs text-red-500">{formError}</p>}
          <div className="flex gap-2">
            <button onClick={handleAdd}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-500 text-white rounded hover:bg-accent-600 text-sm">
              <Check size={13} /> Create Year
            </button>
            <button onClick={() => { setShowForm(false); setFormError('') }}
              className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-surface-700">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Year list */}
      {sorted.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-sm">No academic years yet.</p>
          <p className="text-xs mt-1">Click "Add Year" to create your first.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map(year => {
            const count = actCountFor(year.id)
            const isEditing = editingId === year.id
            const isDeleting = deleteConfirm === year.id
            return (
              <div key={year.id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-800 p-4">
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="flex gap-3 flex-wrap">
                      <div className="flex-1 min-w-28">
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Label</label>
                        <input value={editForm.label} onChange={e => setEditForm(f => ({ ...f, label: e.target.value }))}
                          className={inputCls} />
                      </div>
                      <div className="flex-1 min-w-28">
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Start Date</label>
                        <input type="date" value={editForm.startDate} onChange={e => setEditForm(f => ({ ...f, startDate: e.target.value }))}
                          className={inputCls} />
                      </div>
                      <div className="flex-1 min-w-28">
                        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">End Date</label>
                        <input type="date" value={editForm.endDate} onChange={e => setEditForm(f => ({ ...f, endDate: e.target.value }))}
                          className={inputCls} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={saveEdit}
                        className="flex items-center gap-1 px-3 py-1.5 bg-accent-500 text-white rounded hover:bg-accent-600 text-sm">
                        <Check size={13} /> Save
                      </button>
                      <button onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-surface-700">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : isDeleting ? (
                  <div className="flex items-center gap-3">
                    <AlertTriangle size={16} className="text-red-500 flex-shrink-0" />
                    <p className="text-sm text-gray-700 dark:text-gray-200 flex-1">
                      Delete <strong>{year.label}</strong>? This will also remove <strong>{count}</strong> activit{count === 1 ? 'y' : 'ies'}.
                    </p>
                    <button onClick={() => handleDelete(year.id)}
                      className="px-3 py-1.5 text-sm bg-red-500 text-white rounded hover:bg-red-600">
                      Delete
                    </button>
                    <button onClick={() => setDeleteConfirm(null)}
                      className="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-surface-700">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">{year.label}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{year.startDate} → {year.endDate} · {count} activit{count === 1 ? 'y' : 'ies'}</p>
                    </div>
                    <button onClick={() => startEdit(year.id)}
                      title="Edit"
                      className="p-1.5 rounded text-gray-400 hover:text-accent-500 hover:bg-gray-100 dark:hover:bg-surface-700">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => duplicateYear(year.id)}
                      title="Duplicate"
                      className="p-1.5 rounded text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-surface-700">
                      <Copy size={14} />
                    </button>
                    <button onClick={() => setDeleteConfirm(year.id)}
                      title="Delete"
                      className="p-1.5 rounded text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-surface-700">
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
