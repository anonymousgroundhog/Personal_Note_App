import React, { useMemo, useState, useCallback } from 'react'
import {
  CheckSquare, ChevronDown, ChevronRight, ExternalLink, Circle, Clock,
  AlertCircle, CheckCircle, XCircle, Pencil, Plus, X, Save, GitBranch,
} from 'lucide-react'
import { useVaultStore } from '../../stores/vaultStore'
import { useUiStore } from '../../stores/uiStore'
import { useGsdStore } from '../gsd/gsdStore'
import { parseGanttTasks } from '../gantt/ganttParser'
import { parseFrontmatter } from '../../lib/markdown/processor'
import type { GanttTask } from '../../types/gantt'
import { todayIso } from '../../lib/fs/pathUtils'

type GroupBy = 'project' | 'status' | 'priority' | 'assignee'
type SortBy = 'name' | 'start' | 'end' | 'progress'

interface RichTask extends GanttTask {
  projectName: string
  status: string
  priority: string
  assignee: string
  depends_on: string[]
}

interface EditState {
  task: RichTask
  title: string
  start: string
  end: string
  progress: number
  status: string
  priority: string
  assignee: string
  depends_on: string[]
}

const STATUS_OPTIONS = ['not-started', 'in-progress', 'review', 'blocked', 'done'] as const
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
      {cfg.icon}{cfg.label}
    </span>
  )
}

