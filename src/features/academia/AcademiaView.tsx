import React, { useState, useCallback, useEffect } from 'react'
import { GraduationCap, LayoutDashboard, List, CalendarDays, Plus, Save, FolderOpen, Check, AlertCircle, Loader2 } from 'lucide-react'
import { useAcademiaStore } from './academiaStore'
import { useVaultStore } from '../../stores/vaultStore'
import { getFileHandle, writeFile } from '../../lib/fs/fileSystemApi'
import AcademiaDashboard from './AcademiaDashboard'
import ActivityList from './ActivityList'
import YearManager from './YearManager'
import ActivityForm from './ActivityForm'
import type { AcademicCategory, AcademicActivity, AcademicYear } from './types'
import { CATEGORY_META, STATUS_META, TEACHING_TYPES, RESEARCH_TYPES, SERVICE_TYPES } from './types'

const VAULT_JSON = 'academia/data.json'

type SyncStatus = 'idle' | 'saving' | 'saved' | 'loading' | 'error'
type Tab = 'dashboard' | 'activities' | 'years'

function typeLabel(type: string | null): string {
  if (!type) return ''
  const all = [...TEACHING_TYPES, ...RESEARCH_TYPES, ...SERVICE_TYPES]
  return all.find(t => t.value === type)?.label ?? type
}

function buildMarkdown(year: AcademicYear, activities: AcademicActivity[]): string {
  const cats: AcademicCategory[] = ['teaching', 'research', 'service']
  const lines: string[] = [
    `---`,
    `title: "Academic Activities ${year.label}"`,
    `type: academia`,
    `academic_year: "${year.label}"`,
    `start: "${year.startDate}"`,
    `end: "${year.endDate}"`,
    `---`,
    ``,
    `# Academic Activities — ${year.label}`,
    ``,
    `**Period:** ${year.startDate} → ${year.endDate}`,
    ``,
  ]

  for (const cat of cats) {
    const meta = CATEGORY_META[cat]
    const acts = activities.filter(a => a.category === cat)
    lines.push(`## ${meta.label}`, '')
    if (acts.length === 0) {
      lines.push('_No activities recorded._', '')
      continue
    }
    for (const act of acts.sort((a, b) => a.date.localeCompare(b.date))) {
      const statusMeta = STATUS_META[act.status]
      lines.push(`### ${act.title}`)
      lines.push('')
      lines.push(`- **Date:** ${act.date}`)
      lines.push(`- **Status:** ${statusMeta.label}`)
      if (act.type) lines.push(`- **Type:** ${typeLabel(act.type)}`)
      if (act.tags.length > 0) lines.push(`- **Tags:** ${act.tags.join(', ')}`)
      if (act.description) {
        lines.push('')
        lines.push(act.description)
      }
      lines.push('')
    }
  }

  return lines.join('\n')
}

