import React, { useState, useCallback, useRef, useEffect } from 'react'
import {
  Target, Users, Layers, Clock, AlertTriangle, DollarSign,
  MessageSquare, Zap, Plus, Trash2, Download, ChevronLeft,
  ChevronRight, CheckCircle2, Circle, Save, FileText,
  FolderOpen, ArrowRight, X,
} from 'lucide-react'
import { useVaultStore } from '../../stores/vaultStore'
import { useGsdStore } from './gsdStore'
import { useGsdVaultSync } from './useGsdVaultSync'
import type { GsdProject } from './gsdStore'

// ── Types ────────────────────────────────────────────────────────────────────

interface Milestone {
  id: string
  title: string
  date: string
  description: string
}

interface Risk {
  id: string
  description: string
  likelihood: 'low' | 'medium' | 'high'
  impact: 'low' | 'medium' | 'high'
  mitigation: string
}

interface Stakeholder {
  id: string
  name: string
  roles: string[]           // multi-select roles
  responsibility: string
}

interface ActionItem {
  id: string
  title: string
  owner: string
  dueDate: string
  pushToGsd: boolean
  gsdItemId?: string   // id of the linked GSD item once synced
}

export interface ProjectPlan {
  gsdProjectId: string | null
  // Overview
  projectName: string
  description: string
  objectives: string[]
  successCriteria: string[]
  startDate: string
  endDate: string
  // Stakeholders
  sponsor: string
  stakeholders: Stakeholder[]
  // Scope
  inScope: string[]
  outOfScope: string[]
  assumptions: string[]
  constraints: string[]
  // Timeline
  milestones: Milestone[]
  // Risks
  risks: Risk[]
  // Resources
  budget: string
  tools: string[]
  dependencies: string[]
  // Communication
  meetingCadence: string
  reportingFrequency: string
  communicationChannels: string[]
  // Actions
  actionItems: ActionItem[]
}

// ── Persistence ───────────────────────────────────────────────────────────────

const PLANS_KEY = 'project_planner_plans'
const ROLES_KEY = 'project_planner_roles'

const DEFAULT_ROLES = [
  'Project Manager', 'Developer', 'Designer', 'QA Engineer',
  'Product Owner', 'Stakeholder', 'Business Analyst', 'DevOps',
  'Tech Lead', 'Scrum Master', 'UX Researcher', 'Data Analyst',
]

function loadRoles(): string[] {
  try {
    const raw = localStorage.getItem(ROLES_KEY)
    return raw ? JSON.parse(raw) : DEFAULT_ROLES
  } catch {
    return DEFAULT_ROLES
  }
}

function saveRoles(roles: string[]) {
  try { localStorage.setItem(ROLES_KEY, JSON.stringify(roles)) } catch {}
}

