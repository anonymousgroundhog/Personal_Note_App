import React, { useState, useMemo, useCallback } from 'react'
import { Plus, BarChart2, List, Layers, X, Save, ExternalLink } from 'lucide-react'
import GanttChart from './GanttChart'
import { useVaultStore } from '../../stores/vaultStore'
import { useUiStore } from '../../stores/uiStore'
import { parseGanttTasks } from './ganttParser'
import type { GanttTask } from '../../types/gantt'
import { parseFrontmatter } from '../../lib/markdown/processor'
import { todayIso } from '../../lib/fs/pathUtils'

type ViewMode = 'Day' | 'Week' | 'Month' | 'Quarter Year'
type GanttTab = 'single' | 'all'

interface EditState {
  task: GanttTask
  title: string
  start: string
  end: string
  progress: number
  status: string
  priority: string
  assignee: string
  depends_on: string[]
}

export default function GanttView() {
  const { index, createNote, saveNote, readNote } = useVaultStore()
  const { setActiveNote, setActiveView } = useUiStore()
  const [tab, setTab] = useState<GanttTab>('all')
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [viewMode, setViewMode] = useState<ViewMode>('Week')
  const [showNewTaskForm, setShowNewTaskForm] = useState(false)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [newTask, setNewTask] = useState({
    title: '', project: '', start: todayIso(),
    end: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), progress: 0,
  })

  const projects = useMemo(() => parseGanttTasks(index), [index])

  // Assign a distinct color to each project
  const PROJECT_PALETTE = [
    '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b',
    '#ef4444', '#ec4899', '#06b6d4', '#84cc16',
    '#f97316', '#a855f7', '#14b8a6', '#eab308',
  ]
  const projectColors = useMemo(() => {
    const map = new Map<string, string>()
    projects.forEach((p, i) => {
      map.set(p.name, PROJECT_PALETTE[i % PROJECT_PALETTE.length])
    })
    return map
  }, [projects])

  const allTasks = useMemo<GanttTask[]>(() => {
    if (projects.length === 0) return []
    return projects.flatMap(p => p.tasks.map(t => ({
      ...t,
      name: `[${p.name}] ${t.name}`,
    })))
  }, [projects])

  const projectTasks = useMemo(() => {
    if (!selectedProject) return projects[0]?.tasks || []
    return projects.find(p => p.id === selectedProject)?.tasks || []
  }, [projects, selectedProject])

  const handleCreateTask = async () => {
    if (!newTask.title || !newTask.project) return
    const taskId = `task-${Date.now()}`
    const filename = `${newTask.project.replace(/\s+/g, '-')}-${taskId}.md`
    const content = `---
tags:
  - gantt-task
type: gantt-task
project: ${newTask.project}
task_id: "${taskId}"
title: "${newTask.title}"
start: "${newTask.start}"
end: "${newTask.end}"
progress: ${newTask.progress}
status: not-started
---

# ${newTask.title}

Task for project: ${newTask.project}
`
    await createNote(filename, content)
    setActiveNote(filename)
    setActiveView('notes')
    setShowNewTaskForm(false)
    setNewTask({
      title: '', project: '', start: todayIso(),
      end: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), progress: 0,
    })
  }

  const handleEditTask = (task: GanttTask) => {
    const note = index.get(task.notePath || '')
    const fm = note?.frontmatter || {}
    const depsRaw = fm.depends_on
    const deps: string[] = Array.isArray(depsRaw)
      ? depsRaw.map(String)
      : depsRaw ? String(depsRaw).split(',').map(s => s.trim()).filter(Boolean) : []
    setEditState({
      task,
      title: String(fm.title || task.name),
      start: task.start,
      end: task.end,
      progress: task.progress ?? 0,
      status: String(fm.status || 'not-started'),
      priority: String(fm.priority || 'medium'),
      assignee: String(fm.assignee || ''),
      depends_on: deps,
    })
  }

  const handleDragTask = useCallback(async (task: GanttTask, newStart: string, newEnd: string) => {
    if (!task.notePath) return
    try {
      const raw = await readNote(task.notePath)
      const { frontmatter, body } = parseFrontmatter(raw)
      const updated = { ...frontmatter, start: newStart, end: newEnd }
      const yamlLines = Object.entries(updated).map(([k, v]) => {
        if (Array.isArray(v)) return `${k}:\n${v.map(i => `  - ${i}`).join('\n')}`
        if (typeof v === 'string' && (v.includes(':') || v.includes('"')))
          return `${k}: "${v.replace(/"/g, '\\"')}"`
        return `${k}: ${v}`
      })
      await saveNote(task.notePath, `---\n${yamlLines.join('\n')}\n---\n\n${body}`)
    } catch { /* ignore */ }
  }, [readNote, saveNote])

  const handleSaveEdit = async () => {
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

      // Rebuild frontmatter YAML
      const yamlLines = Object.entries(updated).map(([k, v]) => {
        if (Array.isArray(v)) return `${k}:\n${v.map(i => `  - ${i}`).join('\n')}`
        if (typeof v === 'string' && (v.includes(':') || v.includes('"')))
          return `${k}: "${v.replace(/"/g, '\\"')}"`
        return `${k}: ${v}`
      })

      const newContent = `---\n${yamlLines.join('\n')}\n---\n\n${body}`
      await saveNote(editState.task.notePath, newContent)
      setEditState(null)
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500'
  const labelCls = 'text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1'

  return (
    <div className="flex-1 flex overflow-hidden bg-white dark:bg-surface-900">
      {/* Main panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <BarChart2 size={20} className="text-accent-500" />
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Gantt Charts</h1>
          <div className="ml-auto flex items-center gap-2">
            <select
              value={viewMode}
              onChange={e => setViewMode(e.target.value as ViewMode)}
              className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300"
            >
              <option>Day</option>
              <option>Week</option>
              <option>Month</option>
              <option>Quarter Year</option>
            </select>
            <button
              onClick={() => setShowNewTaskForm(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-500 text-white rounded hover:bg-accent-600 text-sm"
            >
              <Plus size={14} />
              New Task
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center px-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          {([['all', <Layers size={14} />, 'All Projects'], ['single', <List size={14} />, 'Project View']] as const).map(([t, icon, label]) => (
            <button key={t} onClick={() => setTab(t as GanttTab)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors ${tab === t ? 'border-accent-500 text-accent-500' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              {icon}{label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {/* New task form */}
          {showNewTaskForm && (
            <div className="mb-4 p-4 bg-gray-50 dark:bg-surface-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">New Gantt Task</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Task title *</label>
                  <input placeholder="e.g. Write documentation" value={newTask.title}
                    onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Project name *</label>
                  <input placeholder="e.g. MADScanner AI" value={newTask.project}
                    onChange={e => setNewTask(p => ({ ...p, project: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Start date</label>
                  <input type="date" value={newTask.start}
                    onChange={e => setNewTask(p => ({ ...p, start: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>End date</label>
                  <input type="date" value={newTask.end}
                    onChange={e => setNewTask(p => ({ ...p, end: e.target.value }))} className={inputCls} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Progress: {newTask.progress}%</label>
                  <input type="range" min={0} max={100} value={newTask.progress}
                    onChange={e => setNewTask(p => ({ ...p, progress: Number(e.target.value) }))}
                    className="w-full accent-accent-500" />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={handleCreateTask}
                  className="px-3 py-1.5 bg-accent-500 text-white rounded text-sm hover:bg-accent-600">
                  Create Task
                </button>
                <button onClick={() => setShowNewTaskForm(false)}
                  className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm hover:bg-gray-300 dark:hover:bg-gray-600">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Project color legend */}
          {projects.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-4">
              {projects.map(p => (
                <div key={p.id} className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: projectColors.get(p.name) }}
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-400">{p.name}</span>
                </div>
              ))}
            </div>
          )}

          {tab === 'all' ? (
            <div>
              <p className="text-xs text-gray-500 mb-3">
                {allTasks.length} tasks across {projects.length} projects
                <span className="ml-2 opacity-60">— click a task bar to edit</span>
              </p>
              <GanttChart tasks={allTasks} viewMode={viewMode} onEditTask={handleEditTask} onDragTask={handleDragTask} projectColors={projectColors} />
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <label className="text-sm text-gray-600 dark:text-gray-400">Project:</label>
                <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300">
                  <option value="">All</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <span className="text-xs text-gray-500">{projectTasks.length} tasks</span>
                <span className="text-xs text-gray-400 opacity-60">— click a task bar to edit</span>
              </div>
              <GanttChart tasks={projectTasks} viewMode={viewMode} onEditTask={handleEditTask} onDragTask={handleDragTask} projectColors={projectColors} />
            </div>
          )}
        </div>
      </div>

      {/* ── Task Editor Panel ── */}
      {editState && (
        <div className="w-80 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-surface-800">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Edit Task</span>
            <button onClick={() => setEditState(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 rounded">
              <X size={16} />
            </button>
          </div>

          {/* Fields */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <label className={labelCls}>Title</label>
              <input value={editState.title}
                onChange={e => setEditState(s => s ? { ...s, title: e.target.value } : s)}
                className={inputCls} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Start date</label>
                <input type="date" value={editState.start}
                  onChange={e => setEditState(s => s ? { ...s, start: e.target.value } : s)}
                  className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>End date</label>
                <input type="date" value={editState.end}
                  onChange={e => setEditState(s => s ? { ...s, end: e.target.value } : s)}
                  className={inputCls} />
              </div>
            </div>

            {/* Duration display */}
            {editState.start && editState.end && (
              <p className="text-xs text-accent-500 font-medium">
                Duration: {Math.max(0, Math.round((new Date(editState.end).getTime() - new Date(editState.start).getTime()) / 86400000))} days
              </p>
            )}

            <div>
              <label className={labelCls}>Progress: {editState.progress}%</label>
              <input type="range" min={0} max={100} value={editState.progress}
                onChange={e => setEditState(s => s ? { ...s, progress: Number(e.target.value) } : s)}
                className="w-full accent-accent-500" />
              <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                <span>0%</span><span>50%</span><span>100%</span>
              </div>
            </div>

            <div>
              <label className={labelCls}>Status</label>
              <select value={editState.status}
                onChange={e => setEditState(s => s ? { ...s, status: e.target.value } : s)}
                className={inputCls}>
                <option value="not-started">Not started</option>
                <option value="in-progress">In progress</option>
                <option value="blocked">Blocked</option>
                <option value="review">In review</option>
                <option value="done">Done</option>
              </select>
            </div>

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

            <div>
              <label className={labelCls}>Assignee</label>
              <input value={editState.assignee} placeholder="e.g. Sean"
                onChange={e => setEditState(s => s ? { ...s, assignee: e.target.value } : s)}
                className={inputCls} />
            </div>

            {/* Dependencies */}
            <div>
              <label className={labelCls}>Blocked by (depends on)</label>
              <p className="text-xs text-gray-400 mb-2">
                This task cannot start until the selected tasks are complete.
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {allTasks
                  .filter(t => t.id !== editState.task.id)
                  .map(t => {
                    const checked = editState.depends_on.includes(t.id)
                    return (
                      <label key={t.id} className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => {
                            setEditState(s => {
                              if (!s) return s
                              const deps = e.target.checked
                                ? [...s.depends_on, t.id]
                                : s.depends_on.filter(d => d !== t.id)
                              return { ...s, depends_on: deps }
                            })
                          }}
                          className="accent-accent-500"
                        />
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

            {/* Project badge */}
            {editState.task.project && (
              <div>
                <label className={labelCls}>Project</label>
                <span className="inline-block px-2 py-0.5 bg-accent-500/10 text-accent-500 rounded text-xs font-medium">
                  {editState.task.project}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <button onClick={handleSaveEdit} disabled={saving}
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