export default function AcademiaView() {
  const { years, activities } = useAcademiaStore()
  const { rootHandle } = useVaultStore()
  const hasVault = !!rootHandle

  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [showAddForm, setShowAddForm] = useState(false)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [syncMsg, setSyncMsg] = useState('')

  // For drill-down from dashboard
  const [drillYearId, setDrillYearId] = useState<string | undefined>()
  const [drillCat, setDrillCat] = useState<AcademicCategory | undefined>()

  // Load from vault on mount
  useEffect(() => {
    if (!rootHandle) return
    loadFromVault()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootHandle])

  const loadFromVault = useCallback(async () => {
    if (!rootHandle) return
    setSyncStatus('loading')
    setSyncMsg('')
    try {
      const handle = await getFileHandle(rootHandle, VAULT_JSON, false)
      const file = await handle.getFile()
      const text = await file.text()
      const data = JSON.parse(text)
      useAcademiaStore.setState({
        years: data.years ?? [],
        activities: data.activities ?? [],
      })
      localStorage.setItem('academia_data_v1', JSON.stringify({
        years: data.years ?? [],
        activities: data.activities ?? [],
      }))
      setSyncStatus('saved')
      setSyncMsg(`Loaded ${data.activities?.length ?? 0} activities from vault`)
      setTimeout(() => setSyncStatus('idle'), 3000)
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'NotFoundError') {
        setSyncStatus('idle')
      } else {
        setSyncStatus('error')
        setSyncMsg(e instanceof Error ? e.message : 'Failed to load from vault')
        setTimeout(() => setSyncStatus('idle'), 4000)
      }
    }
  }, [rootHandle])

  const saveToVault = useCallback(async () => {
    if (!rootHandle) return
    setSyncStatus('saving')
    setSyncMsg('')
    try {
      // Write JSON backup for round-trip loading
      const jsonHandle = await getFileHandle(rootHandle, VAULT_JSON, true)
      await writeFile(jsonHandle, JSON.stringify({ years, activities, savedAt: new Date().toISOString() }, null, 2))

      // Write one markdown file per academic year
      for (const year of years) {
        const yearActs = activities.filter(a => a.yearId === year.id)
        const md = buildMarkdown(year, yearActs)
        const safeName = year.label.replace(/[^a-zA-Z0-9-_]/g, '-')
        const mdHandle = await getFileHandle(rootHandle, `academia/${safeName}.md`, true)
        await writeFile(mdHandle, md)
      }

      setSyncStatus('saved')
      setSyncMsg(`Saved ${activities.length} activities across ${years.length} year${years.length !== 1 ? 's' : ''}`)
      setTimeout(() => setSyncStatus('idle'), 3000)
    } catch (e: unknown) {
      setSyncStatus('error')
      setSyncMsg(e instanceof Error ? e.message : 'Failed to save to vault')
      setTimeout(() => setSyncStatus('idle'), 4000)
    }
  }, [rootHandle, years, activities])

  const handleDashboardDrill = (yearId: string, cat?: AcademicCategory) => {
    setDrillYearId(yearId)
    setDrillCat(cat)
    setActiveTab('activities')
  }

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
    if (tab !== 'activities') {
      setDrillYearId(undefined)
      setDrillCat(undefined)
    }
  }

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard',   label: 'Dashboard',    icon: <LayoutDashboard size={14} /> },
    { id: 'activities',  label: 'Activities',   icon: <List size={14} /> },
    { id: 'years',       label: 'Manage Years', icon: <CalendarDays size={14} /> },
  ]

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-surface-900">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <GraduationCap size={20} className="text-accent-500" />
        <div>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Teaching, Research & Service</h1>
          {years.length > 0 && (
            <p className="text-xs text-gray-400">{years.length} academic year{years.length !== 1 ? 's' : ''} tracked</p>
          )}
        </div>

        {/* Sync status */}
        <div className="flex items-center gap-1.5 text-xs ml-2">
          {syncStatus === 'saving' && (
            <span className="flex items-center gap-1 text-gray-400"><Loader2 size={12} className="animate-spin" /> Saving…</span>
          )}
          {syncStatus === 'loading' && (
            <span className="flex items-center gap-1 text-gray-400"><Loader2 size={12} className="animate-spin" /> Loading…</span>
          )}
          {syncStatus === 'saved' && (
            <span className="flex items-center gap-1 text-green-500"><Check size={12} /> {syncMsg}</span>
          )}
          {syncStatus === 'error' && (
            <span className="flex items-center gap-1 text-red-400" title={syncMsg}><AlertCircle size={12} /> {syncMsg}</span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Vault sync buttons */}
          {hasVault ? (
            <>
              <button
                onClick={loadFromVault}
                disabled={syncStatus === 'saving' || syncStatus === 'loading'}
                title="Load academia data from vault"
                className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-surface-800 disabled:opacity-40 transition-colors"
              >
                <FolderOpen size={13} /> Load
              </button>
              <button
                onClick={saveToVault}
                disabled={syncStatus === 'saving' || syncStatus === 'loading'}
                title="Save all activities to vault"
                className="flex items-center gap-1.5 px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-surface-800 disabled:opacity-40 transition-colors"
              >
                <Save size={13} /> Save to Vault
              </button>
            </>
          ) : (
            <span className="text-[11px] text-gray-400 italic">Open a vault to enable saving</span>
          )}
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-500 text-white rounded hover:bg-accent-600 text-sm"
          >
            <Plus size={14} /> Add Activity
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center px-4 gap-0.5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs border-b-2 whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'border-accent-500 text-accent-500 font-medium'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'dashboard' && (
        <AcademiaDashboard onNavigate={handleDashboardDrill} />
      )}
      {activeTab === 'activities' && (
        <ActivityList key={`${drillYearId}-${drillCat}`} initialYearId={drillYearId} initialCategory={drillCat} />
      )}
      {activeTab === 'years' && (
        <YearManager />
      )}

      {showAddForm && (
        <ActivityForm onClose={() => setShowAddForm(false)} />
      )}
    </div>
  )
}
