import React, { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'
import { useAcademiaStore } from './academiaStore'
import type { AcademicActivity, AcademicCategory, ActivityStatus, ActivityType } from './types'
import { TEACHING_TYPES, RESEARCH_TYPES, SERVICE_TYPES, CATEGORY_META } from './types'

interface Props {
  activity?: AcademicActivity | null
  defaultYearId?: string
  defaultCategory?: AcademicCategory
  onClose: () => void
}

const inputCls = 'w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2.5 py-1.5 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-accent-500'
const labelCls = 'block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1'

function typeOptionsFor(cat: AcademicCategory) {
  if (cat === 'teaching') return TEACHING_TYPES
  if (cat === 'research') return RESEARCH_TYPES
  return SERVICE_TYPES
}

export default function ActivityForm({ activity, defaultYearId, defaultCategory, onClose }: Props) {
  const { years, addActivity, updateActivity } = useAcademiaStore()
  const today = new Date().toLocaleDateString('en-CA')

  const [yearId, setYearId] = useState(activity?.yearId ?? defaultYearId ?? years[0]?.id ?? '')
  const [category, setCategory] = useState<AcademicCategory>(activity?.category ?? defaultCategory ?? 'teaching')
  const [type, setType] = useState<ActivityType | ''>(activity?.type ?? '')
  const [title, setTitle] = useState(activity?.title ?? '')
  const [description, setDescription] = useState(activity?.description ?? '')
  const [date, setDate] = useState(activity?.date ?? today)
  const [status, setStatus] = useState<ActivityStatus>(activity?.status ?? 'planned')
  const [tags, setTags] = useState(activity?.tags?.join(', ') ?? '')
  const [error, setError] = useState('')

  // Reset type when category changes
  useEffect(() => {
    if (!activity) setType('')
  }, [category, activity])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) { setError('Title is required.'); return }
    if (!yearId) { setError('Please select an academic year.'); return }

    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean)
    const fields = {
      yearId,
      category,
      type: (type as ActivityType) || null,
      title: title.trim(),
      description: description.trim(),
      date,
      status,
      tags: tagList,
    }

    if (activity) {
      updateActivity(activity.id, fields)
    } else {
      addActivity(fields)
    }
    onClose()
  }

  const cats: AcademicCategory[] = ['teaching', 'research', 'service']

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-surface-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">
            {activity ? 'Edit Activity' : 'Add Activity'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-surface-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Academic Year */}
          <div>
            <label className={labelCls}>Academic Year *</label>
            {years.length === 0 ? (
              <p className="text-xs text-amber-600 dark:text-amber-400">No academic years created yet. Go to "Manage Years" first.</p>
            ) : (
              <select value={yearId} onChange={e => setYearId(e.target.value)} className={inputCls}>
                <option value="">Select year…</option>
                {years.slice().sort((a, b) => b.label.localeCompare(a.label)).map(y => (
                  <option key={y.id} value={y.id}>{y.label}</option>
                ))}
              </select>
            )}
          </div>

          {/* Category */}
          <div>
            <label className={labelCls}>Category *</label>
            <div className="flex gap-2">
              {cats.map(cat => {
                const meta = CATEGORY_META[cat]
                const active = category === cat
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`flex-1 py-1.5 rounded text-xs font-medium border transition-colors ${
                      active
                        ? `${meta.bg} ${meta.color} ${meta.border}`
                        : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    {meta.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Type */}
          <div>
            <label className={labelCls}>Type <span className="text-gray-400">(optional)</span></label>
            <select value={type} onChange={e => setType(e.target.value as ActivityType | '')} className={inputCls}>
              <option value="">— Select type —</option>
              {typeOptionsFor(category).map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className={labelCls}>Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. CS 101 – Introduction to Computing" className={inputCls} />
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description <span className="text-gray-400">(optional)</span></label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Notes, context, details…"
              rows={3}
              className={`${inputCls} resize-none`} />
          </div>

          {/* Date + Status row */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelCls}>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
            </div>
            <div className="flex-1">
              <label className={labelCls}>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value as ActivityStatus)} className={inputCls}>
                <option value="planned">Planned</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className={labelCls}>Tags <span className="text-gray-400">(comma-separated, optional)</span></label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. undergraduate, spring, invited" className={inputCls} />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="px-4 py-1.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-surface-700">
            Cancel
          </button>
          <button onClick={handleSubmit}
            className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-accent-500 text-white rounded hover:bg-accent-600">
            <Save size={13} />
            {activity ? 'Save Changes' : 'Add Activity'}
          </button>
        </div>
      </div>
    </div>
  )
}