function PriorityDot({ priority }: { priority: string }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG['medium']
  return <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: cfg.color }} title={cfg.label} />
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
  const { index, readNote, saveNote, createNote } = useVaultStore()
  const { setActiveNote, setActiveView } = useUiStore()
  const { items: gsdItems, projects: gsdProjects } = useGsdStore()
  const [groupBy, setGroupBy] = useState<GroupBy>('project')
  const [sortBy, setSortBy] = useState<SortBy>('start')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [expandedSubtasks, setExpandedSubtasks] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [editState, setEditState] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)

  const vaultProjects = useMemo(() => parseGanttTasks(index), [index])

  const allTasks = useMemo<RichTask[]>(() => {
    const today = todayIso()
    const ninetyDays = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)

    // Vault Gantt tasks
    const vaultTasks: RichTask[] = vaultProjects.flatMap(p =>
      p.tasks.map(t => {
        const note = index.get(t.notePath || '')
        const fm = note?.frontmatter || {}
        const depsRaw = fm.depends_on
        return {
          ...t,
          projectName: p.name,
          status: String(fm.status || 'not-started'),
          priority: String(fm.priority || 'medium'),
          assignee: String(fm.assignee || ''),
          depends_on: Array.isArray(depsRaw)
            ? depsRaw.map(String)
            : depsRaw ? String(depsRaw).split(',').map(s => s.trim()).filter(Boolean) : [],
        }
      })
    )

    // GSD items — only show those not already in a vault Gantt project
    const vaultTaskIds = new Set(vaultTasks.map(t => t.id))
    const gsdTasks: RichTask[] = gsdItems
      .filter(i => i.status !== 'done' && !vaultTaskIds.has(i.id))
      .map(i => {
        const proj = gsdProjects.find(p => p.id === i.projectId)
        const gsdStatus = i.status === 'next' ? 'in-progress' : i.status === 'waiting' ? 'blocked' : 'not-started'
        const gsdPriority = i.priority ?? 'medium'
        return {
          id: i.id,
          name: i.title,
          start: i.dueDate
            ? new Date(new Date(i.dueDate).getTime() - 7 * 86400000).toISOString().slice(0, 10)
            : today,
          end: i.dueDate ?? ninetyDays,
          progress: 0,
          project: proj?.name ?? 'GSD',
          projectName: proj?.name ?? 'GSD',
          status: gsdStatus,
          priority: gsdPriority,
          assignee: '',
          depends_on: [],
        }
      })

    return [...vaultTasks, ...gsdTasks]
  }, [vaultProjects, index, gsdItems, gsdProjects])

  // Separate top-level tasks and subtasks
  const topLevelTasks = useMemo(() => allTasks.filter(t => !t.parentTaskId), [allTasks])
  const subtasksByParent = useMemo(() => {
    const map = new Map<string, RichTask[]>()
    allTasks.filter(t => t.parentTaskId).forEach(t => {
      const list = map.get(t.parentTaskId!) ?? []
      list.push(t)
      map.set(t.parentTaskId!, list)
    })
    return map
  }, [allTasks])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return q
      ? topLevelTasks.filter(t =>
          t.name.toLowerCase().includes(q) ||
          t.projectName.toLowerCase().includes(q) ||
          t.assignee.toLowerCase().includes(q)
        )
      : topLevelTasks
  }, [topLevelTasks, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'start') return a.start.localeCompare(b.start)
      if (sortBy === 'end') return a.end.localeCompare(b.end)
      if (sortBy === 'progress') return b.progress - a.progress
      return 0
    })
  }, [filtered, sortBy])

  const groups = useMemo(() => {
    const map = new Map<string, RichTask[]>()
    sorted.forEach(t => {
      let key = ''
      if (groupBy === 'project') key = t.projectName
      else if (groupBy === 'status') key = t.status
      else if (groupBy === 'priority') key = t.priority
      else if (groupBy === 'assignee') key = t.assignee || 'Unassigned'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    })
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

  const toggleCollapse = (key: string) => setCollapsed(s => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n })
  const toggleSubtasks = (id: string) => setExpandedSubtasks(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

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

  const openEdit = (task: RichTask) => {
    setEditState({
      task,
      title: task.name,
      start: task.start,
      end: task.end,
      progress: task.progress,
      status: task.status,
      priority: task.priority,
      assignee: task.assignee,
      depends_on: task.depends_on,
    })
  }

  const handleSave = useCallback(async () => {
    if (!editState?.task.notePath) return
    setSaving(true)
    try {
      const raw = await readNote(editState.task.notePath)
      const { frontmatter, body } = parseFrontmatter(raw)
      const updated = {
        ...frontmatter,
        title: editState.title,
        start: editState.start,
        end: editState.end,
        progress: editState.progress,
        status: editState.status,
        priority: editState.priority,
        assignee: editState.assignee,
        depends_on: editState.depends_on.length > 0 ? editState.depends_on : undefined,
      }
      const yamlLines = Object.entries(updated)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => {
          if (Array.isArray(v)) return `${k}:\n${v.map(i => `  - ${i}`).join('\n')}`
          if (typeof v === 'string' && (v.includes(':') || v.includes('"')))
            return `${k}: "${v.replace(/"/g, '\\"')}"`
          return `${k}: ${v}`
        })
      await saveNote(editState.task.notePath, `---\n${yamlLines.join('\n')}\n---\n\n${body}`)
      setEditState(null)
    } finally {
      setSaving(false)
    }
  }, [editState, readNote, saveNote])

  const handleAddSubtask = useCallback(async (parent: RichTask) => {
    const name = prompt('Subtask name:')
    if (!name) return
    const taskId = `task-${Date.now()}`
    const filename = `${parent.projectName.replace(/\s+/g, '-')}-subtask-${taskId}.md`
    const content = `---
tags:
  - gantt-task
type: gantt-task
project: ${parent.projectName}
task_id: "${taskId}"
parent_task_id: "${parent.id}"
title: "${name}"
start: "${todayIso()}"
end: "${new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)}"
progress: 0
status: not-started
priority: medium
---

# ${name}

Subtask of: [[${parent.notePath?.split('/').pop()?.replace(/\.md$/, '') ?? parent.name}]]
`
    await createNote(filename, content)
    setExpandedSubtasks(s => new Set(s).add(parent.id))
  }, [createNote])

  const today = todayIso()
  const inputCls = 'w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500'
  const labelCls = 'text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1'

  // Sibling tasks for dependency selection (same project, not self)
  const siblingTasks = editState
    ? allTasks.filter(t => t.projectName === editState.task.projectName && t.id !== editState.task.id && !t.parentTaskId)
    : []

  const renderTask = (task: RichTask, isSubtask = false) => {
    const isOverdue = task.end < today && task.status !== 'done'
    const subs = subtasksByParent.get(task.id) ?? []
    const subsExpanded = expandedSubtasks.has(task.id)
    const isEditing = editState?.task.id === task.id

    return (
      <React.Fragment key={task.id}>
        <div
          className={`flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-surface-800/50 group ${isSubtask ? 'pl-10 bg-gray-50/50 dark:bg-surface-800/30' : ''} ${isEditing ? 'bg-accent-500/5 dark:bg-accent-500/10' : ''}`}
        >
          {/* Subtask toggle / indent indicator */}
          {!isSubtask ? (
            <button
              onClick={() => subs.length > 0 && toggleSubtasks(task.id)}
              className={`flex-shrink-0 w-4 h-4 flex items-center justify-center ${subs.length > 0 ? 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer' : 'cursor-default'}`}
              title={subs.length > 0 ? `${subs.length} subtask${subs.length > 1 ? 's' : ''}` : undefined}
            >
              {subs.length > 0
                ? (subsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />)
                : <span className="w-1 h-1 rounded-full bg-gray-200 dark:bg-gray-700 inline-block" />
              }
            </button>
          ) : (
            <GitBranch size={11} className="text-gray-300 dark:text-gray-600 flex-shrink-0 ml-1" />
          )}

          <PriorityDot priority={task.priority} />

          {/* Task name */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium truncate ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-200'} ${isSubtask ? 'text-xs' : ''}`}>
                {task.name}
              </span>
              {isOverdue && <span className="text-xs text-red-500 font-medium flex-shrink-0">overdue</span>}
              {subs.length > 0 && (
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {subs.filter(s => s.status === 'done').length}/{subs.length} subtasks
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
              {groupBy !== 'project' && !isSubtask && <span className="truncate">{task.projectName}</span>}
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

          {/* Action buttons */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0">
            {/* Edit */}
            <button
              onClick={() => isEditing ? setEditState(null) : openEdit(task)}
              className={`p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${isEditing ? 'text-accent-500' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
              title="Edit task"
            >
              <Pencil size={13} />
            </button>
            {/* Add subtask (only on top-level tasks) */}
            {!isSubtask && (
              <button
                onClick={() => handleAddSubtask(task)}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                title="Add subtask"
              >
                <Plus size={13} />
              </button>
            )}
            {/* Open note */}
            {task.notePath && (
              <button
                onClick={() => { setActiveNote(task.notePath!); setActiveView('notes') }}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                title="Open note"
              >
                <ExternalLink size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Subtasks */}
        {!isSubtask && subsExpanded && subs.map(sub => renderTask(sub, true))}
      </React.Fragment>
    )
  }

  return (
    <div className="flex-1 flex overflow-hidden bg-white dark:bg-surface-900">
      {/* ── Main list ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <CheckSquare size={20} className="text-accent-500" />
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Tasks</h1>
          <span className="text-xs text-gray-400">{topLevelTasks.length} task{topLevelTasks.length !== 1 ? 's' : ''}</span>
          <div className="ml-auto flex items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search tasks…"
              className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-accent-500 w-40"
            />
            <select value={groupBy} onChange={e => setGroupBy(e.target.value as GroupBy)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300">
              <option value="project">Group: Project</option>
              <option value="status">Group: Status</option>
              <option value="priority">Group: Priority</option>
              <option value="assignee">Group: Assignee</option>
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300">
              <option value="start">Sort: Start</option>
              <option value="end">Sort: End</option>
              <option value="name">Sort: Name</option>
              <option value="progress">Sort: Progress</option>
            </select>
          </div>
        </div>

        {/* Task list */}
        <div className="flex-1 overflow-y-auto">
          {topLevelTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-gray-400">
              <CheckSquare size={36} className="opacity-30" />
              <p className="text-sm">No tasks found.</p>
              <p className="text-xs">Add items to GSD projects or create notes with <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">type: gantt-task</code> in frontmatter.</p>
            </div>
          ) : (
            groups.map(({ key, tasks }) => {
              const isOpen = !collapsed.has(key)
              const color = groupColor(key)
              const doneCount = tasks.filter(t => t.status === 'done').length
              return (
                <div key={key} className="border-b border-gray-100 dark:border-gray-800">
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
                  {isOpen && tasks.map(task => renderTask(task))}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── Edit panel ── */}
      {editState && (
        <div className="w-80 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-surface-800">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Edit Task</span>
            <button onClick={() => setEditState(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 rounded">
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Title */}
            <div>
              <label className={labelCls}>Title</label>
              <input value={editState.title}
                onChange={e => setEditState(s => s ? { ...s, title: e.target.value } : s)}
                className={inputCls} />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Start</label>
                <input type="date" value={editState.start}
                  onChange={e => setEditState(s => s ? { ...s, start: e.target.value } : s)}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>End</label>
                <input type="date" value={editState.end}
                  onChange={e => setEditState(s => s ? { ...s, end: e.target.value } : s)}
                  className={inputCls} />
              </div>
            </div>

            {editState.start && editState.end && (
              <p className="text-xs text-accent-500 font-medium">
                Duration: {Math.max(0, Math.round((new Date(editState.end).getTime() - new Date(editState.start).getTime()) / 86400000))} days
              </p>
            )}

            {/* Progress */}
            <div>
              <label className={labelCls}>Progress: {editState.progress}%</label>
              <input type="range" min={0} max={100} value={editState.progress}
                onChange={e => setEditState(s => s ? { ...s, progress: Number(e.target.value) } : s)}
                className="w-full accent-accent-500" />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className={labelCls}>Status</label>
              <select value={editState.status}
                onChange={e => setEditState(s => s ? { ...s, status: e.target.value } : s)}
                className={inputCls}>
                {STATUS_OPTIONS.map(s => (
                  <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className={labelCls}>Priority</label>
              <select value={editState.priority}
                onChange={e => setEditState(s => s ? { ...s, priority: e.target.value } : s)}
                className={inputCls}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>

            {/* Assignee */}
            <div>
              <label className={labelCls}>Assignee</label>
              <input value={editState.assignee} placeholder="e.g. Sean"
                onChange={e => setEditState(s => s ? { ...s, assignee: e.target.value } : s)}
                className={inputCls} />
            </div>

            {/* Dependencies — only top-level tasks in same project */}
            {siblingTasks.length > 0 && (
              <div>
                <label className={labelCls}>Blocked by</label>
                <p className="text-xs text-gray-400 mb-2">Must complete before this task can start.</p>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {siblingTasks.map(t => {
                    const checked = editState.depends_on.includes(t.id)
                    return (
                      <label key={t.id} className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={checked}
                          onChange={e => setEditState(s => {
                            if (!s) return s
                            const deps = e.target.checked
                              ? [...s.depends_on, t.id]
                              : s.depends_on.filter(d => d !== t.id)
                            return { ...s, depends_on: deps }
                          })}
                          className="accent-accent-500" />
                        <span className={`text-xs truncate ${checked ? 'text-accent-500 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                          {t.name}
                        </span>
                      </label>
                    )
                  })}
                </div>
                {editState.depends_on.length > 0 && (
                  <p className="text-xs text-amber-500 mt-1 font-medium">
                    ⏳ Blocked by {editState.depends_on.length} task{editState.depends_on.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}

            {/* Project badge */}
            <div>
              <label className={labelCls}>Project</label>
              <span className="inline-block px-2 py-0.5 bg-accent-500/10 text-accent-500 rounded text-xs font-medium">
                {editState.task.projectName}
              </span>
            </div>

            {/* Subtasks summary */}
            {(() => {
              const subs = subtasksByParent.get(editState.task.id) ?? []
              if (subs.length === 0) return null
              return (
                <div>
                  <label className={labelCls}>Subtasks ({subs.filter(s => s.status === 'done').length}/{subs.length} done)</label>
                  <div className="space-y-1">
                    {subs.map(sub => (
                      <div key={sub.id} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: STATUS_CONFIG[sub.status]?.color ?? '#6b7280' }} />
                        <span className={`text-xs truncate flex-1 ${sub.status === 'done' ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                          {sub.name}
                        </span>
                        <button onClick={() => openEdit(sub)} className="text-gray-400 hover:text-accent-500 flex-shrink-0">
                          <Pencil size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => handleAddSubtask(editState.task)}
                    className="mt-2 flex items-center gap-1 text-xs text-accent-500 hover:text-accent-600"
                  >
                    <Plus size={11} /> Add subtask
                  </button>
                </div>
              )
            })()}
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <button onClick={handleSave} disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-accent-500 text-white rounded hover:bg-accent-600 text-sm font-medium disabled:opacity-60">
              <Save size={14} />
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            {editState.task.notePath && (
              <button
                onClick={() => { setActiveNote(editState.task.notePath!); setActiveView('notes') }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-sm">
                <ExternalLink size={14} />
                Open Note
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
