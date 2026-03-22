import React, { useMemo, useState } from 'react'
import { CheckSquare, ChevronDown, ChevronRight, ExternalLink, Circle, Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { useVaultStore } from '../../stores/vaultStore'
import { useUiStore } from '../../stores/uiStore'
import { parseGanttTasks } from '../gantt/ganttParser'

type GroupBy = 'project' | 'status' | 'priority' | 'assignee'
type SortBy = 'name' | 'start' | 'end' | 'progress'

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  'done':        { label: 'Done',        color: '#10b981', icon: <CheckCircle size={13} /> },
  'in-progress': { label: 'In Progress', color: '#3b82f6', icon: <Clock size={13} /> },
  'review':      { label: 'In Review',   color: '#8b5cf6', icon: <AlertCircle size={13} /> },
  'blocked':     { label: 'Blocked',     color: '#ef4444', icon: <XCircle size={13} /> },
  'not-started': { label: 'Not Started', color: '#6b7280', icon: <Circle size={13} /> },
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  'high':   { label: 'High',   color: '#ef4444' },
  'medium': { label: 'Medium', color: '#f59e0b' },
  'low':    { label: 'Low',    color: '#10b981' },
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG['not-started']
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium"
      style={{ background: cfg.color + '22', color: cfg.color }}>
      {cfg.icon}
      {cfg.label}
    </span>
  )
}

function PriorityDot({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG['medium']
  return (
    <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} title={cfg.label} />
  )
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 min-w-8">
        <div className="h-1.5 rounded-full bg-accent-500 transition-all" style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-gray-400 tabular-nums w-7 text-right">{value}%</span>
    </div>
  )
}

export default function TasksView() {
  const { index } = useVaultStore()
  const { setActiveNote, setActiveView } = useUiStore()
  const [groupBy, setGroupBy] = useState<GroupBy>('project')
  const [sortBy, setSortBy] = useState<SortBy>('start')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  const projects = useMemo(() => parseGanttTasks(index), [index])

  // Flat list of all tasks with project info
  const allTasks = useMemo(() => {
    return projects.flatMap(p =>
      p.tasks.map(t => {
        const note = index.get(t.notePath || '')
        const fm = note?.frontmatter || {}
        return {
          ...t,
          projectName: p.name,
          status: String(fm.status || 'not-started'),
          priority: String(fm.priority || 'medium'),
          assignee: String(fm.assignee || ''),
        }
      })
    )
  }, [projects, index])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return q
      ? allTasks.filter(t =>
          t.name.toLowerCase().includes(q) ||
          t.projectName.toLowerCase().includes(q) ||
          t.assignee.toLowerCase().includes(q)
        )
      : allTasks
  }, [allTasks, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'start') return a.start.localeCompare(b.start)
      if (sortBy === 'end') return a.end.localeCompare(b.end)
      if (sortBy === 'progress') return b.progress - a.progress
      return 0
    })
  }, [filtered, sortBy])

  // Group tasks
  const groups = useMemo(() => {
    const map = new Map<string, typeof sorted>()
    sorted.forEach(t => {
      let key = ''
      if (groupBy === 'project') key = t.projectName
      else if (groupBy === 'status') key = t.status
      else if (groupBy === 'priority') key = t.priority
      else if (groupBy === 'assignee') key = t.assignee || 'Unassigned'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    })
    // Sort group keys
    const keys = Array.from(map.keys())
    if (groupBy === 'status') {
      const order = ['in-progress', 'blocked', 'review', 'not-started', 'done']
      keys.sort((a, b) => order.indexOf(a) - order.indexOf(b))
    } else if (groupBy === 'priority') {
      keys.sort((a, b) => ['high', 'medium', 'low'].indexOf(a) - ['high', 'medium', 'low'].indexOf(b))
    } else {
      keys.sort()
    }
    return keys.map(k => ({ key: k, tasks: map.get(k)! }))
  }, [sorted, groupBy])

  const toggleCollapse = (key: string) => {
    setCollapsed(s => {
      const next = new Set(s)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const groupLabel = (key: string) => {
    if (groupBy === 'status') return STATUS_CONFIG[key]?.label || key
    if (groupBy === 'priority') return PRIORITY_CONFIG[key]?.label || key
    return key
  }

  const groupColor = (key: string) => {
    if (groupBy === 'status') return STATUS_CONFIG[key]?.color
    if (groupBy === 'priority') return PRIORITY_CONFIG[key]?.color
    return undefined
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-surface-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <CheckSquare size={20} className="text-accent-500" />
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Tasks</h1>
        <span className="text-xs text-gray-400">{filtered.length} task{filtered.length !== 1 ? 's' : ''}</span>
        <div className="ml-auto flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tasks…"
            className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-accent-500 w-40"
          />
          <select
            value={groupBy}
            onChange={e => setGroupBy(e.target.value as GroupBy)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300"
          >
            <option value="project">Group: Project</option>
            <option value="status">Group: Status</option>
            <option value="priority">Group: Priority</option>
            <option value="assignee">Group: Assignee</option>
          </select>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortBy)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300"
          >
            <option value="start">Sort: Start</option>
            <option value="end">Sort: End</option>
            <option value="name">Sort: Name</option>
            <option value="progress">Sort: Progress</option>
          </select>
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto">
        {allTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-400">
            <CheckSquare size={36} className="opacity-30" />
            <p className="text-sm">No tasks found.</p>
            <p className="text-xs text-gray-400">Create notes with <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">type: gantt-task</code> in frontmatter.</p>
          </div>
        ) : (
          groups.map(({ key, tasks }) => {
            const isOpen = !collapsed.has(key)
            const color = groupColor(key)
            const doneCount = tasks.filter(t => t.status === 'done').length
            return (
              <div key={key} className="border-b border-gray-100 dark:border-gray-800">
                {/* Group header */}
                <button
                  onClick={() => toggleCollapse(key)}
                  className="w-full flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-surface-800 hover:bg-gray-100 dark:hover:bg-surface-700 text-left"
                >
                  {isOpen ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                  {color && <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />}
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{groupLabel(key)}</span>
                  <span className="text-xs text-gray-400 ml-1">{tasks.length} task{tasks.length !== 1 ? 's' : ''}</span>
                  {doneCount > 0 && (
                    <span className="text-xs text-emerald-500 ml-auto">{doneCount}/{tasks.length} done</span>
                  )}
                </button>

                {/* Tasks in group */}
                {isOpen && (
                  <div>
                    {tasks.map(task => {
                      const isOverdue = task.end < today && task.status !== 'done'
                      return (
                        <div
                          key={task.id}
                          className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-surface-800/50 group"
                        >
                          {/* Priority dot */}
                          <PriorityDot priority={task.priority} />

                          {/* Task name */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium truncate ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200'}`}>
                                {task.name}
                              </span>
                              {isOverdue && (
                                <span className="text-xs text-red-500 font-medium flex-shrink-0">overdue</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                              {groupBy !== 'project' && (
                                <span className="truncate">{task.projectName}</span>
                              )}
                              <span>{task.start} → {task.end}</span>
                              {task.assignee && <span>· {task.assignee}</span>}
                            </div>
                          </div>

                          {/* Progress */}
                          <div className="w-24 flex-shrink-0">
                            <ProgressBar value={task.progress} />
                          </div>

                          {/* Status */}
                          <div className="flex-shrink-0">
                            <StatusBadge status={task.status} />
                          </div>

                          {/* Open note */}
                          {task.notePath && (
                            <button
                              onClick={() => { setActiveNote(task.notePath!); setActiveView('notes') }}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0"
                              title="Open note"
                            >
                              <ExternalLink size={13} />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
