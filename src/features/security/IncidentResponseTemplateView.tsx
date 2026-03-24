import React, { useState, useEffect } from 'react'
import { AlertCircle, HelpCircle, X, Plus, Trash2, ChevronDown, ChevronRight, Download, Calendar } from 'lucide-react'
import { useVaultStore } from '../../stores/vaultStore'
import { DateTimePickerModal } from '../../components/DateTimePickerModal'

// ─── Types ──────────────────────────────────────────────────────────────────

type SectionId =
  | 'incident-details'
  | 'toc'
  | 'executive-summary'
  | 'timeline'
  | 'affected-systems'
  | 'impact-assessment'
  | 'detection-analysis'
  | 'containment'
  | 'eradication'
  | 'recovery'
  | 'post-incident'
  | 'appendices'

type SectionEnabled = Record<SectionId, boolean>
type Severity = 'Critical' | 'High' | 'Medium' | 'Low'

interface IncidentDetailsData {
  incidentId: string
  incidentDate: string
  severity: Severity
  incidentType: string
  discoveredBy: string
  reportedBy: string
  organizationName: string
}

interface ExecutiveSummaryData {
  summary: string
  businessImpact: string
  recommendedActions: string
}

interface TimelineEvent {
  id: string
  timestamp: string
  description: string
  source: string
}

interface TimelineData {
  events: TimelineEvent[]
}

interface AffectedSystem {
  id: string
  hostname: string
  ipAddress: string
  systemType: string
  criticality: 'Critical' | 'High' | 'Medium' | 'Low'
  services: string
}

interface AffectedSystemsData {
  systems: AffectedSystem[]
  userAccountsAffected: string
  dataExposed: string
}

interface ImpactAssessmentData {
  confidentialityImpact: string
  integrityImpact: string
  availabilityImpact: string
  financialImpact: string
  reputationalImpact: string
}

interface DetectionAnalysisData {
  detectionMethod: string
  detectionDate: string
  detectionSource: string
  analysisFindings: string
  indicatorsOfCompromise: string
}

interface ContainmentData {
  shortTermSteps: string
  longTermSteps: string
  systemsIsolated: string
  accessesRevoked: string
}

interface EradicationData {
  removalSteps: string
  vulnerabilitiesPatched: string
  credentialsReset: string
  malwareRemoved: string
}

interface RecoveryData {
  restorationApproach: string
  systemsRestored: string
  dataRestored: string
  servicesReopened: string
  verificationSteps: string
}

interface PostIncidentAction {
  id: string
  action: string
  owner: string
  dueDate: string
  status: 'Open' | 'In Progress' | 'Closed'
}

interface PostIncidentData {
  lessonsLearned: string
  improvementsNeeded: string
  actions: PostIncidentAction[]
}

interface AppendixIOC {
  id: string
  type: string
  value: string
  description: string
}

interface AppendicesData {
  iocs: AppendixIOC[]
  toolsUsed: string
  references: string
}

interface IncidentResponseData {
  incidentDetails: IncidentDetailsData
  executiveSummary: ExecutiveSummaryData
  timeline: TimelineData
  affectedSystems: AffectedSystemsData
  impactAssessment: ImpactAssessmentData
  detectionAnalysis: DetectionAnalysisData
  containment: ContainmentData
  eradication: EradicationData
  recovery: RecoveryData
  postIncident: PostIncidentData
  appendices: AppendicesData
}

// ─── Default State ──────────────────────────────────────────────────────────

const today = new Date().toISOString().split('T')[0]

const DEFAULT_INCIDENT_RESPONSE_DATA: IncidentResponseData = {
  incidentDetails: {
    incidentId: '',
    incidentDate: today,
    severity: 'High',
    incidentType: '',
    discoveredBy: '',
    reportedBy: '',
    organizationName: ''
  },
  executiveSummary: {
    summary: '',
    businessImpact: '',
    recommendedActions: ''
  },
  timeline: {
    events: []
  },
  affectedSystems: {
    systems: [],
    userAccountsAffected: '',
    dataExposed: ''
  },
  impactAssessment: {
    confidentialityImpact: '',
    integrityImpact: '',
    availabilityImpact: '',
    financialImpact: '',
    reputationalImpact: ''
  },
  detectionAnalysis: {
    detectionMethod: '',
    detectionDate: today,
    detectionSource: '',
    analysisFindings: '',
    indicatorsOfCompromise: ''
  },
  containment: {
    shortTermSteps: '',
    longTermSteps: '',
    systemsIsolated: '',
    accessesRevoked: ''
  },
  eradication: {
    removalSteps: '',
    vulnerabilitiesPatched: '',
    credentialsReset: '',
    malwareRemoved: ''
  },
  recovery: {
    restorationApproach: '',
    systemsRestored: '',
    dataRestored: '',
    servicesReopened: '',
    verificationSteps: ''
  },
  postIncident: {
    lessonsLearned: '',
    improvementsNeeded: '',
    actions: []
  },
  appendices: {
    iocs: [],
    toolsUsed: '',
    references: ''
  }
}

const DEFAULT_SECTIONS_ENABLED: SectionEnabled = {
  'incident-details': true,
  'toc': true,
  'executive-summary': true,
  'timeline': true,
  'affected-systems': true,
  'impact-assessment': true,
  'detection-analysis': true,
  'containment': true,
  'eradication': true,
  'recovery': true,
  'post-incident': true,
  'appendices': true
}

// ─── Constants ──────────────────────────────────────────────────────────────

const SECTIONS_META: Array<{ id: SectionId; label: string; icon: string; description: string }> = [
  { id: 'incident-details', label: 'Incident Details', icon: '🆔', description: 'Basic incident information and identifiers.' },
  { id: 'toc', label: 'Table of Contents', icon: '📑', description: 'Auto-generated from enabled sections.' },
  { id: 'executive-summary', label: 'Executive Summary', icon: '📊', description: 'High-level overview of the incident and impact.' },
  { id: 'timeline', label: 'Timeline', icon: '⏱️', description: 'Chronological sequence of events.' },
  { id: 'affected-systems', label: 'Affected Systems', icon: '💻', description: 'Systems, users, and data impacted by the incident.' },
  { id: 'impact-assessment', label: 'Impact Assessment', icon: '📈', description: 'Analysis of confidentiality, integrity, and availability impact.' },
  { id: 'detection-analysis', label: 'Detection & Analysis', icon: '🔍', description: 'How the incident was detected and analyzed.' },
  { id: 'containment', label: 'Containment', icon: '🛑', description: 'Steps taken to stop the incident.' },
  { id: 'eradication', label: 'Eradication', icon: '🧹', description: 'Removal of attacker presence and tools.' },
  { id: 'recovery', label: 'Recovery', icon: '🔧', description: 'Restoration of systems and services.' },
  { id: 'post-incident', label: 'Post-Incident', icon: '📋', description: 'Lessons learned and improvement actions.' },
  { id: 'appendices', label: 'Appendices', icon: '📎', description: 'IOCs, tools used, and references.' }
]

