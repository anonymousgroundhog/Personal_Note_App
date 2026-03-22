import React, { useState, useMemo } from 'react'
import { Plus, BarChart2, List, Layers } from 'lucide-react'
import GanttChart from './GanttChart'
import { useVaultStore } from '../../stores/vaultStore'
import { useUiStore } from '../../stores/uiStore'
import { parseGanttTasks } from './ganttParser'
import type { GanttTask } from '../../types/gantt'
import { todayIso } from '../../lib/fs/pathUtils'

type ViewMode = 'Day' | 'Week' | 'Month' | 'Quarter Year'
type GanttTab = 'single' | 'all'

export default function GanttView() {
  const { index, createNote } = useVaultStore()
  const { setActiveNote, setActiveView } = useUiStore()
  const [tab, setTab] = useState<GanttTab>('all')
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [viewMode, setViewMode] = useState<ViewMode>('Week')
  const [showNewTaskForm, setShowNewTaskForm] = useState(false)
  const [newTask, setNewTask] = useState({
    title: '', project: '', start: todayIso(),
    end: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), progress: 0,
  })

  const projects = useMemo(() => parseGanttTasks(index), [index])

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
    setNewTask({ title: '', project: '', start: todayIso(), end: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10), progress: 0 })
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-surface-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <BarChart2 size={20} className="text-accent-500" />
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Gantt Charts</h1>
        <div className="ml-auto flex items-center gap-2">
          {/* View mode selector */}
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
            onClick={() => setShowNewTaskForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-500 text-white rounded hover:bg-accent-600 text-sm"
          >
            <Plus size={14} />
            New Task
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 px-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <button
          onClick={() => setTab('all')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors ${tab === 'all' ? 'border-accent-500 text-accent-500' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
        >
          <Layers size={14} />
          All Projects
        </button>
        <button
          onClick={() => setTab('single')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors ${tab === 'single' ? 'border-accent-500 text-accent-500' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
        >
          <List size={14} />
          Project View
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {/* New Task Form */}
        {showNewTaskForm && (
          <div className="mb-4 p-4 bg-gray-50 dark:bg-surface-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">New Gantt Task</h3>
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="Task title"
                value={newTask.title}
                onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-accent-500"
              />
              <input
                placeholder="Project name"
                value={newTask.project}
                onChange={e => setNewTask(p => ({ ...p, project: e.target.value }))}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-accent-500"
              />
              <label className="text-xs text-gray-500 flex flex-col gap-1">
                Start
                <input type="date" value={newTask.start} onChange={e => setNewTask(p => ({ ...p, start: e.target.value }))}
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-accent-500" />
              </label>
              <label className="text-xs text-gray-500 flex flex-col gap-1">
                End
                <input type="date" value={newTask.end} onChange={e => setNewTask(p => ({ ...p, end: e.target.value }))}
                  className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-accent-500" />
              </label>
              <label className="text-xs text-gray-500 flex flex-col gap-1 col-span-2">
                Progress: {newTask.progress}%
                <input type="range" min={0} max={100} value={newTask.progress} onChange={e => setNewTask(p => ({ ...p, progress: Number(e.target.value) }))}
                  className="w-full accent-accent-500" />
              </label>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={handleCreateTask} className="px-3 py-1.5 bg-accent-500 text-white rounded text-sm hover:bg-accent-600">Create</button>
              <button onClick={() => setShowNewTaskForm(false)} className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm hover:bg-gray-300 dark:hover:bg-gray-600">Cancel</button>
            </div>
          </div>
        )}

        {tab === 'all' ? (
          <div>
            <p className="text-xs text-gray-500 mb-3">{allTasks.length} tasks across {projects.length} projects</p>
            <GanttChart tasks={allTasks} viewMode={viewMode} />
          </div>
        ) : (
          <div>
            {/* Project dropdown */}
            <div className="flex items-center gap-3 mb-4">
              <label className="text-sm text-gray-600 dark:text-gray-400">Project:</label>
              <select
                value={selectedProject}
                onChange={e => setSelectedProject(e.target.value)}
                className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300"
              >
                <option value="">All</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <span className="text-xs text-gray-500">{projectTasks.length} tasks</span>
            </div>
            <GanttChart tasks={projectTasks} viewMode={viewMode} />
          </div>
        )}
      </div>
    </div>
  )
}
