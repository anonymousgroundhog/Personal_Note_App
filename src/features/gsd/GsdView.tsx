import React, { useState, useMemo, useRef, useCallback } from 'react'
import {
  Inbox, Zap, Clock, Cloud, CheckCircle2, FolderOpen,
  Plus, X, Calendar, User, AlertCircle, Edit2, Trash2,
  Flag, MoreHorizontal, Circle, CheckCircle, RefreshCw,
  BookOpen, ChevronDown, ChevronRight as ChevronRightIcon, BarChart2,
  ArrowRight, HelpCircle, Lightbulb, ListChecks, Target, CheckSquare,
  ArrowLeft, FileText,
} from 'lucide-react'
import { useGsdStore } from './gsdStore'
import type { GsdItem, GsdItemStatus, GsdPriority, GsdProject } from './gsdStore'
import { useVaultStore } from '../../stores/vaultStore'
import { parseGanttTasks } from '../gantt/ganttParser'
import GanttChart from '../gantt/GanttChart'
import TasksView from '../tasks/TasksView'
import CalendarView from '../calendar/CalendarView'
import ProjectPlanner from './ProjectPlanner'
import type { GanttTask, GanttProject as GanttProjectType } from '../../types/gantt'
import { todayIso } from '../../lib/fs/pathUtils'

// ── Constants ────────────────────────────────────────────────────────────────
const STATUS_META: Record<GsdItemStatus, { label: string; icon: React.ReactNode; color: string }> = {
  inbox:   { label: 'Inbox',        icon: <Inbox size={14} />,        color: 'text-gray-500' },
  next:    { label: 'Next Actions', icon: <Zap size={14} />,          color: 'text-blue-500' },
  waiting: { label: 'Waiting For',  icon: <Clock size={14} />,         color: 'text-amber-500' },
  someday: { label: 'Someday/Maybe',icon: <Cloud size={14} />,         color: 'text-purple-500' },
  done:    { label: 'Done',         icon: <CheckCircle2 size={14} />,  color: 'text-green-500' },
}

const PRIORITY_META: Record<GsdPriority, { label: string; color: string; dot: string }> = {
  high:   { label: 'High',   color: 'text-red-500',    dot: 'bg-red-500' },
  medium: { label: 'Medium', color: 'text-amber-500',  dot: 'bg-amber-500' },
  low:    { label: 'Low',    color: 'text-gray-400',   dot: 'bg-gray-400' },
}

// ── Quick Capture bar ────────────────────────────────────────────────────────
function QuickCapture() {
  const { addItem } = useGsdStore()
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const submit = () => {
    const title = value.trim()
    if (!title) return
    addItem({ title, status: 'inbox' })
    setValue('')
    inputRef.current?.focus()
  }

  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800">
      <Inbox size={15} className="text-gray-400 flex-shrink-0" />
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit() }}
        placeholder="Capture anything… press Enter to add to Inbox"
        className="flex-1 text-sm bg-transparent text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none"
      />
      {value && (
        <button
          onClick={submit}
          className="flex-shrink-0 px-3 py-1 bg-accent-500 text-white rounded text-xs hover:bg-accent-600"
        >
          Capture
        </button>
      )}
    </div>
  )
}

// ── Item edit drawer ─────────────────────────────────────────────────────────
interface ItemDrawerProps {
  item: GsdItem
  projects: GsdProject[]
  contexts: string[]
  onClose: () => void
}