const HELP_CONTENT: Array<{ id: string; icon: string; label: string; purpose: string; tips: string[] }> = [
  {
    id: 'incident-details',
    icon: '🆔',
    label: 'Incident Details',
    purpose: 'Identifies the incident uniquely and establishes severity level.',
    tips: [
      'Use a consistent incident ID format (e.g., INC-2026-001).',
      'Severity should reflect business impact, not just technical severity.',
      'Incident type helps with classification: malware, data breach, DDoS, insider threat, etc.'
    ]
  },
  {
    id: 'executive-summary',
    icon: '📊',
    label: 'Executive Summary',
    purpose: 'Provides decision-makers with essential information in minimal time.',
    tips: [
      'Keep to 1-2 paragraphs for executives.',
      'Lead with the what, when, and so-what.',
      'Business impact matters more than technical details.',
      'Include recommended next steps.'
    ]
  },
  {
    id: 'timeline',
    icon: '⏱️',
    label: 'Timeline',
    purpose: 'Establishes chronological sequence of events for forensic analysis.',
    tips: [
      'Use precise timestamps where possible.',
      'Include both detection events and retrospective findings.',
      'Cite sources for each event (logs, witness accounts, forensics).',
      'Distinguish between confirmed and suspected events.'
    ]
  },
  {
    id: 'affected-systems',
    icon: '💻',
    label: 'Affected Systems',
    purpose: 'Documents scope of compromise for remediation planning.',
    tips: [
      'List all directly compromised systems.',
      'Include systems used for lateral movement.',
      'Identify accounts with suspicious activity.',
      'Specify what data was exposed or accessed.'
    ]
  },
  {
    id: 'impact-assessment',
    icon: '📈',
    label: 'Impact Assessment',
    purpose: 'Quantifies the incident\'s effect on business operations and assets.',
    tips: [
      'Confidentiality: what secrets were exposed or at risk?',
      'Integrity: what data or systems were modified?',
      'Availability: which services were disrupted?',
      'Include financial estimates if possible.'
    ]
  },
  {
    id: 'detection-analysis',
    icon: '🔍',
    label: 'Detection & Analysis',
    purpose: 'Documents discovery process and technical analysis.',
    tips: [
      'Credit the person or system that detected it.',
      'Explain what triggered detection (alert, report, scan, etc.).',
      'List IOCs discovered during analysis.',
      'Reference forensic tools and methodologies used.'
    ]
  },
  {
    id: 'containment',
    icon: '🛑',
    label: 'Containment',
    purpose: 'Describes measures taken to halt further damage.',
    tips: [
      'Short-term containment: immediate actions to stop spread (disable accounts, isolate systems).',
      'Long-term containment: preventing re-infection (patch systems, change passwords).',
      'Document what was disconnected, when, and by whom.',
      'Note any access that had to be revoked.'
    ]
  },
  {
    id: 'eradication',
    icon: '🧹',
    label: 'Eradication',
    purpose: 'Removes attacker presence and closes exploited vulnerabilities.',
    tips: [
      'Remove all malware, backdoors, and attacker tools.',
      'Patch or remediate the vulnerabilities that were exploited.',
      'Reset credentials for compromised accounts.',
      'Rebuild systems if necessary (format and reinstall).'
    ]
  },
  {
    id: 'recovery',
    icon: '🔧',
    label: 'Recovery',
    purpose: 'Restores systems and data to normal operations.',
    tips: [
      'Restore from clean backups, not from compromised systems.',
      'Verify data integrity during restoration.',
      'Bring systems online in appropriate order (dependencies matter).',
      'Conduct post-restoration testing and monitoring.'
    ]
  },
  {
    id: 'post-incident',
    icon: '📋',
    label: 'Post-Incident',
    purpose: 'Drives improvement and prevents recurrence.',
    tips: [
      'Hold a post-incident review within 1-2 weeks.',
      'Identify what went well and what didn\'t.',
      'Create specific, measurable actions to prevent recurrence.',
      'Assign owners and due dates to all actions.'
    ]
  },
  {
    id: 'appendices',
    icon: '📎',
    label: 'Appendices',
    purpose: 'Provides supporting technical details without cluttering the main report.',
    tips: [
      'IOCs (Indicators of Compromise): hashes, IPs, domains, URLs.',
      'List all tools used during investigation.',
      'Reference relevant security frameworks and standards.',
      'Include links to relevant CVEs or threat intelligence.'
    ]
  }
]

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateMarkdownWithJSON(data: IncidentResponseData, enabled: SectionEnabled): string {
  const parts: string[] = []

  // Frontmatter
  parts.push(
    [
      '---',
      `title: "Incident Response Report - ${data.incidentDetails.incidentId}"`,
      `incident_id: "${data.incidentDetails.incidentId}"`,
      `severity: ${data.incidentDetails.severity}`,
      `incident_date: ${data.incidentDetails.incidentDate}`,
      `organization: "${data.incidentDetails.organizationName}"`,
      `generated: ${today}`,
      '---',
      ''
    ].join('\n')
  )

  // Incident Details
  if (enabled['incident-details']) {
    parts.push(
      [
        '# Incident Response Report',
        '',
        `**Incident ID:** ${data.incidentDetails.incidentId}  `,
        `**Date:** ${data.incidentDetails.incidentDate}  `,
        `**Severity:** ${data.incidentDetails.severity}  `,
        `**Type:** ${data.incidentDetails.incidentType}  `,
        `**Organization:** ${data.incidentDetails.organizationName}  `,
        `**Discovered By:** ${data.incidentDetails.discoveredBy}  `,
        `**Reported By:** ${data.incidentDetails.reportedBy}  `,
        ''
      ].join('\n')
    )
  }

  // Table of Contents
  if (enabled['toc']) {
    parts.push('## Table of Contents\n')
    const tocItems = SECTIONS_META
      .filter(s => s.id !== 'toc' && enabled[s.id])
      .map((s, i) => `${i + 1}. [${s.label}](#${s.label.toLowerCase().replace(/\s+/g, '-').replace(/[&/]/g, '')})`)
    parts.push(tocItems.join('\n') + '\n')
  }

  // Executive Summary
  if (enabled['executive-summary']) {
    parts.push(
      [
        '## Executive Summary',
        '',
        '### Incident Summary',
        '',
        data.executiveSummary.summary,
        '',
        '### Business Impact',
        '',
        data.executiveSummary.businessImpact,
        '',
        '### Recommended Actions',
        '',
        data.executiveSummary.recommendedActions,
        ''
      ].join('\n')
    )
  }

  // Timeline
  if (enabled['timeline'] && data.timeline.events.length > 0) {
    parts.push('## Timeline\n')
    parts.push('| Date/Time | Description | Source |\n')
    parts.push('|-----------|-------------|--------|\n')
    data.timeline.events.forEach(e => {
      parts.push(`| ${e.timestamp} | ${e.description} | ${e.source} |\n`)
    })
    parts.push('\n')
  }

  // Affected Systems
  if (enabled['affected-systems']) {
    parts.push(
      [
        '## Affected Systems',
        '',
        '### Compromised Systems',
        ''
      ].join('\n')
    )
    if (data.affectedSystems.systems.length > 0) {
      parts.push('| Hostname | IP Address | Type | Criticality | Services |\n')
      parts.push('|----------|------------|------|-------------|----------|\n')
      data.affectedSystems.systems.forEach(s => {
        parts.push(`| ${s.hostname} | ${s.ipAddress} | ${s.systemType} | ${s.criticality} | ${s.services} |\n`)
      })
    }
    parts.push('\n')
    parts.push(`### User Accounts Affected\n\n${data.affectedSystems.userAccountsAffected}\n`)
    parts.push(`### Data Exposed\n\n${data.affectedSystems.dataExposed}\n`)
  }

  // Impact Assessment
  if (enabled['impact-assessment']) {
    parts.push(
      [
        '## Impact Assessment',
        '',
        '### Confidentiality Impact',
        '',
        data.impactAssessment.confidentialityImpact,
        '',
        '### Integrity Impact',
        '',
        data.impactAssessment.integrityImpact,
        '',
        '### Availability Impact',
        '',
        data.impactAssessment.availabilityImpact,
        '',
        '### Financial Impact',
        '',
        data.impactAssessment.financialImpact,
        '',
        '### Reputational Impact',
        '',
        data.impactAssessment.reputationalImpact,
        ''
      ].join('\n')
    )
  }

  // Detection & Analysis
  if (enabled['detection-analysis']) {
    parts.push(
      [
        '## Detection & Analysis',
        '',
        `**Detection Method:** ${data.detectionAnalysis.detectionMethod}  `,
        `**Detection Date:** ${data.detectionAnalysis.detectionDate}  `,
        `**Detection Source:** ${data.detectionAnalysis.detectionSource}  `,
        '',
        '### Analysis Findings',
        '',
        data.detectionAnalysis.analysisFindings,
        '',
        '### Indicators of Compromise',
        '',
        data.detectionAnalysis.indicatorsOfCompromise,
        ''
      ].join('\n')
    )
  }

  // Containment
  if (enabled['containment']) {
    parts.push(
      [
        '## Containment',
        '',
        '### Short-Term Containment',
        '',
        data.containment.shortTermSteps,
        '',
        '### Long-Term Containment',
        '',
        data.containment.longTermSteps,
        '',
        '### Systems Isolated',
        '',
        data.containment.systemsIsolated,
        '',
        '### Access Revoked',
        '',
        data.containment.accessesRevoked,
        ''
      ].join('\n')
    )
  }

  // Eradication
  if (enabled['eradication']) {
    parts.push(
      [
        '## Eradication',
        '',
        '### Removal Steps',
        '',
        data.eradication.removalSteps,
        '',
        '### Vulnerabilities Patched',
        '',
        data.eradication.vulnerabilitiesPatched,
        '',
        '### Credentials Reset',
        '',
        data.eradication.credentialsReset,
        '',
        '### Malware Removed',
        '',
        data.eradication.malwareRemoved,
        ''
      ].join('\n')
    )
  }

  // Recovery
  if (enabled['recovery']) {
    parts.push(
      [
        '## Recovery',
        '',
        '### Restoration Approach',
        '',
        data.recovery.restorationApproach,
        '',
        '### Systems Restored',
        '',
        data.recovery.systemsRestored,
        '',
        '### Data Restored',
        '',
        data.recovery.dataRestored,
        '',
        '### Services Reopened',
        '',
        data.recovery.servicesReopened,
        '',
        '### Verification Steps',
        '',
        data.recovery.verificationSteps,
        ''
      ].join('\n')
    )
  }

  // Post-Incident
  if (enabled['post-incident']) {
    parts.push(
      [
        '## Post-Incident',
        '',
        '### Lessons Learned',
        '',
        data.postIncident.lessonsLearned,
        '',
        '### Improvements Needed',
        '',
        data.postIncident.improvementsNeeded,
        ''
      ].join('\n')
    )
    if (data.postIncident.actions.length > 0) {
      parts.push('### Action Items\n')
      parts.push('| Action | Owner | Due Date | Status |\n')
      parts.push('|--------|-------|----------|--------|\n')
      data.postIncident.actions.forEach(a => {
        parts.push(`| ${a.action} | ${a.owner} | ${a.dueDate} | ${a.status} |\n`)
      })
      parts.push('\n')
    }
  }

  // Appendices
  if (enabled['appendices']) {
    parts.push('## Appendices\n')
    if (data.appendices.iocs.length > 0) {
      parts.push('### Indicators of Compromise\n')
      parts.push('| Type | Value | Description |\n')
      parts.push('|------|-------|-------------|\n')
      data.appendices.iocs.forEach(i => {
        parts.push(`| ${i.type} | ${i.value} | ${i.description} |\n`)
      })
      parts.push('\n')
    }
    parts.push(`### Tools Used\n\n${data.appendices.toolsUsed}\n`)
    parts.push(`### References\n\n${data.appendices.references}\n`)
  }

  // Append JSON data
  const json = JSON.stringify(data, null, 2)
  return parts.join('\n') + '\n<!-- INCIDENT_RESPONSE_JSON\n' + json + '\nEND_INCIDENT_RESPONSE_JSON -->\n'
}

