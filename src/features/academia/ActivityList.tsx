import React, { useState, useMemo } from 'react'
import { Edit2, Trash2, AlertTriangle, Search, Filter, Copy } from 'lucide-react'
import { useAcademiaStore } from './academiaStore'
import type { AcademicCategory, ActivityStatus, AcademicActivity } from './types'
import { CATEGORY_META, STATUS_META, TEACHING_TYPES, RESEARCH_TYPES, SERVICE_TYPES } from './types'
import ActivityForm from './ActivityForm'

const URL_RE = /https?:\/\/[^\s<>"]+/g

function linkifyText(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let last = 0
  let match: RegExpExecArray | null
  URL_RE.lastIndex = 0
  while ((match = URL_RE.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index))
    const url = match[0]
    parts.push(
      <a key={match.index} href={url} target="_blank" rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        className="text-accent-500 hover:text-accent-600 underline break-all">
        {url}
      </a>
    )
    last = match.index + url.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts
}

function typeLabel(cat: AcademicCategory, type: string | null): string {
  if (!type) return ''
  const all = [...TEACHING_TYPES, ...RESEARCH_TYPES, ...SERVICE_TYPES]
  return all.find(t => t.value === type)?.label ?? type
}

function CategoryBadge({ cat }: { cat: AcademicCategory }) {
  const m = CATEGORY_META[cat]
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${m.bg} ${m.color} border ${m.border}`}>
      {m.label}
    </span>
  )
}

function StatusDot({ status }: { status: ActivityStatus }) {
  const m = STATUS_META[status]
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${m.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  )
}

interface Props {
  initialYearId?: string
  initialCategory?: AcademicCategory
}

export default function ActivityList({ initialYearId, initialCategory }: Props) {
  const { years, activities, deleteActivity, addActivity } = useAcademiaStore()

  const duplicateActivity = (act: AcademicActivity) => {
    addActivity({
      yearId: act.yearId,
      category: act.category,
      type: act.type,
      title: `${act.title} (copy)`,
      description: act.description,
      date: act.date,
      status: 'planned',
      tags: act.tags,
    })
  }
  const [filterYear, setFilterYear] = useState(initialYearId ?? '')
  const [filterCat, setFilterCat] = useState<AcademicCategory | ''>(initialCategory ?? '')
  const [filterStatus, setFilterStatus] = useState<ActivityStatus | ''>('')
  const [search, setSearch] = useState('')
  const [editActivity, setEditActivity] = useState<AcademicActivity | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const sortedYears = useMemo(() => years.slice().sort((a, b) => b.label.localeCompare(a.label)), [years])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return activities.filter(a => {
      if (filterYear && a.yearId !== filterYear) return false
      if (filterCat && a.category !== filterCat) return false
      if (filterStatus && a.status !== filterStatus) return false
      if (q && !a.title.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q)) return false
      return true
    }).sort((a, b) => b.date.localeCompare(a.date))
  }, [activities, filterYear, filterCat, filterStatus, search])

  // Group by year then category
  const grouped = useMemo(() => {
    const yearMap = new Map<string, Map<AcademicCategory, AcademicActivity[]>>()
    filtered.forEach(a => {
      if (!yearMap.has(a.yearId)) yearMap.set(a.yearId, new Map())
      const catMap = yearMap.get(a.yearId)!
      if (!catMap.has(a.category)) catMap.set(a.category, [])
      catMap.get(a.category)!.push(a)
    })
    return yearMap
  }, [filtered])

  const yearOrder = sortedYears.map(y => y.id).filter(id => grouped.has(id))
  const catOrder: AcademicCategory[] = ['teaching', 'research', 'service']

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 flex-wrap flex-shrink-0 bg-gray-50 dark:bg-surface-800">
        <Filter size={13} className="text-gray-400 flex-shrink-0" />
        <div className="relative flex-1 min-w-36">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search activities…"
            className="w-full pl-6 pr-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-accent-500" />
        </div>
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
          className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300">
          <option value="">All Years</option>
          {sortedYears.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value as AcademicCategory | '')}
          className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300">
          <option value="">All Categories</option>
          <option value="teaching">Teaching</option>
          <option value="research">Research</option>
          <option value="service">Service</option>
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as ActivityStatus | '')}
          className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300">
          <option value="">All Statuses</option>
          <option value="planned">Planned</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
        <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-gray-400">
            <p className="text-sm">No activities match your filters.</p>
            <p className="text-xs">Try changing the filters or add a new activity.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {yearOrder.map(yearId => {
              const year = years.find(y => y.id === yearId)
              if (!year) return null
              const catMap = grouped.get(yearId)!
              const presentCats = catOrder.filter(c => catMap.has(c))
              return (
                <div key={yearId}>
                  <h3 className="text-sm font-bold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent-500 flex-shrink-0" />
                    {year.label}
                    <span className="text-xs font-normal text-gray-400">({year.startDate} – {year.endDate})</span>
                  </h3>
                  <div className="space-y-4 pl-4">
                    {presentCats.map(cat => {
                      const acts = catMap.get(cat)!
                      const meta = CATEGORY_META[cat]
                      return (
                        <div key={cat}>
                          <p className={`text-[11px] font-semibold uppercase tracking-widest mb-2 ${meta.color}`}>{meta.label}</p>
                          <div className="space-y-1.5">
                            {acts.map(act => {
                              const isDeleting = deleteConfirm === act.id
                              return (
                                <div key={act.id}
                                  className={`rounded-lg border p-3 transition-colors ${isDeleting ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-800 hover:border-gray-300 dark:hover:border-gray-600'}`}>
                                  {isDeleting ? (
                                    <div className="flex items-center gap-3">
                                      <AlertTriangle size={14} className="text-red-500 flex-shrink-0" />
                                      <p className="text-sm text-gray-700 dark:text-gray-200 flex-1">Delete <strong>{act.title}</strong>?</p>
                                      <button onClick={() => deleteActivity(act.id)}
                                        className="px-2.5 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600">Delete</button>
                                      <button onClick={() => setDeleteConfirm(null)}
                                        className="px-2.5 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-700">Cancel</button>
                                    </div>
                                  ) : (
                                    <div className="flex items-start gap-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                          <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{act.title}</span>
                                          {act.type && (
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-surface-700 text-gray-500 dark:text-gray-400">
                                              {typeLabel(act.category, act.type)}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                                          <StatusDot status={act.status} />
                                          <span className="text-xs text-gray-400">{act.date}</span>
                                          {act.tags.length > 0 && (
                                            <span className="text-xs text-gray-400">{act.tags.map(t => `#${t}`).join(' ')}</span>
                                          )}
                                        </div>
                                        {act.description && (
                                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{linkifyText(act.description)}</p>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        <button onClick={() => setEditActivity(act)}
                                          title="Edit"
                                          className="p-1 rounded text-gray-400 hover:text-accent-500 hover:bg-gray-100 dark:hover:bg-surface-700">
                                          <Edit2 size={13} />
                                        </button>
                                        <button onClick={() => duplicateActivity(act)}
                                          title="Duplicate"
                                          className="p-1 rounded text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-surface-700">
                                          <Copy size={13} />
                                        </button>
                                        <button onClick={() => setDeleteConfirm(act.id)}
                                          title="Delete"
                                          className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-surface-700">
                                          <Trash2 size={13} />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {editActivity && (
        <ActivityForm activity={editActivity} onClose={() => setEditActivity(null)} />
      )}
    </div>
  )
}
