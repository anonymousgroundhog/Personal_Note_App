import React, { useMemo } from 'react'
import { BookOpen, FlaskConical, Users, TrendingUp, Award, Calendar } from 'lucide-react'
import { useAcademiaStore } from './academiaStore'
import type { AcademicCategory, CategorySummary, YearSummary } from './types'
import { CATEGORY_META } from './types'

const CAT_ICONS: Record<AcademicCategory, React.ReactNode> = {
  teaching: <BookOpen size={18} />,
  research: <FlaskConical size={18} />,
  service:  <Users size={18} />,
}

function StatRing({ value, total, color }: { value: number; total: number; color: string }) {
  if (total === 0) return <div className="w-12 h-12 rounded-full border-4 border-gray-200 dark:border-gray-700" />
  const pct = Math.round((value / total) * 100)
  const r = 18
  const circ = 2 * Math.PI * r
  const dash = (pct / 100) * circ
  return (
    <div className="relative w-12 h-12 flex items-center justify-center">
      <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="currentColor" strokeWidth="4"
          className="text-gray-200 dark:text-gray-700" />
        <circle cx="24" cy="24" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
      </svg>
      <span className="absolute text-[10px] font-bold text-gray-700 dark:text-gray-200">{pct}%</span>
    </div>
  )
}

function CategoryCard({ summary, onDrill }: { summary: CategorySummary; onDrill: () => void }) {
  const meta = CATEGORY_META[summary.category]
  const hex = summary.category === 'teaching' ? '#3b82f6' : summary.category === 'research' ? '#8b5cf6' : '#10b981'
  return (
    <button onClick={onDrill} className={`text-left rounded-xl border p-4 transition-all hover:shadow-md flex-1 min-w-40 ${meta.bg} ${meta.border}`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`flex items-center gap-2 ${meta.color}`}>
          {CAT_ICONS[summary.category]}
          <span className="text-xs font-semibold uppercase tracking-wide">{meta.label}</span>
        </div>
        <StatRing value={summary.completed} total={summary.total} color={hex} />
      </div>
      <p className={`text-2xl font-bold ${meta.color} mb-2`}>{summary.total}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">Completed</span>
          <span className="font-medium text-emerald-600 dark:text-emerald-400">{summary.completed}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">In Progress</span>
          <span className="font-medium text-amber-600 dark:text-amber-400">{summary.inProgress}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500 dark:text-gray-400">Planned</span>
          <span className="font-medium text-gray-500 dark:text-gray-400">{summary.planned}</span>
        </div>
      </div>
    </button>
  )
}

function YearCard({ summary, onDrill }: { summary: YearSummary; onDrill: (cat?: AcademicCategory) => void }) {
  const completionPct = summary.total > 0
    ? Math.round(((summary.teaching.completed + summary.research.completed + summary.service.completed) / summary.total) * 100)
    : 0

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-800 overflow-hidden">
      {/* Year header */}
      <div className="flex items-center gap-3 px-5 py-3.5 bg-gray-50 dark:bg-surface-700 border-b border-gray-200 dark:border-gray-700">
        <Calendar size={16} className="text-accent-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{summary.year.label}</span>
          <span className="text-xs text-gray-400 ml-2">{summary.year.startDate} – {summary.year.endDate}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-accent-500 rounded-full transition-all" style={{ width: `${completionPct}%` }} />
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums w-9 text-right">{completionPct}%</span>
          <span className="text-xs text-gray-400">done</span>
        </div>
        <span className="ml-2 px-2 py-0.5 rounded-full bg-accent-100 dark:bg-accent-900/30 text-accent-600 dark:text-accent-400 text-xs font-semibold">
          {summary.total} total
        </span>
      </div>

      {/* Category cards */}
      <div className="p-4 flex gap-3 flex-wrap">
        {(['teaching', 'research', 'service'] as AcademicCategory[]).map(cat => (
          <CategoryCard key={cat} summary={summary[cat]} onDrill={() => onDrill(cat)} />
        ))}
      </div>
    </div>
  )
}

interface Props {
  onNavigate: (yearId: string, category?: AcademicCategory) => void
}

export default function AcademiaDashboard({ onNavigate }: Props) {
  const { getAllSummaries, activities, years } = useAcademiaStore()
  const summaries = getAllSummaries()

  // All-time totals
  const totals = useMemo(() => {
    const cats: AcademicCategory[] = ['teaching', 'research', 'service']
    return cats.map(cat => ({
      category: cat,
      total: activities.filter(a => a.category === cat).length,
      completed: activities.filter(a => a.category === cat && a.status === 'completed').length,
    }))
  }, [activities])

  if (years.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400 p-8">
        <BookOpen size={48} className="opacity-20" />
        <p className="text-base font-medium text-gray-500 dark:text-gray-400">No academic years yet</p>
        <p className="text-sm text-center max-w-xs">Go to <strong>Manage Years</strong> to create your first academic year, then start adding activities.</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">
      {/* All-time summary strip */}
      <div className="grid grid-cols-3 gap-4">
        {totals.map(t => {
          const meta = CATEGORY_META[t.category]
          return (
            <div key={t.category} className={`rounded-xl border p-4 ${meta.bg} ${meta.border} flex items-center gap-4`}>
              <div className={`p-2.5 rounded-lg ${meta.bg} border ${meta.border} ${meta.color}`}>
                {CAT_ICONS[t.category]}
              </div>
              <div>
                <p className={`text-2xl font-bold ${meta.color}`}>{t.total}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{meta.label} activities</p>
                {t.total > 0 && (
                  <p className="text-[10px] text-gray-400">{t.completed} completed</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Per-year breakdowns */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} className="text-accent-500" />
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">By Academic Year</h2>
        </div>
        <div className="space-y-4">
          {summaries.map(s => (
            <YearCard key={s.year.id} summary={s} onDrill={(cat) => onNavigate(s.year.id, cat)} />
          ))}
        </div>
      </div>

      {/* Recent completions */}
      {activities.filter(a => a.status === 'completed').length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Award size={16} className="text-emerald-500" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Recent Completions</h2>
          </div>
          <div className="space-y-2">
            {activities
              .filter(a => a.status === 'completed')
              .sort((a, b) => b.updatedAt - a.updatedAt)
              .slice(0, 5)
              .map(a => {
                const meta = CATEGORY_META[a.category]
                const year = years.find(y => y.id === a.yearId)
                return (
                  <button key={a.id} onClick={() => onNavigate(a.yearId, a.category)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-800 hover:border-accent-400 dark:hover:border-accent-600 hover:bg-accent-50 dark:hover:bg-accent-900/10 transition-colors text-left">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${meta.bg} ${meta.color} border ${meta.border} flex-shrink-0`}>
                      {meta.label}
                    </span>
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 truncate">{a.title}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{year?.label ?? ''}</span>
                  </button>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