// ─── Sub-Components ─────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: Severity }) {
  const colors: Record<Severity, string> = {
    Critical: 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400',
    High: 'bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400',
    Medium: 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400',
    Low: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
  }
  return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${colors[severity]}`}>{severity}</span>
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      {children}
    </div>
  )
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-surface-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-900">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Incident Response Writing Guide</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
            <X size={20} />
          </button>
        </div>
        <div className="p-4 space-y-6">
          {HELP_CONTENT.map(section => (
            <section key={section.id}>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                <span>{section.icon}</span> {section.label}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{section.purpose}</p>
              <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 space-y-1">
                {section.tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function IncidentResponseTemplateView() {
  const [template, setTemplate] = useState<IncidentResponseData>(DEFAULT_INCIDENT_RESPONSE_DATA)
  const [sectionsEnabled, setSectionsEnabled] = useState<SectionEnabled>(DEFAULT_SECTIONS_ENABLED)
  const [activeSection, setActiveSection] = useState<SectionId>('incident-details')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string>('')
  const [showHelp, setShowHelp] = useState(false)
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())
  const [expandedActions, setExpandedActions] = useState<Set<string>>(new Set())
  const [filename, setFilename] = useState(`security/incident-response-${today}.md`)
  const [showLoadReport, setShowLoadReport] = useState(false)
  const [availableReports, setAvailableReports] = useState<string[]>([])
  const [openDatePicker, setOpenDatePicker] = useState<'incidentDate' | 'detectionDate' | null>(null)
  const [openTimelineEventDatePicker, setOpenTimelineEventDatePicker] = useState<string | null>(null)
  const [openActionDueDatePicker, setOpenActionDueDatePicker] = useState<string | null>(null)

  const createNote = useVaultStore(s => s.createNote)
  const readNote = useVaultStore(s => s.readNote)
  const refreshIndex = useVaultStore(s => s.refreshIndex)
  const rootHandle = useVaultStore(s => s.rootHandle)
  const fallbackMode = useVaultStore(s => s.fallbackMode)
  const index = useVaultStore(s => s.index)
  const vaultIsOpen = rootHandle !== null || fallbackMode

  // Load available reports
  useEffect(() => {
    if (!vaultIsOpen) return

    try {
      const allSecurityFiles = Array.from(index.entries())
        .filter(([path]) => path.startsWith('security/'))
        .map(([path]) => path)

      const incidentReports = allSecurityFiles
        .filter(path => path.endsWith('.md') && path.includes('incident-response'))
        .map(path => path.replace('security/', ''))

      setAvailableReports(incidentReports)
    } catch {}
  }, [vaultIsOpen, index])

  const updateTemplate = <K extends keyof IncidentResponseData>(section: K, data: Partial<IncidentResponseData[K]>) => {
    setTemplate(prev => ({
      ...prev,
      [section]: { ...(prev[section] as object), ...data }
    }))
  }

  const addTimelineEvent = () => {
    const id = crypto.randomUUID()
    const newEvent: TimelineEvent = {
      id,
      timestamp: today,
      description: '',
      source: ''
    }
    setTemplate(prev => ({ ...prev, timeline: { ...prev.timeline, events: [...prev.timeline.events, newEvent] } }))
    setExpandedEvents(prev => new Set([...prev, id]))
  }

  const removeTimelineEvent = (id: string) => {
    setTemplate(prev => ({
      ...prev,
      timeline: {
        ...prev.timeline,
        events: prev.timeline.events.filter(e => e.id !== id)
      }
    }))
    setExpandedEvents(prev => {
      const n = new Set(prev)
      n.delete(id)
      return n
    })
  }

  const updateTimelineEvent = (id: string, updates: Partial<TimelineEvent>) => {
    setTemplate(prev => ({
      ...prev,
      timeline: {
        ...prev.timeline,
        events: prev.timeline.events.map(e => (e.id === id ? { ...e, ...updates } : e))
      }
    }))
  }

  const toggleEvent = (id: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const addAffectedSystem = () => {
    const id = crypto.randomUUID()
    const newSystem: AffectedSystem = {
      id,
      hostname: '',
      ipAddress: '',
      systemType: '',
      criticality: 'High',
      services: ''
    }
    setTemplate(prev => ({
      ...prev,
      affectedSystems: {
        ...prev.affectedSystems,
        systems: [...prev.affectedSystems.systems, newSystem]
      }
    }))
  }

  const removeAffectedSystem = (id: string) => {
    setTemplate(prev => ({
      ...prev,
      affectedSystems: {
        ...prev.affectedSystems,
        systems: prev.affectedSystems.systems.filter(s => s.id !== id)
      }
    }))
  }

  const updateAffectedSystem = (id: string, updates: Partial<AffectedSystem>) => {
    setTemplate(prev => ({
      ...prev,
      affectedSystems: {
        ...prev.affectedSystems,
        systems: prev.affectedSystems.systems.map(s => (s.id === id ? { ...s, ...updates } : s))
      }
    }))
  }

  const addPostIncidentAction = () => {
    const id = crypto.randomUUID()
    const newAction: PostIncidentAction = {
      id,
      action: '',
      owner: '',
      dueDate: today,
      status: 'Open'
    }
    setTemplate(prev => ({
      ...prev,
      postIncident: {
        ...prev.postIncident,
        actions: [...prev.postIncident.actions, newAction]
      }
    }))
    setExpandedActions(prev => new Set([...prev, id]))
  }

  const removePostIncidentAction = (id: string) => {
    setTemplate(prev => ({
      ...prev,
      postIncident: {
        ...prev.postIncident,
        actions: prev.postIncident.actions.filter(a => a.id !== id)
      }
    }))
    setExpandedActions(prev => {
      const n = new Set(prev)
      n.delete(id)
      return n
    })
  }

  const updatePostIncidentAction = (id: string, updates: Partial<PostIncidentAction>) => {
    setTemplate(prev => ({
      ...prev,
      postIncident: {
        ...prev.postIncident,
        actions: prev.postIncident.actions.map(a => (a.id === id ? { ...a, ...updates } : a))
      }
    }))
  }

  const toggleAction = (id: string) => {
    setExpandedActions(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const addIOC = () => {
    const id = crypto.randomUUID()
    const newIOC = {
      id,
      type: '',
      value: '',
      description: ''
    }
    setTemplate(prev => ({
      ...prev,
      appendices: {
        ...prev.appendices,
        iocs: [...prev.appendices.iocs, newIOC]
      }
    }))
  }

  const removeIOC = (id: string) => {
    setTemplate(prev => ({
      ...prev,
      appendices: {
        ...prev.appendices,
        iocs: prev.appendices.iocs.filter(i => i.id !== id)
      }
    }))
  }

  const updateIOC = (id: string, updates: Partial<{ type: string; value: string; description: string }>) => {
    setTemplate(prev => ({
      ...prev,
      appendices: {
        ...prev.appendices,
        iocs: prev.appendices.iocs.map(i => (i.id === id ? { ...i, ...updates } : i))
      }
    }))
  }

  const handleLoadReport = async (reportPath: string) => {
    try {
      const fullPath = `security/${reportPath}`
      const content = await readNote(fullPath)

      if (!content) {
        setSaveError('Failed to read report file')
        setSaveStatus('error')
        setTimeout(() => setSaveStatus('idle'), 5000)
        return
      }

      // Extract JSON from comment block
      const jsonMatch = content.match(/<!-- INCIDENT_RESPONSE_JSON\n([\s\S]*?)\nEND_INCIDENT_RESPONSE_JSON -->/)

      if (!jsonMatch) {
        setSaveError('This file does not contain valid incident response data')
        setSaveStatus('error')
        setTimeout(() => setSaveStatus('idle'), 5000)
        return
      }

      const loadedTemplate: IncidentResponseData = JSON.parse(jsonMatch[1])
      setTemplate(loadedTemplate)
      setFilename(fullPath)
      setShowLoadReport(false)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (err) {
      setSaveError(`Failed to load report: ${err instanceof Error ? err.message : 'Unknown error'}`)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 5000)
    }
  }

  const handleGenerate = async () => {
    if (!vaultIsOpen) return
    setSaveStatus('saving')
    try {
      const markdown = generateMarkdownWithJSON(template, sectionsEnabled)
      await createNote(filename, markdown)
      await refreshIndex()
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Unknown error occurred')
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 5000)
    }
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-surface-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500'
  const textareaCls = `${inputCls} resize-y font-sans`
  const selectCls = inputCls

  const renderActiveSection = () => {
    switch (activeSection) {
      case 'incident-details':
        return (
          <div className="space-y-4">
            <FormField label="Incident ID">
              <input
                type="text"
                value={template.incidentDetails.incidentId}
                onChange={e => updateTemplate('incidentDetails', { incidentId: e.target.value })}
                className={inputCls}
                placeholder="INC-2026-001"
              />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Incident Date">
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={template.incidentDetails.incidentDate}
                    readOnly
                    placeholder="YYYY-MM-DD"
                    className={inputCls}
                  />
                  <button
                    onClick={() => setOpenDatePicker('incidentDate')}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"
                  >
                    <Calendar size={20} />
                  </button>
                </div>
              </FormField>
              <FormField label="Severity">
                <select
                  value={template.incidentDetails.severity}
                  onChange={e => updateTemplate('incidentDetails', { severity: e.target.value as Severity })}
                  className={selectCls}
                >
                  <option value="Critical">Critical</option>
                  <option value="High">High</option>
                  <option value="Medium">Medium</option>
                  <option value="Low">Low</option>
                </select>
              </FormField>
            </div>
            <FormField label="Incident Type">
              <input
                type="text"
                value={template.incidentDetails.incidentType}
                onChange={e => updateTemplate('incidentDetails', { incidentType: e.target.value })}
                className={inputCls}
                placeholder="e.g., Malware, Data Breach, DDoS, Insider Threat"
              />
            </FormField>
            <FormField label="Organization Name">
              <input
                type="text"
                value={template.incidentDetails.organizationName}
                onChange={e => updateTemplate('incidentDetails', { organizationName: e.target.value })}
                className={inputCls}
              />
            </FormField>
            <FormField label="Discovered By">
              <input
                type="text"
                value={template.incidentDetails.discoveredBy}
                onChange={e => updateTemplate('incidentDetails', { discoveredBy: e.target.value })}
                className={inputCls}
              />
            </FormField>
            <FormField label="Reported By">
              <input
                type="text"
                value={template.incidentDetails.reportedBy}
                onChange={e => updateTemplate('incidentDetails', { reportedBy: e.target.value })}
                className={inputCls}
              />
            </FormField>
          </div>
        )

      case 'toc':
        return (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">This section will be auto-generated when the report is produced.</p>
            <div className="space-y-2">
              {SECTIONS_META
                .filter(s => s.id !== 'toc' && sectionsEnabled[s.id])
                .map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                    className="w-full text-left px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
                  >
                    <span className="text-gray-400">
                      {i + 1}.
                    </span>{' '}
                    <span className="text-gray-900 dark:text-gray-100">{s.label}</span>
                  </button>
                ))}
            </div>
          </div>
        )

      case 'executive-summary':
        return (
          <div className="space-y-4">
            <FormField label="Incident Summary">
              <textarea
                value={template.executiveSummary.summary}
                onChange={e => updateTemplate('executiveSummary', { summary: e.target.value })}
                rows={4}
                className={textareaCls}
                placeholder="Brief overview of what happened"
              />
            </FormField>
            <FormField label="Business Impact">
              <textarea
                value={template.executiveSummary.businessImpact}
                onChange={e => updateTemplate('executiveSummary', { businessImpact: e.target.value })}
                rows={4}
                className={textareaCls}
                placeholder="Impact on business operations, revenue, reputation, etc."
              />
            </FormField>
            <FormField label="Recommended Actions">
              <textarea
                value={template.executiveSummary.recommendedActions}
                onChange={e => updateTemplate('executiveSummary', { recommendedActions: e.target.value })}
                rows={4}
                className={textareaCls}
                placeholder="Next steps and recommendations"
              />
            </FormField>
          </div>
        )

      case 'timeline':
        return (
          <div className="space-y-4">
            <button onClick={addTimelineEvent} className="flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-sm font-medium">
              <Plus size={16} /> Add Event
            </button>
            {template.timeline.events.map(event => (
              <div key={event.id} className="border border-gray-300 dark:border-gray-600 rounded overflow-hidden">
                <button
                  onClick={() => toggleEvent(event.id)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-3 text-left flex-1">
                    {expandedEvents.has(event.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span className="font-mono text-sm text-gray-700 dark:text-gray-300">{event.timestamp}</span>
                    <span className="text-sm text-gray-600 dark:text-gray-400 truncate">{event.description || '(no description)'}</span>
                  </div>
                </button>
                {expandedEvents.has(event.id) && (
                  <div className="px-4 py-4 space-y-3 bg-white dark:bg-surface-900/50 border-t border-gray-300 dark:border-gray-600">
                    <FormField label="Timestamp">
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={event.timestamp}
                          readOnly
                          placeholder="YYYY-MM-DDTHH:MM"
                          className={inputCls}
                        />
                        <button
                          onClick={() => setOpenTimelineEventDatePicker(event.id)}
                          className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"
                        >
                          <Calendar size={20} />
                        </button>
                      </div>
                    </FormField>
                    <FormField label="Description">
                      <textarea value={event.description} onChange={e => updateTimelineEvent(event.id, { description: e.target.value })} rows={3} className={textareaCls} />
                    </FormField>
                    <FormField label="Source">
                      <input
                        type="text"
                        value={event.source}
                        onChange={e => updateTimelineEvent(event.id, { source: e.target.value })}
                        className={inputCls}
                        placeholder="e.g., Log analysis, IDS alert, user report"
                      />
                    </FormField>
                    <button onClick={() => removeTimelineEvent(event.id)} className="flex items-center gap-2 px-3 py-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/40 rounded text-sm font-medium">
                      <Trash2 size={16} /> Delete Event
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )

      case 'affected-systems':
        return (
          <div className="space-y-4">
            <button onClick={addAffectedSystem} className="flex items-center gap-2 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-sm font-medium">
              <Plus size={16} /> Add System
            </button>
            {template.affectedSystems.systems.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800">
                      <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left">Hostname</th>
                      <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left">IP Address</th>
                      <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left">Type</th>
                      <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left">Criticality</th>
                      <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left">Services</th>
                      <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {template.affectedSystems.systems.map(system => (
                      <tr key={system.id} className="border border-gray-300 dark:border-gray-600">
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                          <input type="text" value={system.hostname} onChange={e => updateAffectedSystem(system.id, { hostname: e.target.value })} className={inputCls} />
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                          <input type="text" value={system.ipAddress} onChange={e => updateAffectedSystem(system.id, { ipAddress: e.target.value })} className={inputCls} />
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                          <input type="text" value={system.systemType} onChange={e => updateAffectedSystem(system.id, { systemType: e.target.value })} className={inputCls} />
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                          <select value={system.criticality} onChange={e => updateAffectedSystem(system.id, { criticality: e.target.value as any })} className={selectCls}>
                            <option value="Critical">Critical</option>
                            <option value="High">High</option>
                            <option value="Medium">Medium</option>
                            <option value="Low">Low</option>
                          </select>
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                          <input type="text" value={system.services} onChange={e => updateAffectedSystem(system.id, { services: e.target.value })} className={inputCls} />
                        </td>
                        <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-center">
                          <button onClick={() => removeAffectedSystem(system.id)} className="text-red-600 dark:text-red-400 hover:text-red-700">
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <FormField label="User Accounts Affected">
              <textarea value={template.affectedSystems.userAccountsAffected} onChange={e => updateTemplate('affectedSystems', { userAccountsAffected: e.target.value })} rows={3} className={textareaCls} />
            </FormField>
            <FormField label="Data Exposed">
              <textarea value={template.affectedSystems.dataExposed} onChange={e => updateTemplate('affectedSystems', { dataExposed: e.target.value })} rows={3} className={textareaCls} />
            </FormField>
          </div>
        )

      case 'impact-assessment':
        return (
          <div className="space-y-4">
            <FormField label="Confidentiality Impact">
              <textarea value={template.impactAssessment.confidentialityImpact} onChange={e => updateTemplate('impactAssessment', { confidentialityImpact: e.target.value })} rows={3} className={textareaCls} placeholder="What data was exposed or at risk?" />
            </FormField>
            <FormField label="Integrity Impact">
              <textarea value={template.impactAssessment.integrityImpact} onChange={e => updateTemplate('impactAssessment', { integrityImpact: e.target.value })} rows={3} className={textareaCls} placeholder="What data or systems were modified?" />
            </FormField>
            <FormField label="Availability Impact">
              <textarea value={template.impactAssessment.availabilityImpact} onChange={e => updateTemplate('impactAssessment', { availabilityImpact: e.target.value })} rows={3} className={textareaCls} placeholder="Which services were disrupted?" />
            </FormField>
            <FormField label="Financial Impact">
              <textarea value={template.impactAssessment.financialImpact} onChange={e => updateTemplate('impactAssessment', { financialImpact: e.target.value })} rows={3} className={textareaCls} placeholder="Cost of response, remediation, lost business, etc." />
            </FormField>
            <FormField label="Reputational Impact">
              <textarea value={template.impactAssessment.reputationalImpact} onChange={e => updateTemplate('impactAssessment', { reputationalImpact: e.target.value })} rows={3} className={textareaCls} placeholder="Impact on brand, customer trust, public perception" />
            </FormField>
          </div>
        )

      case 'detection-analysis':
        return (
          <div className="space-y-4">
            <FormField label="Detection Method">
              <input
                type="text"
                value={template.detectionAnalysis.detectionMethod}
                onChange={e => updateTemplate('detectionAnalysis', { detectionMethod: e.target.value })}
                className={inputCls}
                placeholder="e.g., IDS alert, automated scan, user report"
              />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Detection Date">
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={template.detectionAnalysis.detectionDate}
                    readOnly
                    placeholder="YYYY-MM-DD"
                    className={inputCls}
                  />
                  <button
                    onClick={() => setOpenDatePicker('detectionDate')}
                    className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"
                  >
                    <Calendar size={20} />
                  </button>
                </div>
              </FormField>
              <FormField label="Detection Source">
                <input
                  type="text"
                  value={template.detectionAnalysis.detectionSource}
                  onChange={e => updateTemplate('detectionAnalysis', { detectionSource: e.target.value })}
                  className={inputCls}
                  placeholder="e.g., SOC, Endpoint Protection"
                />
              </FormField>
            </div>
            <FormField label="Analysis Findings">
              <textarea value={template.detectionAnalysis.analysisFindings} onChange={e => updateTemplate('detectionAnalysis', { analysisFindings: e.target.value })} rows={4} className={textareaCls} />
            </FormField>
            <FormField label="Indicators of Compromise">
              <textarea
                value={template.detectionAnalysis.indicatorsOfCompromise}
                onChange={e => updateTemplate('detectionAnalysis', { indicatorsOfCompromise: e.target.value })}
                rows={4}
                className={textareaCls}
                placeholder="Hashes, IPs, domains, URLs, etc."
              />
            </FormField>
          </div>
        )

      case 'containment':
        return (
          <div className="space-y-4">
            <FormField label="Short-Term Containment Steps">
              <textarea value={template.containment.shortTermSteps} onChange={e => updateTemplate('containment', { shortTermSteps: e.target.value })} rows={4} className={textareaCls} placeholder="Immediate actions (isolate systems, disable accounts, etc.)" />
            </FormField>
            <FormField label="Long-Term Containment Steps">
              <textarea
                value={template.containment.longTermSteps}
                onChange={e => updateTemplate('containment', { longTermSteps: e.target.value })}
                rows={4}
                className={textareaCls}
                placeholder="Prevent re-infection (patch, change passwords, etc.)"
              />
            </FormField>
            <FormField label="Systems Isolated">
              <textarea value={template.containment.systemsIsolated} onChange={e => updateTemplate('containment', { systemsIsolated: e.target.value })} rows={3} className={textareaCls} />
            </FormField>
            <FormField label="Access Revoked">
              <textarea value={template.containment.accessesRevoked} onChange={e => updateTemplate('containment', { accessesRevoked: e.target.value })} rows={3} className={textareaCls} />
            </FormField>
          </div>
        )

      case 'eradication':
        return (
          <div className="space-y-4">
            <FormField label="Removal Steps">
              <textarea value={template.eradication.removalSteps} onChange={e => updateTemplate('eradication', { removalSteps: e.target.value })} rows={4} className={textareaCls} />
            </FormField>
            <FormField label="Vulnerabilities Patched">
              <textarea value={template.eradication.vulnerabilitiesPatched} onChange={e => updateTemplate('eradication', { vulnerabilitiesPatched: e.target.value })} rows={3} className={textareaCls} />
            </FormField>
            <FormField label="Credentials Reset">
              <textarea value={template.eradication.credentialsReset} onChange={e => updateTemplate('eradication', { credentialsReset: e.target.value })} rows={3} className={textareaCls} />
            </FormField>
            <FormField label="Malware Removed">
              <textarea value={template.eradication.malwareRemoved} onChange={e => updateTemplate('eradication', { malwareRemoved: e.target.value })} rows={3} className={textareaCls} />
            </FormField>
          </div>
        )

      case 'recovery':
        return (
          <div className="space-y-4">
            <FormField label="Restoration Approach">
              <textarea value={template.recovery.restorationApproach} onChange={e => updateTemplate('recovery', { restorationApproach: e.target.value })} rows={4} className={textareaCls} />
            </FormField>
            <FormField label="Systems Restored">
              <textarea value={template.recovery.systemsRestored} onChange={e => updateTemplate('recovery', { systemsRestored: e.target.value })} rows={3} className={textareaCls} />
            </FormField>
            <FormField label="Data Restored">
              <textarea value={template.recovery.dataRestored} onChange={e => updateTemplate('recovery', { dataRestored: e.target.value })} rows={3} className={textareaCls} />
            </FormField>
            <FormField label="Services Reopened">
              <textarea value={template.recovery.servicesReopened} onChange={e => updateTemplate('recovery', { servicesReopened: e.target.value })} rows={3} className={textareaCls} />
            </FormField>
            <FormField label="Verification Steps">
              <textarea value={template.recovery.verificationSteps} onChange={e => updateTemplate('recovery', { verificationSteps: e.target.value })} rows={3} className={textareaCls} />
            </FormField>
          </div>
        )

      case 'post-incident':
        return (
          <div className="space-y-4">
            <FormField label="Lessons Learned">
              <textarea value={template.postIncident.lessonsLearned} onChange={e => updateTemplate('postIncident', { lessonsLearned: e.target.value })} rows={4} className={textareaCls} />
            </FormField>
            <FormField label="Improvements Needed">
              <textarea value={template.postIncident.improvementsNeeded} onChange={e => updateTemplate('postIncident', { improvementsNeeded: e.target.value })} rows={4} className={textareaCls} />
            </FormField>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">Action Items</label>
                <button onClick={addPostIncidentAction} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
                  Add action
                </button>
              </div>
              {template.postIncident.actions.map(action => (
                <div key={action.id} className="border border-gray-300 dark:border-gray-600 rounded mb-2 overflow-hidden">
                  <button
                    onClick={() => toggleAction(action.id)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <div className="flex items-center gap-2">
                      {expandedActions.has(action.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{action.action || '(no action)'}</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${action.status === 'Closed' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' : action.status === 'In Progress' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {action.status}
                    </span>
                  </button>
                  {expandedActions.has(action.id) && (
                    <div className="px-4 py-3 space-y-2 bg-white dark:bg-surface-900/50 border-t border-gray-300 dark:border-gray-600">
                      <FormField label="Action">
                        <input type="text" value={action.action} onChange={e => updatePostIncidentAction(action.id, { action: e.target.value })} className={inputCls} />
                      </FormField>
                      <FormField label="Owner">
                        <input type="text" value={action.owner} onChange={e => updatePostIncidentAction(action.id, { owner: e.target.value })} className={inputCls} />
                      </FormField>
                      <FormField label="Due Date">
                        <div className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={action.dueDate}
                            readOnly
                            placeholder="YYYY-MM-DD"
                            className={inputCls}
                          />
                          <button
                            onClick={() => setOpenActionDueDatePicker(action.id)}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-600 dark:text-gray-400"
                          >
                            <Calendar size={20} />
                          </button>
                        </div>
                      </FormField>
                      <FormField label="Status">
                        <select value={action.status} onChange={e => updatePostIncidentAction(action.id, { status: e.target.value as any })} className={selectCls}>
                          <option value="Open">Open</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Closed">Closed</option>
                        </select>
                      </FormField>
                      <button onClick={() => removePostIncidentAction(action.id)} className="flex items-center gap-2 px-3 py-2 bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm rounded">
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )

      case 'appendices':
        return (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">Indicators of Compromise</label>
                <button onClick={addIOC} className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline">
                  Add IOC
                </button>
              </div>
              {template.appendices.iocs.length > 0 && (
                <div className="overflow-x-auto mb-4">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-100 dark:bg-gray-800">
                        <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left">Type</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left">Value</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-left">Description</th>
                        <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {template.appendices.iocs.map(ioc => (
                        <tr key={ioc.id} className="border border-gray-300 dark:border-gray-600">
                          <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                            <input type="text" value={ioc.type} onChange={e => updateIOC(ioc.id, { type: e.target.value })} className={inputCls} placeholder="Hash, IP, Domain, etc." />
                          </td>
                          <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                            <input type="text" value={ioc.value} onChange={e => updateIOC(ioc.id, { value: e.target.value })} className={inputCls} />
                          </td>
                          <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
                            <input type="text" value={ioc.description} onChange={e => updateIOC(ioc.id, { description: e.target.value })} className={inputCls} />
                          </td>
                          <td className="border border-gray-300 dark:border-gray-600 px-2 py-1 text-center">
                            <button onClick={() => removeIOC(ioc.id)} className="text-red-600 dark:text-red-400 hover:text-red-700">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <FormField label="Tools Used">
              <textarea value={template.appendices.toolsUsed} onChange={e => updateTemplate('appendices', { toolsUsed: e.target.value })} rows={3} className={textareaCls} />
            </FormField>
            <FormField label="References">
              <textarea value={template.appendices.references} onChange={e => updateTemplate('appendices', { references: e.target.value })} rows={3} className={textareaCls} />
            </FormField>
          </div>
        )

      default:
        return <div>Unknown section</div>
    }
  }

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-surface-900 overflow-hidden">
      {/* Vault warning banner */}
      {!vaultIsOpen && (
        <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 flex items-start gap-3 shrink-0">
          <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">No vault is open. Open a vault to save your incident response template.</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">Use the vault icon in the sidebar to open a folder. You can continue filling in the template and save it once a vault is open.</p>
          </div>
        </div>
      )}

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-56 shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800 overflow-y-auto">
          {/* Sidebar header */}
          <div className="px-3 py-3 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sections</h2>
          </div>

          {/* Section list */}
          {SECTIONS_META.map(section => (
            <div
              key={section.id}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer group transition-colors ${
                activeSection === section.id
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-r-2 border-emerald-500'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700/50'
              }`}
            >
              <input
                type="checkbox"
                checked={sectionsEnabled[section.id]}
                onChange={e => setSectionsEnabled(prev => ({ ...prev, [section.id]: e.target.checked }))}
                className="accent-emerald-500 shrink-0"
                onClick={e => e.stopPropagation()}
              />
              <button onClick={() => setActiveSection(section.id)} className="flex-1 text-left text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                <span>{section.icon}</span> {section.label}
              </button>
            </div>
          ))}

          {/* Bottom actions */}
          <div className="mt-auto p-3 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <button onClick={() => setShowHelp(true)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
              <HelpCircle size={14} /> Writing Guide
            </button>
            {vaultIsOpen && availableReports.length > 0 && (
              <button onClick={() => setShowLoadReport(true)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                <Download size={14} /> Load Template
              </button>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6 max-w-4xl">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{SECTIONS_META.find(s => s.id === activeSection)?.label}</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{SECTIONS_META.find(s => s.id === activeSection)?.description}</p>
            {renderActiveSection()}
          </div>

          {/* Generate report footer */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3 flex-wrap">
              <input
                type="text"
                value={filename}
                onChange={e => setFilename(e.target.value)}
                className={`flex-1 min-w-64 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-surface-900 text-gray-900 dark:text-white font-mono ${inputCls}`}
                placeholder="security/incident-response-YYYY-MM-DD.md"
              />
              <button
                onClick={handleGenerate}
                disabled={!vaultIsOpen || saveStatus === 'saving'}
                className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                  !vaultIsOpen || saveStatus === 'saving'
                    ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                    : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                }`}
              >
                {saveStatus === 'saving' ? 'Generating...' : 'Generate Template'}
              </button>
            </div>
            {saveStatus === 'saved' && <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">Template saved to vault at {filename}</p>}
            {saveStatus === 'error' && <p className="mt-2 text-sm text-red-600 dark:text-red-400">Error: {saveError}</p>}
          </div>
        </div>
      </div>

      {/* Load Report modal */}
      {showLoadReport && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-surface-900 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-900">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Load Incident Response Template</h2>
              <button onClick={() => setShowLoadReport(false)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-2">
              {availableReports.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">No saved incident response templates found in your vault</p>
              ) : (
                availableReports.map(report => (
                  <button
                    key={report}
                    onClick={() => handleLoadReport(report)}
                    className="w-full text-left px-4 py-3 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  >
                    <p className="font-mono text-sm text-emerald-600 dark:text-emerald-400">{report}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Date Time Pickers */}
      <DateTimePickerModal
        isOpen={openDatePicker === 'incidentDate'}
        onClose={() => setOpenDatePicker(null)}
        onSelect={(date) => {
          updateTemplate('incidentDetails', { incidentDate: date })
          setOpenDatePicker(null)
        }}
        initialValue={template.incidentDetails.incidentDate}
        showTime={false}
        title="Select Incident Date"
      />

      <DateTimePickerModal
        isOpen={openDatePicker === 'detectionDate'}
        onClose={() => setOpenDatePicker(null)}
        onSelect={(date) => {
          updateTemplate('detectionAnalysis', { detectionDate: date })
          setOpenDatePicker(null)
        }}
        initialValue={template.detectionAnalysis.detectionDate}
        showTime={false}
        title="Select Detection Date"
      />

      {/* Timeline Event Date Picker */}
      {template.timeline.events.map(event => (
        <DateTimePickerModal
          key={`timeline-${event.id}`}
          isOpen={openTimelineEventDatePicker === event.id}
          onClose={() => setOpenTimelineEventDatePicker(null)}
          onSelect={(dateTime) => {
            updateTimelineEvent(event.id, { timestamp: dateTime })
            setOpenTimelineEventDatePicker(null)
          }}
          initialValue={event.timestamp}
          showTime={true}
          title="Select Event Timestamp"
        />
      ))}

      {/* Post-Incident Action Due Date Picker */}
      {template.postIncident.actions.map(action => (
        <DateTimePickerModal
          key={`action-${action.id}`}
          isOpen={openActionDueDatePicker === action.id}
          onClose={() => setOpenActionDueDatePicker(null)}
          onSelect={(date) => {
            updatePostIncidentAction(action.id, { dueDate: date })
            setOpenActionDueDatePicker(null)
          }}
          initialValue={action.dueDate}
          showTime={false}
          title="Select Due Date"
        />
      ))}

      {/* Help modal */}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </div>
  )
}
