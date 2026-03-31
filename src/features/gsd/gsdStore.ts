import { create } from 'zustand'
import type { GanttProject } from '../../types/gantt'

export type GsdItemStatus = 'inbox' | 'next' | 'waiting' | 'someday' | 'done'
export type GsdPriority = 'high' | 'medium' | 'low'
export type GsdContext = string // @home, @computer, @calls, etc.

export interface GsdItem {
  id: string
  title: string
  notes: string
  status: GsdItemStatus
  projectId: string | null
  priority: GsdPriority
  contexts: string[]
  dueDate: string | null
  waitingFor: string    // person/thing we're waiting on
  createdAt: number
  updatedAt: number
  completedAt: number | null
  ganttTaskId?: string  // linked gantt task id (notePath), if synced from gantt
}

export interface GsdProject {
  id: string
  name: string
  description: string
  outcome: string       // desired outcome
  color: string
  status: 'active' | 'on-hold' | 'completed' | 'someday'
  createdAt: number
  ganttProjectId?: string  // linked gantt project id, if synced from gantt
}

interface GsdState {
  items: GsdItem[]
  projects: GsdProject[]
  contexts: string[]

  // Items
  addItem: (partial: Partial<GsdItem> & { title: string }) => GsdItem
  updateItem: (id: string, partial: Partial<GsdItem>) => void
  deleteItem: (id: string) => void
  processInbox: (id: string, updates: Partial<GsdItem>) => void

  // Projects
  addProject: (partial: Partial<GsdProject> & { name: string }) => GsdProject
  updateProject: (id: string, partial: Partial<GsdProject>) => void
  deleteProject: (id: string) => void

  // Contexts
  addContext: (ctx: string) => void
  removeContext: (ctx: string) => void

  // Gantt sync
  syncFromGantt: (ganttProjects: GanttProject[]) => { newProjects: number; newItems: number }

  // Vault sync — load from vault (source of truth when open)
  hydrate: (data: { items: GsdItem[]; projects: GsdProject[]; contexts: string[] }) => void
}

const STORAGE_KEY = 'gsd_data'

const PROJECT_COLORS = [
  '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#84cc16',
]