function loadPlans(): Record<string, ProjectPlan> {
  try {
    const raw = localStorage.getItem(PLANS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function savePlanToStorage(plan: ProjectPlan) {
  try {
    const key = plan.gsdProjectId ?? '__new__'
    const all = loadPlans()
    all[key] = plan
    localStorage.setItem(PLANS_KEY, JSON.stringify(all))
  } catch {}
}

function loadPlanFromStorage(gsdProjectId: string | null): ProjectPlan | null {
  try {
    const key = gsdProjectId ?? '__new__'
    const all = loadPlans()
    return all[key] ?? null
  } catch {
    return null
  }
}

// ── Utilities ────────────────────────────────────────────────────────────────

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function emptyPlan(): ProjectPlan {
  return {
    gsdProjectId: null,
    projectName: '',
    description: '',
    objectives: [''],
    successCriteria: [''],
    startDate: '',
    endDate: '',
    sponsor: '',
    stakeholders: [],
    inScope: [''],
    outOfScope: [],
    assumptions: [],
    constraints: [],
    milestones: [],
    risks: [],
    budget: '',
    tools: [''],
    dependencies: [],
    communicationChannels: [''],
    meetingCadence: '',
    reportingFrequency: '',
    actionItems: [],
  }
}

// ── Vault helpers ────────────────────────────────────────────────────────────

function slugifyPlanName(name: string, fallback: string | null): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
  return slug || fallback || 'untitled'
}

function buildPlanMarkdown(plan: ProjectPlan): string {
  const lines: string[] = [
    `# ${plan.projectName || 'Untitled Project'}`,
    '',
    `**Start:** ${plan.startDate || '—'}   **End:** ${plan.endDate || '—'}`,
    '',
  ]
  if (plan.description) {
    lines.push('## Description', plan.description, '')
  }
  if (plan.objectives.some(s => s.trim())) {
    lines.push('## Objectives', ...plan.objectives.filter(s => s.trim()).map(s => `- ${s}`), '')
  }
  if (plan.successCriteria.some(s => s.trim())) {
    lines.push('## Success Criteria', ...plan.successCriteria.filter(s => s.trim()).map(s => `- ${s}`), '')
  }
  if (plan.milestones.length) {
    lines.push('## Milestones', ...plan.milestones.map(m => `- **${m.date}** ${m.title}: ${m.description}`), '')
  }
  if (plan.actionItems.length) {
    lines.push('## Action Items', ...plan.actionItems.map(a => `- [ ] ${a.title} (${a.owner || 'unassigned'}, due ${a.dueDate || 'TBD'})`), '')
  }
  lines.push('<!-- GSD Plan Data — do not edit below this line -->', '```json', JSON.stringify(plan, null, 2), '```')
  return lines.join('\n')
}

function planFromGsdProject(
  project: GsdProject,
  items: ReturnType<typeof useGsdStore.getState>['items'],
): ProjectPlan {
  // Check for a saved plan first — reload all filled data
  const saved = loadPlanFromStorage(project.id)
  if (saved) return saved

  const projItems = items.filter(i => i.projectId === project.id && i.status !== 'done')
  const actionItems: ActionItem[] = projItems.map(item => ({
    id: uid(),
    title: item.title,
    owner: '',
    dueDate: item.dueDate ?? '',
    pushToGsd: true,
    gsdItemId: item.id,
  }))

  return {
    ...emptyPlan(),
    gsdProjectId: project.id,
    projectName: project.name,
    description: project.description ?? '',
    actionItems,
  }
}

// ── GSD sync ─────────────────────────────────────────────────────────────────

/**
 * Syncs a plan's action items and project metadata to the GSD store.
 * - Creates the GSD project if it doesn't exist yet.
 * - For each pushToGsd action: creates a new GSD item or updates the existing one.
 * - Removes GSD items that were un-checked from pushToGsd.
 * - Returns an updated copy of the plan with gsdItemId fields filled in.
 */
function syncPlanToGsd(
  plan: ProjectPlan,
  store: ReturnType<typeof useGsdStore.getState>,
): ProjectPlan {
  if (!plan.projectName.trim()) return plan

  const { addProject, updateProject, addItem, updateItem, deleteItem } = store

  // Ensure GSD project exists — re-read state after any mutation so we see fresh data
  let gsdProjectId = plan.gsdProjectId
  if (!gsdProjectId) {
    const existing = useGsdStore.getState().projects.find(p => p.name === plan.projectName.trim())
    if (existing) {
      gsdProjectId = existing.id
    } else {
      const created = addProject({ name: plan.projectName.trim(), description: plan.description })
      gsdProjectId = created.id
    }
  } else {
    updateProject(gsdProjectId, { name: plan.projectName.trim(), description: plan.description })
  }

  // Upsert action items — always re-read items from store so we see latest state
  const updatedActions: ActionItem[] = plan.actionItems.map(action => {
    if (!action.title.trim()) return action

    // Items with a due date go to Next Actions; otherwise Inbox
    const status = action.dueDate ? 'next' : 'inbox'

    if (action.pushToGsd) {
      if (action.gsdItemId) {
        // Check against fresh store state
        const existing = useGsdStore.getState().items.find(i => i.id === action.gsdItemId)
        if (existing) {
          updateItem(action.gsdItemId, {
            title: action.title.trim(),
            status,
            dueDate: action.dueDate || null,
            projectId: gsdProjectId!,
          })
          return action
        }
        // Item was deleted externally — fall through to re-create
      }
      const created = addItem({
        title: action.title.trim(),
        status,
        projectId: gsdProjectId!,
        dueDate: action.dueDate || null,
      })
      return { ...action, gsdItemId: created.id }
    } else {
      // pushToGsd turned off — remove linked GSD item if it came from this plan
      if (action.gsdItemId) {
        const existing = useGsdStore.getState().items.find(i => i.id === action.gsdItemId)
        if (existing && existing.projectId === gsdProjectId) {
          deleteItem(action.gsdItemId)
        }
      }
      return { ...action, gsdItemId: undefined }
    }
  })

  const updated: ProjectPlan = { ...plan, gsdProjectId, actionItems: updatedActions }
  savePlanToStorage(updated)
  return updated
}

// ── Shared style constants ────────────────────────────────────────────────────

const inputCls = 'w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-accent-500'
const labelCls = 'text-xs font-medium text-gray-600 dark:text-gray-400 block mb-1'

// ── StringListEditor ──────────────────────────────────────────────────────────

function StringListEditor({
  label, items, onChange, placeholder,
}: {
  label: string
  items: string[]
  onChange: (items: string[]) => void
  placeholder?: string
}) {
  const update = (i: number, val: string) => {
    const next = [...items]; next[i] = val; onChange(next)
  }
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i))
  const add = () => onChange([...items, ''])

  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="space-y-1.5">
        {items.map((item, i) => (
          <div key={i} className="flex gap-1.5">
            <input value={item} onChange={e => update(i, e.target.value)}
              placeholder={placeholder ?? `Item ${i + 1}`} className={`${inputCls} flex-1`} />
            {items.length > 1 && (
              <button onClick={() => remove(i)} className="p-1.5 text-gray-400 hover:text-red-500 rounded">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
        <button onClick={add} className="flex items-center gap-1 text-xs text-accent-500 hover:text-accent-600 mt-0.5">
          <Plus size={12} /> Add item
        </button>
      </div>
    </div>
  )
}

// ── RoleSelector ──────────────────────────────────────────────────────────────

function RoleSelector({
  selected, onChange, allRoles, onAddRole,
}: {
  selected: string[]
  onChange: (roles: string[]) => void
  allRoles: string[]
  onAddRole: (role: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [newRole, setNewRole] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const toggle = (role: string) => {
    onChange(selected.includes(role) ? selected.filter(r => r !== role) : [...selected, role])
  }

  const commitNew = () => {
    const r = newRole.trim()
    if (!r) { setAdding(false); return }
    if (!allRoles.includes(r)) onAddRole(r)
    if (!selected.includes(r)) onChange([...selected, r])
    setNewRole('')
    setAdding(false)
  }

  return (
    <div>
      {/* Selected tags */}
      <div className="flex flex-wrap gap-1 mb-2 min-h-[24px]">
        {selected.length === 0 && (
          <span className="text-xs text-gray-400 italic">No roles selected</span>
        )}
        {selected.map(r => (
          <span key={r} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300 rounded-full text-xs">
            {r}
            <button onClick={() => toggle(r)} className="hover:bg-accent-200 dark:hover:bg-accent-800 rounded-full p-0.5">
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      {/* Available roles */}
      <div className="flex flex-wrap gap-1">
        {allRoles.filter(r => !selected.includes(r)).map(r => (
          <button key={r} onClick={() => toggle(r)}
            className="text-xs px-2 py-0.5 border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 rounded-full hover:border-accent-400 hover:text-accent-600 dark:hover:text-accent-400 transition-colors">
            + {r}
          </button>
        ))}
        {adding ? (
          <div className="flex items-center gap-1">
            <input
              ref={inputRef}
              autoFocus
              value={newRole}
              onChange={e => setNewRole(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitNew(); if (e.key === 'Escape') setAdding(false) }}
              placeholder="New role…"
              className="text-xs border border-accent-400 rounded px-2 py-0.5 w-28 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none"
            />
            <button onClick={commitNew} className="text-xs text-accent-500 hover:text-accent-600 px-1">Add</button>
            <button onClick={() => setAdding(false)} className="text-xs text-gray-400 hover:text-gray-600 px-1">✕</button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)}
            className="text-xs px-2 py-0.5 border border-dashed border-accent-300 dark:border-accent-700 text-accent-500 rounded-full hover:border-accent-500 transition-colors">
            + Custom role
          </button>
        )}
      </div>
    </div>
  )
}

// ── Step components ───────────────────────────────────────────────────────────

function StepOverview({ plan, update }: { plan: ProjectPlan; update: (p: Partial<ProjectPlan>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <label className={labelCls}>Project Name *</label>
        <input value={plan.projectName} onChange={e => update({ projectName: e.target.value })}
          placeholder="e.g. Website Redesign" className={inputCls} autoFocus />
      </div>
      <div>
        <label className={labelCls}>Description</label>
        <textarea value={plan.description} onChange={e => update({ description: e.target.value })}
          rows={3} placeholder="Brief summary of what this project is about and why it matters."
          className={`${inputCls} resize-none`} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Start Date</label>
          <input type="date" value={plan.startDate} onChange={e => update({ startDate: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>End Date / Deadline</label>
          <input type="date" value={plan.endDate} onChange={e => update({ endDate: e.target.value })} className={inputCls} />
        </div>
      </div>
      <StringListEditor
        label="Objectives — What does this project aim to achieve?"
        items={plan.objectives}
        onChange={objectives => update({ objectives })}
        placeholder="e.g. Increase user engagement by 20%"
      />
      <StringListEditor
        label="Success Criteria — How will you know it's done?"
        items={plan.successCriteria}
        onChange={successCriteria => update({ successCriteria })}
        placeholder="e.g. All pages load under 2 seconds"
      />
    </div>
  )
}

function StepStakeholders({
  plan, update, allRoles, onAddRole,
}: {
  plan: ProjectPlan
  update: (p: Partial<ProjectPlan>) => void
  allRoles: string[]
  onAddRole: (role: string) => void
}) {
  const addStakeholder = () => update({
    stakeholders: [...plan.stakeholders, { id: uid(), name: '', roles: [], responsibility: '' }],
  })
  const updateSH = (id: string, partial: Partial<Stakeholder>) => update({
    stakeholders: plan.stakeholders.map(s => s.id === id ? { ...s, ...partial } : s),
  })
  const removeSH = (id: string) => update({ stakeholders: plan.stakeholders.filter(s => s.id !== id) })

  return (
    <div className="space-y-5">
      <div>
        <label className={labelCls}>Project Sponsor / Executive Owner</label>
        <input value={plan.sponsor} onChange={e => update({ sponsor: e.target.value })}
          placeholder="e.g. Jane Smith, VP Product" className={inputCls} />
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className={labelCls}>Team Members &amp; Stakeholders</label>
          <button onClick={addStakeholder} className="flex items-center gap-1 text-xs text-accent-500 hover:text-accent-600">
            <Plus size={12} /> Add person
          </button>
        </div>
        {plan.stakeholders.length === 0 && (
          <p className="text-xs text-gray-400 italic py-2">No stakeholders added yet.</p>
        )}
        <div className="space-y-3">
          {plan.stakeholders.map(s => (
            <div key={s.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
              <div className="flex gap-2">
                <input value={s.name} onChange={e => updateSH(s.id, { name: e.target.value })}
                  placeholder="Name" className={`${inputCls} flex-1`} />
                <button onClick={() => removeSH(s.id)} className="p-1.5 text-gray-400 hover:text-red-500 flex-shrink-0">
                  <Trash2 size={13} />
                </button>
              </div>
              <div>
                <label className={labelCls}>Roles / Titles</label>
                <RoleSelector
                  selected={s.roles}
                  onChange={roles => updateSH(s.id, { roles })}
                  allRoles={allRoles}
                  onAddRole={onAddRole}
                />
              </div>
              <input value={s.responsibility} onChange={e => updateSH(s.id, { responsibility: e.target.value })}
                placeholder="Responsibility / what they're accountable for" className={inputCls} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StepScope({ plan, update }: { plan: ProjectPlan; update: (p: Partial<ProjectPlan>) => void }) {
  return (
    <div className="space-y-5">
      <StringListEditor label="In Scope — What IS included in this project?"
        items={plan.inScope} onChange={inScope => update({ inScope })}
        placeholder="e.g. Redesign homepage and product pages" />
      <StringListEditor label="Out of Scope — What is explicitly NOT included?"
        items={plan.outOfScope.length ? plan.outOfScope : ['']}
        onChange={outOfScope => update({ outOfScope })}
        placeholder="e.g. Backend API changes" />
      <StringListEditor label="Assumptions — What are you assuming to be true?"
        items={plan.assumptions.length ? plan.assumptions : ['']}
        onChange={assumptions => update({ assumptions })}
        placeholder="e.g. Design assets will be provided by the client" />
      <StringListEditor label="Constraints — What limits or restrictions apply?"
        items={plan.constraints.length ? plan.constraints : ['']}
        onChange={constraints => update({ constraints })}
        placeholder="e.g. Budget capped at $50,000" />
    </div>
  )
}

function StepTimeline({ plan, update }: { plan: ProjectPlan; update: (p: Partial<ProjectPlan>) => void }) {
  const addMilestone = () => update({
    milestones: [...plan.milestones, { id: uid(), title: '', date: '', description: '' }],
  })
  const updateM = (id: string, partial: Partial<Milestone>) => update({
    milestones: plan.milestones.map(m => m.id === id ? { ...m, ...partial } : m),
  })
  const removeM = (id: string) => update({ milestones: plan.milestones.filter(m => m.id !== id) })

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">Define key milestones that mark major phases or deliverables.</p>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Milestones</span>
        <button onClick={addMilestone} className="flex items-center gap-1 text-xs text-accent-500 hover:text-accent-600">
          <Plus size={12} /> Add milestone
        </button>
      </div>
      {plan.milestones.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          <Clock size={28} className="opacity-30" />
          <p className="text-sm">No milestones yet.</p>
          <button onClick={addMilestone} className="text-xs text-accent-500 hover:text-accent-600">Add your first milestone</button>
        </div>
      )}
      <div className="space-y-3">
        {plan.milestones.map((m, i) => (
          <div key={m.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
            <div className="flex gap-2 items-center">
              <span className="text-xs font-semibold text-gray-400 w-5 flex-shrink-0">#{i + 1}</span>
              <input value={m.title} onChange={e => updateM(m.id, { title: e.target.value })}
                placeholder="Milestone name" className={`${inputCls} flex-1`} />
              <input type="date" value={m.date} onChange={e => updateM(m.id, { date: e.target.value })}
                className={`${inputCls} w-36 flex-shrink-0`} />
              <button onClick={() => removeM(m.id)} className="p-1.5 text-gray-400 hover:text-red-500 flex-shrink-0">
                <Trash2 size={13} />
              </button>
            </div>
            <input value={m.description} onChange={e => updateM(m.id, { description: e.target.value })}
              placeholder="Description / deliverable" className={inputCls} />
          </div>
        ))}
      </div>
    </div>
  )
}

function StepRisks({ plan, update }: { plan: ProjectPlan; update: (p: Partial<ProjectPlan>) => void }) {
  const addRisk = () => update({
    risks: [...plan.risks, { id: uid(), description: '', likelihood: 'medium', impact: 'medium', mitigation: '' }],
  })
  const updateR = (id: string, partial: Partial<Risk>) => update({
    risks: plan.risks.map(r => r.id === id ? { ...r, ...partial } : r),
  })
  const removeR = (id: string) => update({ risks: plan.risks.filter(r => r.id !== id) })

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">Identify potential risks early so you can plan mitigations.</p>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Risk Register</span>
        <button onClick={addRisk} className="flex items-center gap-1 text-xs text-accent-500 hover:text-accent-600">
          <Plus size={12} /> Add risk
        </button>
      </div>
      {plan.risks.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          <AlertTriangle size={28} className="opacity-30" />
          <p className="text-sm">No risks identified yet.</p>
          <button onClick={addRisk} className="text-xs text-accent-500 hover:text-accent-600">Add your first risk</button>
        </div>
      )}
      <div className="space-y-3">
        {plan.risks.map((r, i) => (
          <div key={r.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
            <div className="flex gap-2 items-start">
              <span className="text-xs font-semibold text-gray-400 w-5 flex-shrink-0 mt-2">#{i + 1}</span>
              <textarea value={r.description} onChange={e => updateR(r.id, { description: e.target.value })}
                placeholder="Describe the risk…" rows={2} className={`${inputCls} flex-1 resize-none`} />
              <button onClick={() => removeR(r.id)} className="p-1.5 text-gray-400 hover:text-red-500 flex-shrink-0">
                <Trash2 size={13} />
              </button>
            </div>
            <div className="flex gap-2 pl-7">
              <div className="flex-1">
                <label className={labelCls}>Likelihood</label>
                <select value={r.likelihood} onChange={e => updateR(r.id, { likelihood: e.target.value as Risk['likelihood'] })} className={inputCls}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="flex-1">
                <label className={labelCls}>Impact</label>
                <select value={r.impact} onChange={e => updateR(r.id, { impact: e.target.value as Risk['impact'] })} className={inputCls}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="pl-7">
              <label className={labelCls}>Mitigation Plan</label>
              <input value={r.mitigation} onChange={e => updateR(r.id, { mitigation: e.target.value })}
                placeholder="How will you reduce or respond to this risk?" className={inputCls} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StepResources({ plan, update }: { plan: ProjectPlan; update: (p: Partial<ProjectPlan>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <label className={labelCls}>Budget</label>
        <input value={plan.budget} onChange={e => update({ budget: e.target.value })}
          placeholder="e.g. $25,000 or TBD" className={inputCls} />
      </div>
      <StringListEditor label="Tools &amp; Technologies" items={plan.tools}
        onChange={tools => update({ tools })} placeholder="e.g. Figma, React, AWS" />
      <StringListEditor label="Dependencies — External things this project relies on"
        items={plan.dependencies.length ? plan.dependencies : ['']}
        onChange={dependencies => update({ dependencies })}
        placeholder="e.g. Third-party API access from vendor" />
    </div>
  )
}

function StepCommunication({ plan, update }: { plan: ProjectPlan; update: (p: Partial<ProjectPlan>) => void }) {
  return (
    <div className="space-y-5">
      <div>
        <label className={labelCls}>Meeting Cadence</label>
        <input value={plan.meetingCadence} onChange={e => update({ meetingCadence: e.target.value })}
          placeholder="e.g. Weekly standup every Monday at 9am" className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Reporting Frequency</label>
        <input value={plan.reportingFrequency} onChange={e => update({ reportingFrequency: e.target.value })}
          placeholder="e.g. Bi-weekly status report to stakeholders" className={inputCls} />
      </div>
      <StringListEditor label="Communication Channels" items={plan.communicationChannels}
        onChange={communicationChannels => update({ communicationChannels })}
        placeholder="e.g. Slack #project-updates, Email" />
    </div>
  )
}

function StepActions({ plan, update }: { plan: ProjectPlan; update: (p: Partial<ProjectPlan>) => void }) {
  const addAction = () => update({
    actionItems: [...plan.actionItems, { id: uid(), title: '', owner: '', dueDate: '', pushToGsd: true }],
  })
  const updateA = (id: string, partial: Partial<ActionItem>) => update({
    actionItems: plan.actionItems.map(a => a.id === id ? { ...a, ...partial } : a),
  })
  const removeA = (id: string) => update({ actionItems: plan.actionItems.filter(a => a.id !== id) })

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Define your immediate next actions. Items with "Sync to GSD" enabled will appear in Next Actions (if dated) or Inbox automatically.
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Next Actions</span>
        <button onClick={addAction} className="flex items-center gap-1 text-xs text-accent-500 hover:text-accent-600">
          <Plus size={12} /> Add action
        </button>
      </div>
      {plan.actionItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-gray-400 border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
          <Zap size={28} className="opacity-30" />
          <p className="text-sm">No actions defined yet.</p>
          <button onClick={addAction} className="text-xs text-accent-500 hover:text-accent-600">Add your first action</button>
        </div>
      )}
      <div className="space-y-3">
        {plan.actionItems.map((a, i) => (
          <div key={a.id} className="p-3 rounded-lg border border-gray-200 dark:border-gray-700 space-y-2">
            <div className="flex gap-2 items-center">
              <span className="text-xs font-semibold text-gray-400 w-5 flex-shrink-0">#{i + 1}</span>
              <input value={a.title} onChange={e => updateA(a.id, { title: e.target.value })}
                placeholder="Action title" className={`${inputCls} flex-1`} />
              <button onClick={() => removeA(a.id)} className="p-1.5 text-gray-400 hover:text-red-500 flex-shrink-0">
                <Trash2 size={13} />
              </button>
            </div>
            <div className="flex gap-2 pl-7">
              <input value={a.owner} onChange={e => updateA(a.id, { owner: e.target.value })}
                placeholder="Owner" className={`${inputCls} flex-1`} />
              <input type="date" value={a.dueDate} onChange={e => updateA(a.id, { dueDate: e.target.value })}
                className={`${inputCls} w-36 flex-shrink-0`} />
            </div>
            <div className="pl-7 flex items-center gap-2">
              <button onClick={() => updateA(a.id, { pushToGsd: !a.pushToGsd })}
                className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded border transition-colors ${
                  a.pushToGsd
                    ? 'border-accent-500 text-accent-500 bg-accent-50 dark:bg-accent-900/20'
                    : 'border-gray-300 dark:border-gray-600 text-gray-400'
                }`}>
                {a.pushToGsd ? <CheckCircle2 size={11} /> : <Circle size={11} />}
                Sync to GSD
              </button>
              {a.pushToGsd && (
                <span className="text-[10px] text-gray-400">
                  {a.dueDate ? '→ Next Actions' : '→ Inbox'}
                </span>
              )}
              {a.gsdItemId && (
                <span className="text-[10px] text-green-500 flex items-center gap-0.5">
                  <CheckCircle2 size={10} /> saved to GSD
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── PDF export ────────────────────────────────────────────────────────────────

function planToHtml(plan: ProjectPlan): string {
  const clean = (arr: string[]) => arr.filter(s => s.trim())
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const badge = (text: string, color: string) =>
    `<span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:${color};margin:1px 2px">${text}</span>`

  const riskColor = (level: string) =>
    level === 'high' ? '#fecaca' : level === 'medium' ? '#fde68a' : '#bbf7d0'

  let html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;color:#111;line-height:1.6;max-width:800px;margin:0 auto;padding:32px">
      <div style="border-bottom:3px solid #6366f1;padding-bottom:16px;margin-bottom:24px">
        <h1 style="margin:0 0 4px;font-size:26px;color:#1e1b4b">${plan.projectName || 'Project Plan'}</h1>
        <p style="margin:0;color:#6b7280;font-size:13px">Generated: ${today}</p>
      </div>
  `

  // Overview
  html += `<h2 style="font-size:18px;color:#312e81;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin-top:28px">Overview</h2>`
  if (plan.description) html += `<p style="color:#374151">${plan.description}</p>`
  if (plan.startDate || plan.endDate) {
    html += `<p><strong>Timeline:</strong> ${plan.startDate || 'TBD'} → ${plan.endDate || 'TBD'}</p>`
  }
  if (clean(plan.objectives).length) {
    html += `<h3 style="font-size:14px;color:#4338ca;margin-top:16px">Objectives</h3><ul style="margin:8px 0;padding-left:20px">`
    clean(plan.objectives).forEach(o => { html += `<li style="margin:4px 0">${o}</li>` })
    html += `</ul>`
  }
  if (clean(plan.successCriteria).length) {
    html += `<h3 style="font-size:14px;color:#4338ca;margin-top:16px">Success Criteria</h3><ul style="margin:8px 0;padding-left:20px">`
    clean(plan.successCriteria).forEach(s => { html += `<li style="margin:4px 0">${s}</li>` })
    html += `</ul>`
  }

  // Stakeholders
  if (plan.sponsor || plan.stakeholders.length) {
    html += `<h2 style="font-size:18px;color:#312e81;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin-top:28px">Stakeholders</h2>`
    if (plan.sponsor) html += `<p><strong>Sponsor:</strong> ${plan.sponsor}</p>`
    if (plan.stakeholders.length) {
      html += `<table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:13px">
        <thead><tr style="background:#f0f0ff">
          <th style="border:1px solid #d1d5db;padding:8px;text-align:left">Name</th>
          <th style="border:1px solid #d1d5db;padding:8px;text-align:left">Roles</th>
          <th style="border:1px solid #d1d5db;padding:8px;text-align:left">Responsibility</th>
        </tr></thead><tbody>`
      plan.stakeholders.forEach((s, i) => {
        const bg = i % 2 === 0 ? '#fff' : '#f9f9ff'
        html += `<tr style="background:${bg}">
          <td style="border:1px solid #d1d5db;padding:8px">${s.name}</td>
          <td style="border:1px solid #d1d5db;padding:8px">${s.roles.map(r => badge(r, '#e0e7ff')).join(' ')}</td>
          <td style="border:1px solid #d1d5db;padding:8px">${s.responsibility}</td>
        </tr>`
      })
      html += `</tbody></table>`
    }
  }

  // Scope
  const hasScope = clean(plan.inScope).length || clean(plan.outOfScope).length ||
    clean(plan.assumptions).length || clean(plan.constraints).length
  if (hasScope) {
    html += `<h2 style="font-size:18px;color:#312e81;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin-top:28px">Scope</h2>`
    const scopeSection = (title: string, items: string[], bulletColor: string) => {
      if (!items.length) return ''
      return `<h3 style="font-size:14px;color:#4338ca;margin-top:16px">${title}</h3><ul style="margin:8px 0;padding-left:20px">` +
        items.map(s => `<li style="margin:4px 0;color:#374151">${s}</li>`).join('') + `</ul>`
    }
    if (clean(plan.inScope).length) html += scopeSection('In Scope', clean(plan.inScope), '#6ee7b7')
    if (clean(plan.outOfScope).length) html += scopeSection('Out of Scope', clean(plan.outOfScope), '#fca5a5')
    if (clean(plan.assumptions).length) html += scopeSection('Assumptions', clean(plan.assumptions), '#fcd34d')
    if (clean(plan.constraints).length) html += scopeSection('Constraints', clean(plan.constraints), '#a5b4fc')
  }

  // Timeline
  if (plan.milestones.length) {
    html += `<h2 style="font-size:18px;color:#312e81;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin-top:28px">Timeline / Milestones</h2>`
    html += `<table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:13px">
      <thead><tr style="background:#f0f0ff">
        <th style="border:1px solid #d1d5db;padding:8px;text-align:left;width:30px">#</th>
        <th style="border:1px solid #d1d5db;padding:8px;text-align:left">Milestone</th>
        <th style="border:1px solid #d1d5db;padding:8px;text-align:left;width:110px">Date</th>
        <th style="border:1px solid #d1d5db;padding:8px;text-align:left">Description</th>
      </tr></thead><tbody>`
    plan.milestones.forEach((m, i) => {
      const bg = i % 2 === 0 ? '#fff' : '#f9f9ff'
      html += `<tr style="background:${bg}">
        <td style="border:1px solid #d1d5db;padding:8px;color:#6b7280">${i + 1}</td>
        <td style="border:1px solid #d1d5db;padding:8px;font-weight:600">${m.title}</td>
        <td style="border:1px solid #d1d5db;padding:8px;color:#4338ca">${m.date || '—'}</td>
        <td style="border:1px solid #d1d5db;padding:8px;color:#374151">${m.description}</td>
      </tr>`
    })
    html += `</tbody></table>`
  }

  // Risks
  if (plan.risks.length) {
    html += `<h2 style="font-size:18px;color:#312e81;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin-top:28px">Risk Register</h2>`
    html += `<table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:13px">
      <thead><tr style="background:#f0f0ff">
        <th style="border:1px solid #d1d5db;padding:8px;text-align:left;width:30px">#</th>
        <th style="border:1px solid #d1d5db;padding:8px;text-align:left">Risk</th>
        <th style="border:1px solid #d1d5db;padding:8px;text-align:left;width:90px">Likelihood</th>
        <th style="border:1px solid #d1d5db;padding:8px;text-align:left;width:80px">Impact</th>
        <th style="border:1px solid #d1d5db;padding:8px;text-align:left">Mitigation</th>
      </tr></thead><tbody>`
    plan.risks.forEach((r, i) => {
      const bg = i % 2 === 0 ? '#fff' : '#f9f9ff'
      html += `<tr style="background:${bg}">
        <td style="border:1px solid #d1d5db;padding:8px;color:#6b7280">${i + 1}</td>
        <td style="border:1px solid #d1d5db;padding:8px">${r.description}</td>
        <td style="border:1px solid #d1d5db;padding:8px">${badge(r.likelihood, riskColor(r.likelihood))}</td>
        <td style="border:1px solid #d1d5db;padding:8px">${badge(r.impact, riskColor(r.impact))}</td>
        <td style="border:1px solid #d1d5db;padding:8px;color:#374151">${r.mitigation}</td>
      </tr>`
    })
    html += `</tbody></table>`
  }

  // Resources
  const hasResources = plan.budget || clean(plan.tools).length || clean(plan.dependencies).length
  if (hasResources) {
    html += `<h2 style="font-size:18px;color:#312e81;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin-top:28px">Resources</h2>`
    if (plan.budget) html += `<p><strong>Budget:</strong> ${plan.budget}</p>`
    if (clean(plan.tools).length) {
      html += `<h3 style="font-size:14px;color:#4338ca;margin-top:16px">Tools &amp; Technologies</h3><ul style="margin:8px 0;padding-left:20px">`
      clean(plan.tools).forEach(t => { html += `<li style="margin:4px 0">${t}</li>` })
      html += `</ul>`
    }
    if (clean(plan.dependencies).length) {
      html += `<h3 style="font-size:14px;color:#4338ca;margin-top:16px">Dependencies</h3><ul style="margin:8px 0;padding-left:20px">`
      clean(plan.dependencies).forEach(d => { html += `<li style="margin:4px 0">${d}</li>` })
      html += `</ul>`
    }
  }

  // Communication
  const hasComms = plan.meetingCadence || plan.reportingFrequency || clean(plan.communicationChannels).length
  if (hasComms) {
    html += `<h2 style="font-size:18px;color:#312e81;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin-top:28px">Communication Plan</h2>`
    if (plan.meetingCadence) html += `<p><strong>Meeting Cadence:</strong> ${plan.meetingCadence}</p>`
    if (plan.reportingFrequency) html += `<p><strong>Reporting:</strong> ${plan.reportingFrequency}</p>`
    if (clean(plan.communicationChannels).length) {
      html += `<h3 style="font-size:14px;color:#4338ca;margin-top:16px">Channels</h3><ul style="margin:8px 0;padding-left:20px">`
      clean(plan.communicationChannels).forEach(c => { html += `<li style="margin:4px 0">${c}</li>` })
      html += `</ul>`
    }
  }

  // Actions
  const validActions = plan.actionItems.filter(a => a.title.trim())
  if (validActions.length) {
    html += `<h2 style="font-size:18px;color:#312e81;border-bottom:1px solid #e5e7eb;padding-bottom:6px;margin-top:28px">Next Actions</h2>`
    html += `<table style="width:100%;border-collapse:collapse;margin-top:12px;font-size:13px">
      <thead><tr style="background:#f0f0ff">
        <th style="border:1px solid #d1d5db;padding:8px;text-align:left">Action</th>
        <th style="border:1px solid #d1d5db;padding:8px;text-align:left;width:120px">Owner</th>
        <th style="border:1px solid #d1d5db;padding:8px;text-align:left;width:100px">Due</th>
        <th style="border:1px solid #d1d5db;padding:8px;text-align:left;width:60px">GSD</th>
      </tr></thead><tbody>`
    validActions.forEach((a, i) => {
      const bg = i % 2 === 0 ? '#fff' : '#f9f9ff'
      html += `<tr style="background:${bg}">
        <td style="border:1px solid #d1d5db;padding:8px">${a.title}</td>
        <td style="border:1px solid #d1d5db;padding:8px;color:#6b7280">${a.owner || '—'}</td>
        <td style="border:1px solid #d1d5db;padding:8px;color:#4338ca">${a.dueDate || '—'}</td>
        <td style="border:1px solid #d1d5db;padding:8px;text-align:center">${a.pushToGsd ? '✓' : ''}</td>
      </tr>`
    })
    html += `</tbody></table>`
  }

  html += `</div>`
  return html
}

async function exportPdf(plan: ProjectPlan) {
  const html2pdf = (await import('html2pdf.js')).default
  const container = document.createElement('div')
  container.innerHTML = planToHtml(plan)
  container.style.background = '#fff'

  const filename = `${(plan.projectName || 'project-plan').replace(/\s+/g, '-').toLowerCase()}-plan.pdf`

  await html2pdf()
    .set({
      margin: [10, 10, 10, 10],
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
    })
    .from(container)
    .save()
}

// ── Project picker ────────────────────────────────────────────────────────────

function ProjectPicker({ onSelect, onNew }: {
  onSelect: (plan: ProjectPlan) => void
  onNew: () => void
}) {
  const { projects, items } = useGsdStore()
  const active = projects.filter(p => p.status !== 'completed')
  const completed = projects.filter(p => p.status === 'completed')

  const STATUS_LABEL: Record<GsdProject['status'], string> = {
    active: 'Active', 'on-hold': 'On Hold', someday: 'Someday/Maybe', completed: 'Completed',
  }
  const STATUS_COLOR: Record<GsdProject['status'], string> = {
    active: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    'on-hold': 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    someday: 'bg-purple-100 dark:bg-purple-900/30 text-purple-500',
    completed: 'bg-gray-100 dark:bg-gray-700 text-gray-500',
  }
  const hasSavedPlan = (projectId: string) => {
    const all = loadPlans()
    return !!all[projectId]
  }
  const itemCount = (projectId: string) =>
    items.filter(i => i.projectId === projectId && i.status !== 'done').length

  const ProjectRow = ({ p }: { p: GsdProject }) => (
    <button
      onClick={() => onSelect(planFromGsdProject(p, items))}
      className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-accent-400 dark:hover:border-accent-500 hover:bg-gray-50 dark:hover:bg-surface-800 transition-colors text-left group"
    >
      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: p.color }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{p.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_COLOR[p.status]}`}>
            {STATUS_LABEL[p.status]}
          </span>
          <span className="text-[10px] text-gray-400">
            {itemCount(p.id)} open action{itemCount(p.id) !== 1 ? 's' : ''}
          </span>
          {hasSavedPlan(p.id) && (
            <span className="text-[10px] text-accent-500 font-medium">● has plan</span>
          )}
          {p.outcome && (
            <span className="text-[10px] text-gray-400 truncate">→ {p.outcome}</span>
          )}
        </div>
      </div>
      <span className="text-xs text-accent-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 flex-shrink-0">
        {hasSavedPlan(p.id) ? 'Resume' : 'Plan'} <ArrowRight size={12} />
      </span>
    </button>
  )

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-surface-900">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <FileText size={18} className="text-accent-500" />
        <div>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">Project Planner</h2>
          <p className="text-xs text-gray-400">Choose an existing project or start a new plan</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl space-y-6">
          {/* New plan */}
          <button onClick={onNew}
            className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-dashed border-accent-300 dark:border-accent-700 hover:border-accent-500 hover:bg-accent-50 dark:hover:bg-accent-900/10 transition-colors text-left group">
            <div className="w-10 h-10 rounded-lg bg-accent-100 dark:bg-accent-900/30 flex items-center justify-center flex-shrink-0">
              <Plus size={20} className="text-accent-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-accent-600 dark:text-accent-400">Start a new project plan</p>
              <p className="text-xs text-gray-400 mt-0.5">Walk through an 8-step guided planning wizard</p>
            </div>
            <ArrowRight size={16} className="ml-auto text-accent-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          {/* Existing projects */}
          {projects.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-3">
                Load from existing project
              </h3>
              {active.length > 0 && (
                <div className="space-y-2 mb-4">
                  {active.map(p => <ProjectRow key={p.id} p={p} />)}
                </div>
              )}
              {completed.length > 0 && (
                <details className="mt-2">
                  <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300 select-none">
                    Show {completed.length} completed project{completed.length !== 1 ? 's' : ''}
                  </summary>
                  <div className="space-y-2 mt-2 opacity-70">
                    {completed.map(p => <ProjectRow key={p.id} p={p} />)}
                  </div>
                </details>
              )}
            </div>
          )}

          {projects.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-gray-400">
              <FolderOpen size={32} className="opacity-20" />
              <p className="text-sm">No existing projects yet.</p>
              <p className="text-xs">Create projects in the Projects tab, or start a new plan above.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Step config ──────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'overview',      label: 'Overview',       icon: <Target size={15} />,        desc: 'Project name, goals and timeline' },
  { id: 'stakeholders',  label: 'Stakeholders',   icon: <Users size={15} />,          desc: 'Who is involved and responsible' },
  { id: 'scope',         label: 'Scope',          icon: <Layers size={15} />,         desc: 'In scope, out of scope, assumptions' },
  { id: 'timeline',      label: 'Timeline',       icon: <Clock size={15} />,          desc: 'Key milestones and dates' },
  { id: 'risks',         label: 'Risks',          icon: <AlertTriangle size={15} />,  desc: 'Risk register and mitigations' },
  { id: 'resources',     label: 'Resources',      icon: <DollarSign size={15} />,     desc: 'Budget, tools and dependencies' },
  { id: 'communication', label: 'Communication',  icon: <MessageSquare size={15} />,  desc: 'Meeting cadence and channels' },
  { id: 'actions',       label: 'Next Actions',   icon: <Zap size={15} />,            desc: 'Immediate next steps' },
]

// ── Main component ────────────────────────────────────────────────────────────

export default function ProjectPlanner() {
  const [activePlan, setActivePlan] = useState<ProjectPlan | null>(null)
  const [stepIdx, setStepIdx] = useState(0)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [allRoles, setAllRoles] = useState<string[]>(loadRoles)
  // Track whether a background GSD sync is pending
  const [syncing, setSyncing] = useState(false)
  // Keep a ref to the latest plan so the unmount effect can read it
  const activePlanRef = useRef<ProjectPlan | null>(null)
  activePlanRef.current = activePlan

  // Vault write debounce
  const vaultWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { rootHandle, fallbackMode, saveNote, readNote } = useVaultStore()
  const hasVault = !!(rootHandle || fallbackMode)
  const { scheduleWrite } = useGsdVaultSync()

  const plan = activePlan!

  // ── Sync helper (uses latest store state snapshot) ──────────────────────────
  const doSync = useCallback((planToSync: ProjectPlan) => {
    if (!planToSync.projectName.trim()) return planToSync
    const store = useGsdStore.getState()
    const synced = syncPlanToGsd(planToSync, store)
    // Trigger vault write for GSD data after syncing
    scheduleWrite()
    // Reflect any gsdItemId changes back into React state
    setActivePlan(prev => {
      if (!prev || prev.gsdProjectId === synced.gsdProjectId &&
          JSON.stringify(prev.actionItems) === JSON.stringify(synced.actionItems)) return prev
      return synced
    })
    return synced
  }, [scheduleWrite])

  // ── Vault write helper (600ms debounce) ──────────────────────────────────────
  const schedulePlanVaultWrite = useCallback((p: ProjectPlan) => {
    if (!hasVault || !p.projectName.trim()) return
    if (vaultWriteTimerRef.current) clearTimeout(vaultWriteTimerRef.current)
    vaultWriteTimerRef.current = setTimeout(() => {
      const slug = slugifyPlanName(p.projectName, p.gsdProjectId)
      saveNote(`gsd/plans/${slug}.md`, buildPlanMarkdown(p)).catch(console.error)
    }, 600)
  }, [hasVault, saveNote])

  // ── Debounced sync on actionItems / projectName / description changes ────────
  // Serialize to string so the effect fires when values inside the array change,
  // not just when the array reference changes.
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const actionItemsKey = activePlan
    ? JSON.stringify(activePlan.actionItems.map(a => ({ t: a.title, d: a.dueDate, p: a.pushToGsd })))
    : ''
  useEffect(() => {
    if (!activePlan) return
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => {
      setSyncing(true)
      doSync(activePlan)
      setSyncing(false)
    }, 800)
    return () => { if (syncTimerRef.current) clearTimeout(syncTimerRef.current) }
  }, [actionItemsKey, activePlan?.projectName, activePlan?.description])  // eslint-disable-line

  // ── Sync on unmount (tab switch / navigation away) ──────────────────────────
  useEffect(() => {
    return () => {
      if (vaultWriteTimerRef.current) clearTimeout(vaultWriteTimerRef.current)
      const current = activePlanRef.current
      if (current?.projectName.trim()) {
        doSync(current)
      }
    }
  }, [doSync])

  const update = useCallback((partial: Partial<ProjectPlan>) => {
    setActivePlan(prev => {
      if (!prev) return prev
      const next = { ...prev, ...partial }
      savePlanToStorage(next)
      schedulePlanVaultWrite(next)
      return next
    })
    setSaved(false)
  }, [schedulePlanVaultWrite])

  const handleAddRole = useCallback((role: string) => {
    setAllRoles(prev => {
      if (prev.includes(role)) return prev
      const next = [...prev, role]
      saveRoles(next)
      return next
    })
  }, [])

  const openPlan = (p: ProjectPlan) => {
    setActivePlan(p)
    setStepIdx(0)
    setSaved(false)
    setSaveError(null)
  }

  const backToPicker = () => {
    // Sync before leaving
    if (activePlan?.projectName.trim()) doSync(activePlan)
    setActivePlan(null)
    setSaved(false)
    setSaveError(null)
  }

  const step = STEPS[stepIdx]

  const handleSave = async () => {
    if (!plan.projectName.trim()) {
      setSaveError('Please enter a project name before saving.')
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      // Ensure latest sync before exporting
      doSync(plan)
      // Write to vault if open
      if (hasVault) {
        const slug = slugifyPlanName(plan.projectName, plan.gsdProjectId)
        await saveNote(`gsd/plans/${slug}.md`, buildPlanMarkdown(plan))
      }
      // Export PDF
      await exportPdf(plan)
      setSaved(true)
    } catch (err) {
      setSaveError('Export failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  // Try to load a plan from vault first
  const handleSelectProject = useCallback(async (p: ProjectPlan) => {
    if (hasVault && p.projectName.trim()) {
      try {
        const slug = slugifyPlanName(p.projectName, p.gsdProjectId)
        const raw = await readNote(`gsd/plans/${slug}.md`)
        const match = raw.match(/```json\n([\s\S]*?)\n```\s*$/)
        if (match) {
          openPlan(JSON.parse(match[1]) as ProjectPlan)
          return
        }
      } catch {
        // Fall through to localStorage plan
      }
    }
    openPlan(p)
  }, [hasVault, readNote])

  if (!activePlan) {
    return <ProjectPicker onSelect={handleSelectProject} onNew={() => {
      const saved = loadPlanFromStorage(null)
      openPlan(saved ?? emptyPlan())
    }} />
  }

  const completedSteps = STEPS.map((_, i) => {
    const p = plan
    if (i === 0) return !!(p.projectName.trim())
    if (i === 1) return !!(p.sponsor || p.stakeholders.length)
    if (i === 2) return p.inScope.some(s => s.trim())
    if (i === 3) return p.milestones.length > 0
    if (i === 4) return p.risks.length > 0
    if (i === 5) return !!(p.budget || p.tools.some(t => t.trim()))
    if (i === 6) return !!(p.meetingCadence || p.reportingFrequency)
    if (i === 7) return p.actionItems.length > 0
    return false
  })

  return (
    <div className="flex-1 flex overflow-hidden bg-white dark:bg-surface-900">
      {/* Left step nav */}
      <div className="w-52 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-surface-800 overflow-y-auto">
        <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-accent-500" />
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Project Planner</span>
          </div>
          {plan.projectName && (
            <div className="flex items-center gap-1 mt-1">
              {plan.gsdProjectId && <FolderOpen size={10} className="text-gray-400 flex-shrink-0" />}
              <p className="text-xs text-gray-400 truncate flex-1">{plan.projectName}</p>
            </div>
          )}
          <button onClick={backToPicker}
            className="mt-2 flex items-center gap-1 text-[11px] text-accent-500 hover:text-accent-600">
            <ChevronLeft size={11} /> Change project
          </button>
        </div>
        <nav className="flex-1 p-2">
          {STEPS.map((s, i) => (
            <button key={s.id} onClick={() => setStepIdx(i)}
              className={`w-full flex items-start gap-2.5 px-3 py-2.5 rounded-lg mb-0.5 text-left transition-colors ${
                stepIdx === i
                  ? 'bg-accent-50 dark:bg-accent-900/20 text-accent-600 dark:text-accent-400'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-700'
              }`}>
              <div className={`mt-0.5 flex-shrink-0 ${stepIdx === i ? 'text-accent-500' : completedSteps[i] ? 'text-green-500' : 'text-gray-400'}`}>
                {completedSteps[i] && stepIdx !== i ? <CheckCircle2 size={15} /> : s.icon}
              </div>
              <div>
                <p className={`text-xs font-medium leading-tight ${stepIdx === i ? 'text-accent-600 dark:text-accent-400' : ''}`}>{s.label}</p>
                <p className="text-[10px] text-gray-400 leading-tight mt-0.5 hidden sm:block">{s.desc}</p>
              </div>
            </button>
          ))}
        </nav>
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <div className="text-[10px] text-gray-400 mb-2 text-center">
            {completedSteps.filter(Boolean).length} / {STEPS.length} sections filled
          </div>
          <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-accent-500 rounded-full transition-all"
              style={{ width: `${(completedSteps.filter(Boolean).length / STEPS.length) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <div className="text-accent-500">{step.icon}</div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{step.label}</h2>
            <p className="text-xs text-gray-400">{step.desc}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {syncing && (
              <span className="text-[11px] text-gray-400 flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" /> Syncing…
              </span>
            )}
            {!syncing && plan.gsdProjectId && (
              <span className="text-[11px] text-green-500 flex items-center gap-1">
                <CheckCircle2 size={11} /> GSD synced
              </span>
            )}
            {saveError && <span className="text-xs text-red-500">{saveError}</span>}
            {saved && (
              <span className="text-xs text-green-500 flex items-center gap-1">
                <CheckCircle2 size={12} /> Exported
              </span>
            )}
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-500 text-white rounded hover:bg-accent-600 text-xs font-medium disabled:opacity-60">
              <Download size={12} />
              {saving ? 'Exporting…' : 'Export PDF'}
            </button>
          </div>
        </div>

        {/* Step body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="max-w-2xl">
            {stepIdx === 0 && <StepOverview plan={plan} update={update} />}
            {stepIdx === 1 && <StepStakeholders plan={plan} update={update} allRoles={allRoles} onAddRole={handleAddRole} />}
            {stepIdx === 2 && <StepScope plan={plan} update={update} />}
            {stepIdx === 3 && <StepTimeline plan={plan} update={update} />}
            {stepIdx === 4 && <StepRisks plan={plan} update={update} />}
            {stepIdx === 5 && <StepResources plan={plan} update={update} />}
            {stepIdx === 6 && <StepCommunication plan={plan} update={update} />}
            {stepIdx === 7 && <StepActions plan={plan} update={update} />}
          </div>
        </div>

        {/* Footer nav */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gray-50 dark:bg-surface-800">
          <button onClick={() => setStepIdx(i => Math.max(0, i - 1))} disabled={stepIdx === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded hover:bg-gray-100 dark:hover:bg-surface-700 text-sm disabled:opacity-40">
            <ChevronLeft size={14} /> Previous
          </button>
          <span className="text-xs text-gray-400">{stepIdx + 1} of {STEPS.length}</span>
          {stepIdx < STEPS.length - 1 ? (
            <button onClick={() => setStepIdx(i => Math.min(STEPS.length - 1, i + 1))}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-500 text-white rounded hover:bg-accent-600 text-sm">
              Next <ChevronRight size={14} />
            </button>
          ) : (
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 text-white rounded hover:bg-green-600 text-sm font-medium disabled:opacity-60">
              <Save size={13} />
              {saving ? 'Exporting…' : 'Finish & Export PDF'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