function ItemDrawer({ item, projects, contexts, onClose }: ItemDrawerProps) {
  const { updateItem, deleteItem, processInbox } = useGsdStore()
  const [title, setTitle] = useState(item.title)
  const [notes, setNotes] = useState(item.notes)
  const [status, setStatus] = useState<GsdItemStatus>(item.status)
  const [projectId, setProjectId] = useState<string | null>(item.projectId)
  const [priority, setPriority] = useState<GsdPriority>(item.priority)
  const [dueDate, setDueDate] = useState(item.dueDate ?? '')
  const [waitingFor, setWaitingFor] = useState(item.waitingFor)
  const [ctxInput, setCtxInput] = useState('')
  const [itemContexts, setItemContexts] = useState<string[]>(item.contexts)

  const save = () => {
    updateItem(item.id, {
      title: title.trim() || item.title,
      notes, status, projectId, priority,
      dueDate: dueDate || null,
      waitingFor,
      contexts: itemContexts,
    })
    onClose()
  }

  const addCtx = (ctx: string) => {
    const c = ctx.startsWith('@') ? ctx : `@${ctx}`
    if (!itemContexts.includes(c)) setItemContexts(p => [...p, c])
    setCtxInput('')
  }

  const inputCls = 'w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500'
  const labelCls = 'text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1'

  return (
    <div className="w-80 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-surface-800">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Edit Item</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className={labelCls}>Title</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Status</label>
          <select value={status} onChange={e => setStatus(e.target.value as GsdItemStatus)} className={inputCls}>
            {(Object.keys(STATUS_META) as GsdItemStatus[]).map(s => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </select>
        </div>

        {status === 'waiting' && (
          <div>
            <label className={labelCls}>Waiting for</label>
            <input value={waitingFor} onChange={e => setWaitingFor(e.target.value)}
              placeholder="e.g. John – design review" className={inputCls} />
          </div>
        )}

        <div>
          <label className={labelCls}>Project</label>
          <select value={projectId ?? ''} onChange={e => setProjectId(e.target.value || null)} className={inputCls}>
            <option value="">— No project —</option>
            {projects.filter(p => p.status !== 'completed').map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelCls}>Priority</label>
          <select value={priority} onChange={e => setPriority(e.target.value as GsdPriority)} className={inputCls}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <div>
          <label className={labelCls}>Due date</label>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inputCls} />
        </div>

        <div>
          <label className={labelCls}>Contexts</label>
          <div className="flex flex-wrap gap-1 mb-2">
            {itemContexts.map(ctx => (
              <span key={ctx} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-xs">
                {ctx}
                <button onClick={() => setItemContexts(p => p.filter(c => c !== ctx))} className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5">×</button>
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            <input value={ctxInput} onChange={e => setCtxInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && ctxInput.trim()) addCtx(ctxInput.trim()) }}
              placeholder="@context" className={`${inputCls} flex-1`} />
            <button onClick={() => ctxInput.trim() && addCtx(ctxInput.trim())}
              className="px-2 py-1.5 bg-gray-200 dark:bg-gray-600 rounded text-gray-700 dark:text-gray-200 text-sm hover:bg-gray-300 dark:hover:bg-gray-500">
              +
            </button>
          </div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {useGsdStore.getState().contexts
              .filter(c => !itemContexts.includes(c))
              .map(ctx => (
                <button key={ctx} onClick={() => addCtx(ctx)}
                  className="text-xs px-2 py-0.5 border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-full hover:border-blue-400 hover:text-blue-500">
                  {ctx}
                </button>
              ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4}
            className={`${inputCls} resize-none`} placeholder="Additional notes…" />
        </div>
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
        {item.status === 'inbox' && (
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            <p className="col-span-3 text-[10px] text-gray-400 uppercase font-semibold mb-1">Process as</p>
            {(['next', 'waiting', 'someday'] as GsdItemStatus[]).map(s => (
              <button key={s} onClick={() => { processInbox(item.id, { status: s }); onClose() }}
                className="px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-accent-500 hover:text-accent-500 flex items-center justify-center gap-1">
                {STATUS_META[s].icon} {STATUS_META[s].label.split(' ')[0]}
              </button>
            ))}
          </div>
        )}
        <button onClick={save}
          className="w-full px-3 py-2 bg-accent-500 text-white rounded text-sm font-medium hover:bg-accent-600">
          Save
        </button>
        <button onClick={() => { deleteItem(item.id); onClose() }}
          className="w-full px-3 py-2 bg-white dark:bg-surface-700 border border-gray-300 dark:border-gray-600 text-red-500 rounded text-sm hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center gap-1.5">
          <Trash2 size={13} /> Delete
        </button>
      </div>
    </div>
  )
}

// ── Project card ─────────────────────────────────────────────────────────────
function ProjectCard({ project, itemCount, onEdit, onClick }: { project: GsdProject; itemCount: number; onEdit: () => void; onClick: () => void }) {
  const { updateProject } = useGsdStore()
  return (
    <div
      className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-accent-400 dark:hover:border-accent-500 bg-white dark:bg-surface-800 group cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <div className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style={{ background: project.color }} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{project.name}</p>
          {project.outcome && (
            <p className="text-xs text-gray-400 mt-0.5 truncate" title={project.outcome}>
              → {project.outcome}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-xs text-gray-400">{itemCount} action{itemCount !== 1 ? 's' : ''}</span>
            {project.ganttProjectId && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-500 flex items-center gap-0.5">
                <BarChart2 size={9} /> Gantt
              </span>
            )}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              project.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
              project.status === 'on-hold' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' :
              project.status === 'someday' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-500' :
              'bg-gray-100 dark:bg-gray-700 text-gray-500'
            }`}>
              {project.status}
            </span>
          </div>
        </div>
        <button onClick={e => { e.stopPropagation(); onEdit() }} className="opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
          <Edit2 size={12} />
        </button>
      </div>
    </div>
  )
}

// ── Project detail panel ─────────────────────────────────────────────────────
function ProjectDetailPanel({ project, onBack, onEditProject }: {
  project: GsdProject
  onBack: () => void
  onEditProject: () => void
}) {
  const { items, projects, updateItem } = useGsdStore()
  const [editingItem, setEditingItem] = useState<GsdItem | null>(null)

  const projectItems = useMemo(() => {
    return items
      .filter(i => i.projectId === project.id)
      .sort((a, b) => {
        if (a.status === 'done' && b.status !== 'done') return 1
        if (a.status !== 'done' && b.status === 'done') return -1
        const pOrder = { high: 0, medium: 1, low: 2 }
        return pOrder[a.priority] - pOrder[b.priority]
      })
  }, [items, project.id])

  const byStatus = useMemo(() => {
    const map = new Map<GsdItemStatus, GsdItem[]>()
    const order: GsdItemStatus[] = ['inbox', 'next', 'waiting', 'someday', 'done']
    for (const s of order) map.set(s, [])
    for (const item of projectItems) {
      map.get(item.status)?.push(item)
    }
    return map
  }, [projectItems])

  const handleComplete = (item: GsdItem) => {
    if (item.status === 'done') {
      updateItem(item.id, { status: 'next', completedAt: null })
    } else {
      updateItem(item.id, { status: 'done', completedAt: Date.now() })
    }
  }

  const STATUS_ORDER: GsdItemStatus[] = ['next', 'inbox', 'waiting', 'someday', 'done']

  return (
    <div className="flex-1 flex overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {/* Project header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800">
          <button onClick={onBack} className="flex items-center gap-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm">
            <ArrowLeft size={14} /> Back
          </button>
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: project.color }} />
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{project.name}</span>
          {project.outcome && (
            <span className="text-xs text-gray-400 truncate">→ {project.outcome}</span>
          )}
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
            project.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
            project.status === 'on-hold' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' :
            project.status === 'someday' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-500' :
            'bg-gray-100 dark:bg-gray-700 text-gray-500'
          }`}>{project.status}</span>
          <button onClick={onEditProject} className="p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <Edit2 size={13} />
          </button>
        </div>

        {/* Tasks by status */}
        <div className="p-4">
          {projectItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <FolderOpen size={36} className="opacity-20" />
              <p className="text-sm">No tasks in this project yet.</p>
              <p className="text-xs text-gray-400">Capture items in Inbox and assign them to this project.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {STATUS_ORDER.map(status => {
                const group = byStatus.get(status) ?? []
                if (group.length === 0) return null
                return (
                  <div key={status}>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 flex items-center gap-1.5">
                      {STATUS_META[status].icon}
                      {STATUS_META[status].label}
                      <span className="ml-1 text-gray-300 dark:text-gray-600 font-normal">({group.length})</span>
                    </h3>
                    <div className="space-y-0.5">
                      {group.map(item => (
                        <ItemRow key={item.id} item={item} projects={projects}
                          onEdit={() => setEditingItem(item)}
                          onComplete={() => handleComplete(item)} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {editingItem && (
        <ItemDrawer
          item={editingItem}
          projects={projects}
          contexts={useGsdStore.getState().contexts}
          onClose={() => setEditingItem(null)}
        />
      )}
    </div>
  )
}

// ── Item row ─────────────────────────────────────────────────────────────────
function ItemRow({
  item, projects, onEdit, onComplete,
}: {
  item: GsdItem
  projects: GsdProject[]
  onEdit: () => void
  onComplete: () => void
}) {
  const project = item.projectId ? projects.find(p => p.id === item.projectId) : null
  const today = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD in local time
  const isOverdue = item.dueDate && item.dueDate < today && item.status !== 'done'
  const isDueToday = item.dueDate === today

  return (
    <div className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-surface-700 rounded-lg group cursor-default">
      <button
        onClick={onComplete}
        className="flex-shrink-0 text-gray-300 dark:text-gray-600 hover:text-green-500 dark:hover:text-green-400 transition-colors"
        title={item.status === 'done' ? 'Mark undone' : 'Mark done'}
      >
        {item.status === 'done'
          ? <CheckCircle size={16} className="text-green-500" />
          : <Circle size={16} />
        }
      </button>

      <div className="flex-1 min-w-0" onClick={onEdit}>
        <div className="flex items-center gap-1.5">
          <span className={`text-sm truncate ${item.status === 'done' ? 'line-through text-gray-400' : 'text-gray-800 dark:text-gray-100'}`}>
            {item.title}
          </span>
          {item.priority === 'high' && item.status !== 'done' && (
            <Flag size={11} className="text-red-500 flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {project && (
            <span className="text-[10px] flex items-center gap-0.5" style={{ color: project.color }}>
              <FolderOpen size={9} /> {project.name}
            </span>
          )}
          {item.contexts.map(ctx => (
            <span key={ctx} className="text-[10px] text-blue-500 dark:text-blue-400">{ctx}</span>
          ))}
          {item.waitingFor && item.status === 'waiting' && (
            <span className="text-[10px] text-amber-500 flex items-center gap-0.5">
              <User size={9} /> {item.waitingFor}
            </span>
          )}
          {item.dueDate && (
            <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue ? 'text-red-500 font-medium' : isDueToday ? 'text-amber-500' : 'text-gray-400'}`}>
              <Calendar size={9} />
              {isOverdue ? 'Overdue: ' : isDueToday ? 'Today: ' : ''}
              {item.dueDate}
            </span>
          )}
          {item.ganttTaskId && (
            <span className="text-[10px] text-indigo-400 flex items-center gap-0.5">
              <BarChart2 size={9} /> Gantt
            </span>
          )}
        </div>
      </div>

      <button onClick={onEdit} className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-1 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
        <MoreHorizontal size={14} />
      </button>
    </div>
  )
}

// ── Project editor modal ─────────────────────────────────────────────────────
function ProjectEditor({ project, onClose }: { project?: GsdProject; onClose: () => void }) {
  const { addProject, updateProject, deleteProject } = useGsdStore()
  const isNew = !project
  const [name, setName] = useState(project?.name ?? '')
  const [description, setDescription] = useState(project?.description ?? '')
  const [outcome, setOutcome] = useState(project?.outcome ?? '')
  const [status, setStatus] = useState<GsdProject['status']>(project?.status ?? 'active')
  const [color, setColor] = useState(project?.color ?? '#8b5cf6')

  const COLORS = ['#8b5cf6','#3b82f6','#10b981','#f59e0b','#ef4444','#ec4899','#06b6d4','#84cc16']

  const save = () => {
    if (!name.trim()) return
    if (isNew) {
      addProject({ name: name.trim(), description, outcome, status, color })
    } else {
      updateProject(project!.id, { name: name.trim(), description, outcome, status, color })
    }
    onClose()
  }

  const inputCls = 'w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500'
  const labelCls = 'text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-surface-800 rounded-xl shadow-2xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {isNew ? 'New Project' : 'Edit Project'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className={labelCls}>Project name *</label>
            <input value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder="e.g. Launch new website" autoFocus />
          </div>
          <div>
            <label className={labelCls}>Desired outcome</label>
            <input value={outcome} onChange={e => setOutcome(e.target.value)} className={inputCls}
              placeholder="What does done look like?" />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              className={`${inputCls} resize-none`} placeholder="Optional context…" />
          </div>
          <div>
            <label className={labelCls}>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value as GsdProject['status'])} className={inputCls}>
              <option value="active">Active</option>
              <option value="on-hold">On hold</option>
              <option value="someday">Someday/Maybe</option>
              <option value="completed">Completed</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : 'hover:scale-110'}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center gap-2">
          <button onClick={save} disabled={!name.trim()}
            className="flex-1 py-2 bg-accent-500 text-white rounded text-sm font-medium hover:bg-accent-600 disabled:opacity-50">
            {isNew ? 'Create Project' : 'Save'}
          </button>
          {!isNew && (
            <button onClick={() => { deleteProject(project!.id); onClose() }}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main GsdView ─────────────────────────────────────────────────────────────
type GsdTab = 'planner' | 'inbox' | 'next' | 'waiting' | 'someday' | 'done' | 'projects' | 'review' | 'help' | 'gantt' | 'tasks' | 'calendar'

export default function GsdView() {
  const { items, projects, updateItem, syncFromGantt } = useGsdStore()
  const { index } = useVaultStore()
  const [activeTab, setActiveTab] = useState<GsdTab>('inbox')
  const [editingItem, setEditingItem] = useState<GsdItem | null>(null)
  const [editingProject, setEditingProject] = useState<GsdProject | 'new' | null>(null)
  const [filterProject, setFilterProject] = useState<string>('')
  const [filterContext, setFilterContext] = useState<string>('')
  const [showDone, setShowDone] = useState(false)
  const [syncResult, setSyncResult] = useState<{ newProjects: number; newItems: number } | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [ganttViewMode, setGanttViewMode] = useState<'Day' | 'Week' | 'Month' | 'Quarter Year'>('Week')
  const [ganttCollapsedParents, setGanttCollapsedParents] = useState<Set<string>>(new Set())

  const handleToggleGanttParent = useCallback((taskId: string) => {
    setGanttCollapsedParents(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }, [])

  // Derive Gantt projects from vault
  const ganttProjects = useMemo(() => parseGanttTasks(index), [index])
  const hasGanttData = ganttProjects.length > 0
  const unlinkedGanttProjects = useMemo(() =>
    ganttProjects.filter(gp => !projects.some(p => p.ganttProjectId === gp.id || p.name === gp.name)),
    [ganttProjects, projects]
  )

  // Merge vault-parsed gantt projects with GSD-native projects for the Gantt tab
  const mergedGanttProjects = useMemo<GanttProjectType[]>(() => {
    const today = todayIso()
    const ninetyDays = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10)

    // GSD-native projects that are NOT already represented in vault gantt data
    const gsdOnly = projects.filter(p =>
      p.status !== 'completed' &&
      !ganttProjects.some(gp => gp.id === p.ganttProjectId || gp.name === p.name)
    )

    const gsdGanttProjects: GanttProjectType[] = gsdOnly.map(p => {
      const projItems = items.filter(i => i.projectId === p.id && i.status !== 'done')
      const tasks: GanttTask[] = projItems.map((item, idx) => ({
        id: item.id,
        name: item.title,
        start: item.dueDate
          ? new Date(new Date(item.dueDate).getTime() - 7 * 86400000).toISOString().slice(0, 10)
          : today,
        end: item.dueDate ?? ninetyDays,
        progress: item.status === 'done' ? 100 : 0,
        project: p.name,
      }))

      // If no items with dates, create a placeholder spanning project horizon
      if (tasks.length === 0) {
        tasks.push({
          id: `${p.id}-placeholder`,
          name: '(no tasks yet)',
          start: today,
          end: ninetyDays,
          progress: 0,
          project: p.name,
        })
      }

      return { id: p.id, name: p.name, tasks }
    })

    return [...ganttProjects, ...gsdGanttProjects]
  }, [ganttProjects, projects, items])

  // Merged gantt tasks for "all projects" view
  const mergedGanttTasksRaw = useMemo<GanttTask[]>(() => {
    return mergedGanttProjects.flatMap(p =>
      p.tasks.map(t => ({ ...t, name: `[${p.name}] ${t.name}` }))
    )
  }, [mergedGanttProjects])

  const ganttParentIds = useMemo(() => {
    const s = new Set<string>()
    mergedGanttTasksRaw.forEach(t => { if (t.parentTaskId) s.add(t.parentTaskId) })
    return s
  }, [mergedGanttTasksRaw])

  const mergedGanttTasks = useMemo<GanttTask[]>(() =>
    mergedGanttTasksRaw.filter(t => !t.parentTaskId || !ganttCollapsedParents.has(t.parentTaskId)),
    [mergedGanttTasksRaw, ganttCollapsedParents]
  )

  const mergedProjectColors = useMemo(() => {
    const palette = ['#8b5cf6','#3b82f6','#10b981','#f59e0b','#ef4444','#ec4899','#06b6d4','#84cc16','#f97316','#a855f7']
    const map = new Map<string, string>()
    mergedGanttProjects.forEach((p, i) => map.set(p.name, palette[i % palette.length]))
    return map
  }, [mergedGanttProjects])

  // GSD items with due dates as calendar events
  const gsdCalendarEvents = useMemo(() => {
    return items
      .filter(i => i.dueDate && i.status !== 'done')
      .map(i => {
        const proj = projects.find(p => p.id === i.projectId)
        return {
          id: `gsd-${i.id}`,
          title: i.title,
          start: i.dueDate!,
          end: i.dueDate!,
          backgroundColor: i.status === 'next' ? '#3b82f6' : '#8b5cf6',
          borderColor: i.status === 'next' ? '#2563eb' : '#7c3aed',
          extendedProps: {
            calendarId: 'gsd-tasks',
            source: 'local' as const,
          },
        }
      })
  }, [items, projects])

  const handleSyncGantt = () => {
    const result = syncFromGantt(ganttProjects)
    setSyncResult(result)
    setTimeout(() => setSyncResult(null), 4000)
  }

  const inboxCount = useMemo(() => items.filter(i => i.status === 'inbox').length, [items])

  const filteredItems = useMemo(() => {
    let list = items.filter(i => {
      if (activeTab === 'review') return i.status !== 'done'
      if (activeTab === 'done') return i.status === 'done'
      return i.status === activeTab
    })
    if (filterProject) list = list.filter(i => i.projectId === filterProject)
    if (filterContext) list = list.filter(i => i.contexts.includes(filterContext))
    // Sort: overdue → high priority → medium → low → by title
    list = [...list].sort((a, b) => {
      const todayStr = new Date().toLocaleDateString('en-CA')
      const aOverdue = a.dueDate && a.dueDate < todayStr ? 0 : 1
      const bOverdue = b.dueDate && b.dueDate < todayStr ? 0 : 1
      if (aOverdue !== bOverdue) return aOverdue - bOverdue
      const pOrder = { high: 0, medium: 1, low: 2 }
      if (pOrder[a.priority] !== pOrder[b.priority]) return pOrder[a.priority] - pOrder[b.priority]
      return a.title.localeCompare(b.title)
    })
    return list
  }, [items, activeTab, filterProject, filterContext])

  const projectItemCounts = useMemo(() => {
    const m = new Map<string, number>()
    items.filter(i => i.status !== 'done').forEach(i => {
      if (i.projectId) m.set(i.projectId, (m.get(i.projectId) ?? 0) + 1)
    })
    return m
  }, [items])

  const allContexts = useMemo(() => {
    const s = new Set<string>()
    items.forEach(i => i.contexts.forEach(c => s.add(c)))
    return Array.from(s).sort()
  }, [items])

  const handleComplete = (item: GsdItem) => {
    if (item.status === 'done') {
      updateItem(item.id, { status: 'next', completedAt: null })
    } else {
      updateItem(item.id, { status: 'done', completedAt: Date.now() })
    }
  }

  const TABS: { id: GsdTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'planner',  label: 'Plan',          icon: <FileText size={14} /> },
    { id: 'inbox',    label: 'Inbox',         icon: <Inbox size={14} />,        badge: inboxCount || undefined },
    { id: 'next',     label: 'Next Actions',  icon: <Zap size={14} /> },
    { id: 'waiting',  label: 'Waiting For',   icon: <Clock size={14} /> },
    { id: 'someday',  label: 'Someday/Maybe', icon: <Cloud size={14} /> },
    { id: 'projects', label: 'Projects',      icon: <FolderOpen size={14} /> },
    { id: 'done',     label: 'Done',          icon: <CheckCircle2 size={14} /> },
    { id: 'review',   label: 'Review',        icon: <AlertCircle size={14} /> },
    { id: 'gantt',     label: 'Gantt',         icon: <BarChart2 size={14} /> },
    { id: 'tasks',     label: 'Tasks',         icon: <CheckSquare size={14} /> },
    { id: 'calendar',  label: 'Calendar',      icon: <Calendar size={14} /> },
    { id: 'help',      label: 'Help Guide',    icon: <HelpCircle size={14} /> },
  ]

  // Weekly review stats
  const reviewStats = useMemo(() => {
    const now = Date.now()
    const weekAgo = now - 7 * 86400000
    const completedThisWeek = items.filter(i => i.completedAt && i.completedAt >= weekAgo).length
    const todayStr = new Date().toLocaleDateString('en-CA')
    const overdue = items.filter(i => i.dueDate && i.dueDate < todayStr && i.status !== 'done').length
    const noProject = items.filter(i => !i.projectId && i.status !== 'done' && i.status !== 'inbox').length
    const stale = items.filter(i => {
      if (i.status === 'done' || i.status === 'inbox') return false
      return now - i.updatedAt > 14 * 86400000
    }).length
    return { completedThisWeek, overdue, noProject, stale }
  }, [items])

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-surface-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <Zap size={20} className="text-accent-500" />
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">GSD — Getting Stuff Done</h1>
        <div className="ml-auto flex items-center gap-2">
          {(activeTab === 'next' || activeTab === 'waiting' || activeTab === 'someday') && (
            <>
              {projects.filter(p => p.status !== 'completed').length > 0 && (
                <select value={filterProject} onChange={e => setFilterProject(e.target.value)}
                  className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-surface-700 text-gray-600 dark:text-gray-300">
                  <option value="">All projects</option>
                  {projects.filter(p => p.status !== 'completed').map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
              {allContexts.length > 0 && (
                <select value={filterContext} onChange={e => setFilterContext(e.target.value)}
                  className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-surface-700 text-gray-600 dark:text-gray-300">
                  <option value="">All contexts</option>
                  {allContexts.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </>
          )}
          {activeTab === 'projects' && (
            <div className="flex items-center gap-2">
              {hasGanttData && (
                <button onClick={handleSyncGantt}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-surface-700 text-sm">
                  <RefreshCw size={13} /> Sync from Gantt
                </button>
              )}
              <button onClick={() => setEditingProject('new')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-500 text-white rounded hover:bg-accent-600 text-sm">
                <Plus size={13} /> New Project
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Quick capture */}
      <QuickCapture />

      {/* Gantt import banner — shown when gantt data exists but not yet synced */}
      {unlinkedGanttProjects.length > 0 && activeTab !== 'help' && (
        <div className="flex items-center gap-3 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 text-sm flex-shrink-0">
          <BarChart2 size={14} className="text-blue-500 flex-shrink-0" />
          <span className="text-blue-700 dark:text-blue-300 flex-1">
            {unlinkedGanttProjects.length} Gantt project{unlinkedGanttProjects.length !== 1 ? 's' : ''} found in your vault —{' '}
            <strong>{unlinkedGanttProjects.map(p => p.name).join(', ')}</strong>
          </span>
          <button onClick={handleSyncGantt}
            className="flex items-center gap-1 px-2.5 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 flex-shrink-0">
            <RefreshCw size={11} /> Import
          </button>
          <span className="text-blue-400 text-xs">or go to Projects tab</span>
        </div>
      )}

      {/* Sync result toast */}
      {syncResult && (
        <div className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800 text-sm flex-shrink-0">
          <CheckCircle2 size={14} className="text-green-500" />
          <span className="text-green-700 dark:text-green-300">
            Synced from Gantt — {syncResult.newProjects} new project{syncResult.newProjects !== 1 ? 's' : ''}, {syncResult.newItems} new action{syncResult.newItems !== 1 ? 's' : ''} added
          </span>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-center px-4 gap-0.5 border-b border-gray-200 dark:border-gray-700 overflow-x-auto flex-shrink-0">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setFilterProject(''); setFilterContext('') }}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs border-b-2 whitespace-nowrap transition-colors flex-shrink-0 ${
              activeTab === tab.id
                ? 'border-accent-500 text-accent-500 font-medium'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}>
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="ml-0.5 bg-accent-500 text-white rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Main content */}
      {activeTab === 'planner' && <ProjectPlanner />}
      {activeTab === 'gantt' && (
        mergedGanttTasksRaw.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400">
            <BarChart2 size={40} className="opacity-20" />
            <p className="text-sm">No projects or tasks to display on the Gantt chart.</p>
            <p className="text-xs text-gray-400">Add tasks with due dates to your projects, or create Gantt charts in markdown notes.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              {(['Day', 'Week', 'Month', 'Quarter Year'] as const).map(m => (
                <button key={m} onClick={() => setGanttViewMode(m)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    ganttViewMode === m
                      ? 'bg-accent-500 text-white'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-700'
                  }`}>{m}</button>
              ))}
            </div>
            <div className="flex-1 overflow-auto p-4">
              <GanttChart
                tasks={mergedGanttTasks}
                viewMode={ganttViewMode}
                projectColors={mergedProjectColors}
                parentIds={ganttParentIds}
                collapsedParents={ganttCollapsedParents}
                onToggleParent={handleToggleGanttParent}
              />
            </div>
          </div>
        )
      )}
      {activeTab === 'tasks' && <TasksView />}
      {activeTab === 'calendar' && <CalendarView extraEvents={gsdCalendarEvents} />}
      <div className={`flex-1 flex overflow-hidden ${activeTab === 'planner' || activeTab === 'gantt' || activeTab === 'tasks' || activeTab === 'calendar' ? 'hidden' : ''}`}>
        <div className="flex-1 overflow-y-auto">
          {/* ── Inbox ── */}
          {activeTab === 'inbox' && (
            <div className="p-4">
              {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                  <CheckCircle2 size={40} className="opacity-30 text-green-400" />
                  <p className="text-base font-medium text-gray-500">Inbox zero!</p>
                  <p className="text-sm text-center max-w-xs">Everything has been processed. Capture new items above.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-gray-400 mb-3">{filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} to process — click an item to assign it a status, project, and context</p>
                  <div className="space-y-0.5">
                    {filteredItems.map(item => (
                      <ItemRow key={item.id} item={item} projects={projects}
                        onEdit={() => setEditingItem(item)}
                        onComplete={() => handleComplete(item)} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Next / Waiting / Someday ── */}
          {(activeTab === 'next' || activeTab === 'waiting' || activeTab === 'someday') && (
            <div className="p-4">
              {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                  {activeTab === 'next' && <><Zap size={40} className="opacity-20" /><p className="text-sm">No next actions. Process your inbox or add an action.</p></>}
                  {activeTab === 'waiting' && <><Clock size={40} className="opacity-20" /><p className="text-sm">Nothing waiting. Good to go!</p></>}
                  {activeTab === 'someday' && <><Cloud size={40} className="opacity-20" /><p className="text-sm">No someday/maybe items yet.</p></>}
                </div>
              ) : (
                <div className="space-y-0.5">
                  {filteredItems.filter(i => i.status !== 'done').map(item => (
                    <ItemRow key={item.id} item={item} projects={projects}
                      onEdit={() => setEditingItem(item)}
                      onComplete={() => handleComplete(item)} />
                  ))}
                  {showDone && filteredItems.filter(i => i.status === 'done').length > 0 && (
                    <>
                      <p className="text-xs text-gray-400 mt-4 mb-1 px-3">Done</p>
                      {filteredItems.filter(i => i.status === 'done').map(item => (
                        <ItemRow key={item.id} item={item} projects={projects}
                          onEdit={() => setEditingItem(item)}
                          onComplete={() => handleComplete(item)} />
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Projects ── */}
          {activeTab === 'projects' && (() => {
            const selectedProject = selectedProjectId ? projects.find(p => p.id === selectedProjectId) : null
            if (selectedProject) {
              return (
                <ProjectDetailPanel
                  project={selectedProject}
                  onBack={() => setSelectedProjectId(null)}
                  onEditProject={() => { setEditingProject(selectedProject); setSelectedProjectId(null) }}
                />
              )
            }
            return (
              <div className="p-4">
                {projects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                    <FolderOpen size={40} className="opacity-20" />
                    <p className="text-sm">No projects yet. Create one to group related actions.</p>
                    <button onClick={() => setEditingProject('new')}
                      className="flex items-center gap-1.5 px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 text-sm">
                      <Plus size={14} /> New Project
                    </button>
                  </div>
                ) : (
                  <>
                    {(['active', 'on-hold', 'someday', 'completed'] as GsdProject['status'][]).map(status => {
                      const ps = projects.filter(p => p.status === status)
                      if (ps.length === 0) return null
                      return (
                        <div key={status} className="mb-6">
                          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-2 px-1">
                            {status === 'active' ? 'Active Projects' : status === 'on-hold' ? 'On Hold' : status === 'someday' ? 'Someday/Maybe' : 'Completed'}
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {ps.map(p => (
                              <ProjectCard key={p.id} project={p}
                                itemCount={projectItemCounts.get(p.id) ?? 0}
                                onEdit={() => setEditingProject(p)}
                                onClick={() => setSelectedProjectId(p.id)} />
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}
              </div>
            )
          })()}

          {/* ── Done ── */}
          {activeTab === 'done' && (
            <div className="p-4">
              {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                  <CheckCircle2 size={40} className="opacity-20" />
                  <p className="text-sm">Nothing completed yet. Get to work!</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {filteredItems.map(item => (
                    <ItemRow key={item.id} item={item} projects={projects}
                      onEdit={() => setEditingItem(item)}
                      onComplete={() => handleComplete(item)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Weekly Review ── */}
          {activeTab === 'review' && (
            <div className="p-4 max-w-2xl space-y-6">
              <div>
                <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-1">Weekly Review</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Process your lists, clear your head, and set yourself up for the week ahead.</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Completed this week', value: reviewStats.completedThisWeek, color: 'text-green-500', icon: <CheckCircle2 size={18} /> },
                  { label: 'Overdue items', value: reviewStats.overdue, color: reviewStats.overdue > 0 ? 'text-red-500' : 'text-gray-400', icon: <AlertCircle size={18} /> },
                  { label: 'Without project', value: reviewStats.noProject, color: reviewStats.noProject > 0 ? 'text-amber-500' : 'text-gray-400', icon: <FolderOpen size={18} /> },
                  { label: 'Stale (14+ days)', value: reviewStats.stale, color: reviewStats.stale > 0 ? 'text-orange-500' : 'text-gray-400', icon: <Clock size={18} /> },
                ].map(({ label, value, color, icon }) => (
                  <div key={label} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-800 text-center">
                    <div className={`flex justify-center mb-1 ${color}`}>{icon}</div>
                    <div className={`text-2xl font-bold ${color}`}>{value}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>

              {/* Checklist */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">Review Checklist</h3>
                <ReviewChecklist />
              </div>

              {/* Attention-needed items */}
              {reviewStats.overdue > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-500 mb-2 flex items-center gap-1.5">
                    <AlertCircle size={14} /> Overdue Items
                  </h3>
                  <div className="space-y-0.5">
                    {items.filter(i => i.dueDate && i.dueDate < new Date().toLocaleDateString('en-CA') && i.status !== 'done').map(item => (
                      <ItemRow key={item.id} item={item} projects={projects}
                        onEdit={() => setEditingItem(item)}
                        onComplete={() => handleComplete(item)} />
                    ))}
                  </div>
                </div>
              )}

              {reviewStats.noProject > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-amber-500 mb-2 flex items-center gap-1.5">
                    <FolderOpen size={14} /> Actions Without a Project
                  </h3>
                  <div className="space-y-0.5">
                    {items.filter(i => !i.projectId && i.status !== 'done' && i.status !== 'inbox').map(item => (
                      <ItemRow key={item.id} item={item} projects={projects}
                        onEdit={() => setEditingItem(item)}
                        onComplete={() => handleComplete(item)} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {/* ── Help Guide ── */}
          {activeTab === 'help' && <GsdHelpGuide onGetStarted={() => setActiveTab('inbox')} />}
        </div>

        {/* Item editor panel */}
        {editingItem && (
          <ItemDrawer
            item={editingItem}
            projects={projects}
            contexts={useGsdStore.getState().contexts}
            onClose={() => setEditingItem(null)}
          />
        )}
      </div>

      {/* Project editor modal */}
      {editingProject && (
        <ProjectEditor
          project={editingProject === 'new' ? undefined : editingProject}
          onClose={() => setEditingProject(null)}
        />
      )}
    </div>
  )
}

// ── Weekly Review Checklist ──────────────────────────────────────────────────
const REVIEW_STEPS = [
  { id: 'inbox',    label: 'Process inbox to zero' },
  { id: 'mind',     label: 'Do a mind sweep — capture everything on your mind' },
  { id: 'calendar', label: 'Review past calendar for loose ends' },
  { id: 'calendar2',label: 'Review upcoming calendar for prep needed' },
  { id: 'next',     label: 'Review Next Actions — mark done, update dates' },
  { id: 'waiting',  label: 'Review Waiting For — follow up if needed' },
  { id: 'projects', label: 'Review Projects — ensure each has a next action' },
  { id: 'someday',  label: 'Review Someday/Maybe — promote or delete' },
  { id: 'goals',    label: 'Review goals and areas of focus' },
]

function ReviewChecklist() {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const toggle = (id: string) => setChecked(prev => {
    const next = new Set(prev)
    if (next.has(id)) { next.delete(id) } else { next.add(id) }
    return next
  })
  const done = checked.size
  const total = REVIEW_STEPS.length

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">{done}/{total} complete</span>
        {done === total && <span className="text-xs text-green-500 font-medium">✓ Review complete!</span>}
        {done > 0 && done < total && (
          <button onClick={() => setChecked(new Set())} className="text-xs text-gray-400 hover:text-gray-600">Reset</button>
        )}
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-3">
        <div className="bg-accent-500 h-1.5 rounded-full transition-all" style={{ width: `${(done / total) * 100}%` }} />
      </div>
      {REVIEW_STEPS.map((step, i) => (
        <label key={step.id} className="flex items-center gap-2.5 py-1.5 cursor-pointer group">
          <input type="checkbox" checked={checked.has(step.id)} onChange={() => toggle(step.id)}
            className="accent-accent-500 w-3.5 h-3.5 flex-shrink-0" />
          <span className={`text-sm transition-colors ${checked.has(step.id) ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
            {step.label}
          </span>
        </label>
      ))}
    </div>
  )
}

// ── GSD Help Guide ────────────────────────────────────────────────────────────
function HelpSection({ icon, title, color, children }: {
  icon: React.ReactNode; title: string; color: string; children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-surface-800 hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors text-left"
      >
        <span className={color}>{icon}</span>
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 flex-1">{title}</span>
        {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRightIcon size={14} className="text-gray-400" />}
      </button>
      {open && <div className="px-4 py-4 space-y-3 bg-white dark:bg-surface-900">{children}</div>}
    </div>
  )
}

function GsdHelpGuide({ onGetStarted }: { onGetStarted: () => void }) {
  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-3xl space-y-6">
      {/* Hero */}
      <div className="text-center pb-2">
        <div className="flex justify-center mb-3">
          <div className="w-14 h-14 bg-accent-500/10 rounded-2xl flex items-center justify-center">
            <Zap size={28} className="text-accent-500" />
          </div>
        </div>
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">Getting Stuff Done</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-lg mx-auto">
          A stress-free system for capturing, clarifying, and acting on everything in your life and work.
          Based on David Allen's <em>GTD</em> methodology — adapted for this app.
        </p>
        <button onClick={onGetStarted}
          className="mt-4 inline-flex items-center gap-2 px-5 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 text-sm font-medium">
          <ArrowRight size={15} /> Start with your Inbox
        </button>
      </div>

      {/* Core principle */}
      <div className="p-4 bg-accent-500/5 border border-accent-500/20 rounded-lg">
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          <strong className="text-accent-500">The core idea:</strong> Your brain is for having ideas, not holding them.
          Get everything out of your head and into a trusted system. Once your mind is clear, you can focus on
          <em> doing</em> — not remembering, worrying, or wondering what to do next.
        </p>
      </div>

      {/* The 5 steps */}
      <HelpSection icon={<ListChecks size={18} />} title="The 5-Step GSD Process" color="text-accent-500">
        <div className="space-y-4">
          {[
            {
              num: '1', label: 'Capture', icon: <Inbox size={15} />, color: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300',
              desc: 'Collect everything that has your attention — tasks, ideas, projects, commitments, emails — into the Inbox. Don\'t evaluate yet, just capture.',
              tip: 'Use the capture bar at the top of every screen. Capture anything the moment it comes to mind.',
            },
            {
              num: '2', label: 'Clarify', icon: <Lightbulb size={15} />, color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400',
              desc: 'Process each inbox item. Ask: "Is this actionable?" If yes — what\'s the next physical action? If no — trash it, archive it, or move it to Someday/Maybe.',
              tip: 'Click any inbox item to open the drawer. Use "Process as" buttons to move items to Next, Waiting, or Someday.',
            },
            {
              num: '3', label: 'Organise', icon: <FolderOpen size={15} />, color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
              desc: 'Put actions in the right lists. Multi-step outcomes become Projects. Single actions go to Next Actions. Delegated items go to Waiting For.',
              tip: 'Group related actions under a Project. Add @contexts (like @computer or @calls) to filter by where you are.',
            },
            {
              num: '4', label: 'Reflect', icon: <AlertCircle size={15} />, color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
              desc: 'Review your lists regularly. A weekly review keeps your system current and your mind clear. Check the Weekly Review tab each Friday.',
              tip: 'The Review tab has a guided checklist. Aim to complete it once a week — ideally on Friday afternoon.',
            },
            {
              num: '5', label: 'Engage', icon: <Zap size={15} />, color: 'bg-accent-500/10 text-accent-500',
              desc: 'Do the work. Use your Next Actions list filtered by context to decide what to do right now based on where you are, your energy, and available time.',
              tip: 'Filter Next Actions by @context to see only what\'s possible in your current situation.',
            },
          ].map(step => (
            <div key={step.num} className="flex gap-3">
              <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step.color}`}>
                {step.num}
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">{step.label}</span>
                  <span className="text-gray-400">{step.icon}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{step.desc}</p>
                <p className="text-xs text-accent-500 mt-1 flex items-start gap-1">
                  <span className="flex-shrink-0 mt-0.5">→</span> {step.tip}
                </p>
              </div>
            </div>
          ))}
        </div>
      </HelpSection>

      {/* The lists explained */}
      <HelpSection icon={<BookOpen size={18} />} title="Understanding Your Lists" color="text-blue-500">
        <div className="space-y-3">
          {[
            { icon: <Inbox size={14} />, name: 'Inbox', color: 'text-gray-500', desc: 'The collection point. Nothing lives here permanently — process it to zero regularly.' },
            { icon: <Zap size={14} />, name: 'Next Actions', color: 'text-blue-500', desc: 'The single next physical action for every active commitment. These are things you can do right now. Keep this list ruthlessly current.' },
            { icon: <Clock size={14} />, name: 'Waiting For', color: 'text-amber-500', desc: 'Things you\'ve delegated or are expecting from others. Review weekly and follow up proactively.' },
            { icon: <Cloud size={14} />, name: 'Someday/Maybe', color: 'text-purple-500', desc: 'Ideas and projects you\'re not ready to commit to yet. Review monthly — things move in and out. Don\'t let it become a dump.' },
            { icon: <FolderOpen size={14} />, name: 'Projects', color: 'text-green-500', desc: 'Any outcome requiring more than one action step. Every project needs at least one Next Action. If it doesn\'t, it stalls.' },
          ].map(list => (
            <div key={list.name} className="flex gap-3 items-start">
              <span className={`${list.color} flex-shrink-0 mt-0.5`}>{list.icon}</span>
              <div>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{list.name} — </span>
                <span className="text-sm text-gray-600 dark:text-gray-400">{list.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </HelpSection>

      {/* Contexts */}
      <HelpSection icon={<Target size={18} />} title="Using Contexts" color="text-green-500">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          Contexts tag actions by where or how they can be done. When you\'re at your desk, filter by <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">@computer</code>.
          When you\'re out running errands, filter by <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">@errands</code>.
          This eliminates the mental overhead of scanning the whole list.
        </p>
        <div className="flex flex-wrap gap-2 mt-2">
          {['@computer', '@calls', '@home', '@errands', '@office', '@email', '@anywhere', '@low-energy'].map(ctx => (
            <span key={ctx} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-xs">{ctx}</span>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">Add these when editing any action in the item drawer.</p>
      </HelpSection>

      {/* Gantt integration */}
      <HelpSection icon={<BarChart2 size={18} />} title="Gantt Chart Integration" color="text-indigo-500">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          GSD is connected to your Gantt chart. Any notes with <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">type: gantt-task</code> in their frontmatter
          will appear here as actions. Projects in your Gantt are automatically imported as GSD projects.
        </p>
        <ul className="space-y-1.5 mt-2">
          {[
            'Click "Sync from Gantt" on the Projects tab to import your Gantt projects and tasks',
            'A blue banner appears at the top when unsynced Gantt projects are detected',
            'Synced items stay linked — re-syncing updates titles and due dates without creating duplicates',
            'You can also create new Gantt tasks directly from the GSD New Task form in the Gantt view',
          ].map((point, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="text-indigo-400 flex-shrink-0 mt-0.5">•</span> {point}
            </li>
          ))}
        </ul>
      </HelpSection>

      {/* Weekly review */}
      <HelpSection icon={<AlertCircle size={18} />} title="The Weekly Review" color="text-orange-500">
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          The weekly review is the most important habit in GSD. It keeps your system trustworthy. Without it,
          the lists go stale and your brain stops trusting the system — and starts holding things again.
        </p>
        <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
          <p className="text-xs font-semibold text-orange-600 dark:text-orange-400 mb-2">Aim for every Friday afternoon:</p>
          <ul className="space-y-1">
            {['Clear your inbox to zero', 'Review all active projects — does each have a next action?', 'Go through Waiting For and follow up if needed', 'Review Someday/Maybe — promote anything that\'s now relevant', 'Check the calendar — anything coming up that needs prep?'].map((s, i) => (
              <li key={i} className="text-xs text-gray-600 dark:text-gray-400 flex items-start gap-1.5">
                <CheckCircle2 size={11} className="text-orange-400 flex-shrink-0 mt-0.5" /> {s}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-gray-400 mt-2">The full guided checklist is on the <strong>Review</strong> tab.</p>
      </HelpSection>

      {/* Quick tips */}
      <HelpSection icon={<Lightbulb size={18} />} title="Quick Tips" color="text-yellow-500">
        <ul className="space-y-2">
          {[
            { tip: 'Two-minute rule', desc: 'If an action takes less than 2 minutes, do it now instead of tracking it.' },
            { tip: 'One next action', desc: 'Every project must have exactly one clearly defined next physical action. If it doesn\'t, nothing will happen.' },
            { tip: 'Specificity matters', desc: '"Email John" is better than "Deal with John situation". The clearer the action, the easier it is to start.' },
            { tip: 'Don\'t organise what you can delete', desc: 'If it\'s not actionable and not reference material, trash it.' },
            { tip: 'Trusted system', desc: 'The system only works if you trust it. Keep it up to date and your brain will stop trying to remember things.' },
          ].map(({ tip, desc }) => (
            <li key={tip} className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium text-gray-800 dark:text-gray-200">{tip}: </span>{desc}
            </li>
          ))}
        </ul>
      </HelpSection>

      <div className="text-center pt-2 pb-6">
        <button onClick={onGetStarted}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-accent-500 text-white rounded-lg hover:bg-accent-600 text-sm font-medium">
          <Inbox size={15} /> Start Capturing →
        </button>
        <p className="text-xs text-gray-400 mt-2">Everything starts with the Inbox.</p>
      </div>
    </div>
  )
}