function load(): { items: GsdItem[]; projects: GsdProject[]; contexts: string[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  return { items: [], projects: [], contexts: ['@computer', '@calls', '@errands', '@home', '@office'] }
}

function save(state: { items: GsdItem[]; projects: GsdProject[]; contexts: string[] }) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

export const useGsdStore = create<GsdState>((set, get) => {
  const initial = load()

  const persist = (partial: Partial<{ items: GsdItem[]; projects: GsdProject[]; contexts: string[] }>) => {
    const next = { ...get(), ...partial }
    save({ items: next.items, projects: next.projects, contexts: next.contexts })
    return partial
  }

  return {
    ...initial,

    addItem: (partial) => {
      const item: GsdItem = {
        id: `gsd-item-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        title: partial.title,
        notes: partial.notes ?? '',
        status: partial.status ?? 'inbox',
        projectId: partial.projectId ?? null,
        priority: partial.priority ?? 'medium',
        contexts: partial.contexts ?? [],
        dueDate: partial.dueDate ?? null,
        waitingFor: partial.waitingFor ?? '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        completedAt: null,
      }
      set(s => persist({ items: [...s.items, item] }))
      return item
    },

    updateItem: (id, partial) => {
      set(s => persist({
        items: s.items.map(item =>
          item.id === id ? { ...item, ...partial, updatedAt: Date.now() } : item
        ),
      }))
    },

    deleteItem: (id) => {
      set(s => persist({ items: s.items.filter(i => i.id !== id) }))
    },

    processInbox: (id, updates) => {
      set(s => persist({
        items: s.items.map(item =>
          item.id === id ? { ...item, ...updates, updatedAt: Date.now() } : item
        ),
      }))
    },

    addProject: (partial) => {
      const { projects } = get()
      const project: GsdProject = {
        id: `gsd-proj-${Date.now()}`,
        name: partial.name,
        description: partial.description ?? '',
        outcome: partial.outcome ?? '',
        color: partial.color ?? PROJECT_COLORS[projects.length % PROJECT_COLORS.length],
        status: partial.status ?? 'active',
        createdAt: Date.now(),
      }
      set(s => persist({ projects: [...s.projects, project] }))
      return project
    },

    updateProject: (id, partial) => {
      set(s => persist({
        projects: s.projects.map(p => p.id === id ? { ...p, ...partial } : p),
      }))
    },

    deleteProject: (id) => {
      set(s => persist({
        projects: s.projects.filter(p => p.id !== id),
        items: s.items.map(i => i.projectId === id ? { ...i, projectId: null } : i),
      }))
    },

    addContext: (ctx) => {
      const c = ctx.startsWith('@') ? ctx : `@${ctx}`
      set(s => {
        if (s.contexts.includes(c)) return s
        return persist({ contexts: [...s.contexts, c] })
      })
    },

    removeContext: (ctx) => {
      set(s => persist({ contexts: s.contexts.filter(c => c !== ctx) }))
    },

    syncFromGantt: (ganttProjects) => {
      const { projects, items } = get()
      const now = Date.now()
      let newProjects = 0
      let newItems = 0

      const updatedProjects = [...projects]
      const updatedItems = [...items]

      for (const ganttProj of ganttProjects) {
        // Find or create matching GSD project
        let gsdProject = updatedProjects.find(p => p.ganttProjectId === ganttProj.id || p.name === ganttProj.name)
        if (!gsdProject) {
          gsdProject = {
            id: `gsd-proj-gantt-${ganttProj.id}`,
            name: ganttProj.name,
            description: '',
            outcome: '',
            color: PROJECT_COLORS[updatedProjects.length % PROJECT_COLORS.length],
            status: 'active',
            createdAt: now,
            ganttProjectId: ganttProj.id,
          }
          updatedProjects.push(gsdProject)
          newProjects++
        } else if (!gsdProject.ganttProjectId) {
          // Link existing project
          const idx = updatedProjects.findIndex(p => p.id === gsdProject!.id)
          if (idx !== -1) updatedProjects[idx] = { ...gsdProject, ganttProjectId: ganttProj.id }
          gsdProject = updatedProjects[idx]
        }

        // Sync tasks as GSD items
        for (const task of ganttProj.tasks) {
          const taskKey = task.notePath || task.id
          const existing = updatedItems.find(i => i.ganttTaskId === taskKey)
          if (existing) {
            // Update title/dates if changed but preserve GSD status
            const idx = updatedItems.findIndex(i => i.id === existing.id)
            updatedItems[idx] = {
              ...existing,
              title: task.name,
              dueDate: task.end ?? existing.dueDate,
              updatedAt: now,
            }
          } else {
            // Map gantt progress to GSD status
            let status: GsdItemStatus = 'next'
            if (task.progress >= 100) status = 'done'

            const item: GsdItem = {
              id: `gsd-item-gantt-${taskKey}`,
              title: task.name,
              notes: task.notePath ? `Linked from Gantt: ${task.notePath}` : '',
              status,
              projectId: gsdProject!.id,
              priority: 'medium',
              contexts: [],
              dueDate: task.end ?? null,
              waitingFor: '',
              createdAt: now,
              updatedAt: now,
              completedAt: status === 'done' ? now : null,
              ganttTaskId: taskKey,
            }
            updatedItems.push(item)
            newItems++
          }
        }
      }

      set(persist({ projects: updatedProjects, items: updatedItems }))
      return { newProjects, newItems }
    },

    hydrate: (data) => {
      // Load from vault — validate shape minimally
      const items = Array.isArray(data.items) ? data.items : []
      const projects = Array.isArray(data.projects) ? data.projects : []
      const contexts = Array.isArray(data.contexts) ? data.contexts : []
      // Persist to localStorage too so fallback remains in sync
      save({ items, projects, contexts })
      set({ items, projects, contexts })
    },
  }
})
