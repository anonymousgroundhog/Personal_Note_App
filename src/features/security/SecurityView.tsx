import React, { useState } from 'react'
import JimpleAnalyzerView from './JimpleAnalyzerView'
import SootCompilerView from './SootCompilerView'
import AndroidManifestAnalyzerView from './AndroidManifestAnalyzerView'
import CVSSCalculatorView from './CVSSCalculatorView'
import MitreAttackNavigatorView from './MitreAttackNavigatorView'
import PentestReportView from './PentestReportView'
import IncidentResponseTemplateView from './IncidentResponseTemplateView'
import OsintView from './OsintView'
import PcapAnalyzerView from './PcapAnalyzerView'
import LiveCaptureView from './LiveCaptureView'
import ApkAnalyzerView from './ApkAnalyzerView'

type TopTool = 'osint' | 'network-analysis' | 'apktool' | 'soot-framework' | 'reporting-tools'
type ApktoolTab = 'apk-decompiler' | 'manifest-analyzer'
type SootTab = 'soot-compiler' | 'jimple-analyzer'
type NetworkTab = 'pcap-analyzer' | 'live-capture'
type ReportingTab = 'cvss-calculator' | 'mitre-navigator' | 'pentest-report' | 'incident-response'

interface Tool {
  id: TopTool
  label: string
  icon: string
}

const TOOLS: Tool[] = [
  { id: 'osint',            label: 'OSINT',            icon: '🕵️' },
  { id: 'network-analysis', label: 'Network Analysis', icon: '📡' },
  { id: 'apktool',          label: 'APKTool',          icon: '📦' },
  { id: 'soot-framework',   label: 'Soot Framework',   icon: '⚙️' },
  { id: 'reporting-tools',  label: 'Reporting Tools',  icon: '📊' },
]

const APKTOOL_TABS: { id: ApktoolTab; label: string }[] = [
  { id: 'apk-decompiler',   label: 'APK Decompiler' },
  { id: 'manifest-analyzer', label: 'Manifest Analyzer' },
]

const NETWORK_TABS: { id: NetworkTab; label: string }[] = [
  { id: 'pcap-analyzer', label: 'PCAP Analyzer' },
  { id: 'live-capture',  label: 'Live Capture' },
]

const REPORTING_TABS: { id: ReportingTab; label: string }[] = [
  { id: 'cvss-calculator',  label: 'CVSS Calculator' },
  { id: 'mitre-navigator',  label: 'MITRE Navigator' },
  { id: 'pentest-report',   label: 'Pentest Report' },
  { id: 'incident-response', label: 'Incident Response' },
]

const SOOT_TABS: { id: SootTab; label: string }[] = [
  { id: 'soot-compiler',   label: 'Soot Compiler' },
  { id: 'jimple-analyzer', label: 'Jimple Analyzer' },
]

function SubTabBar<T extends string>({
  tabs, active, onChange,
}: { tabs: { id: T; label: string }[]; active: T; onChange: (id: T) => void }) {
  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-900">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            active === tab.id
              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

export default function SecurityView() {
  const [activeTool, setActiveTool] = useState<TopTool>('osint')
  const [apktoolTab, setApktoolTab] = useState<ApktoolTab>('apk-decompiler')
  const [sootTab, setSootTab] = useState<SootTab>('soot-compiler')
  const [networkTab, setNetworkTab] = useState<NetworkTab>('pcap-analyzer')
  const [reportingTab, setReportingTab] = useState<ReportingTab>('cvss-calculator')

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-surface-900 overflow-hidden">
      {/* Top-level tool tabs */}
      <div className="flex items-center gap-1 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800">
        <div className="flex items-center gap-0.5">
          {TOOLS.map(tool => (
            <button
              key={tool.id}
              onClick={() => setActiveTool(tool.id)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                activeTool === tool.id
                  ? 'bg-emerald-500 text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <span className="mr-1.5">{tool.icon}</span>
              {tool.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-tabs */}
      {activeTool === 'network-analysis' && (
        <SubTabBar tabs={NETWORK_TABS} active={networkTab} onChange={setNetworkTab} />
      )}
      {activeTool === 'apktool' && (
        <SubTabBar tabs={APKTOOL_TABS} active={apktoolTab} onChange={setApktoolTab} />
      )}
      {activeTool === 'soot-framework' && (
        <SubTabBar tabs={SOOT_TABS} active={sootTab} onChange={setSootTab} />
      )}
      {activeTool === 'reporting-tools' && (
        <SubTabBar tabs={REPORTING_TABS} active={reportingTab} onChange={setReportingTab} />
      )}

      {/* Tool content area */}
      <div className="flex-1 overflow-hidden">
        {activeTool === 'osint'                                                          && <OsintView />}
        {activeTool === 'network-analysis' && networkTab === 'pcap-analyzer'            && <PcapAnalyzerView />}
        {activeTool === 'network-analysis' && networkTab === 'live-capture'             && <LiveCaptureView />}
        {activeTool === 'apktool' && apktoolTab === 'apk-decompiler'                    && <ApkAnalyzerView />}
        {activeTool === 'apktool' && apktoolTab === 'manifest-analyzer'                 && <AndroidManifestAnalyzerView />}
        {activeTool === 'soot-framework' && sootTab === 'soot-compiler'                 && <SootCompilerView />}
        {activeTool === 'soot-framework' && sootTab === 'jimple-analyzer'               && <JimpleAnalyzerView />}
        {activeTool === 'reporting-tools' && reportingTab === 'cvss-calculator'         && <CVSSCalculatorView />}
        {activeTool === 'reporting-tools' && reportingTab === 'mitre-navigator'         && <MitreAttackNavigatorView />}
        {activeTool === 'reporting-tools' && reportingTab === 'pentest-report'          && <PentestReportView />}
        {activeTool === 'reporting-tools' && reportingTab === 'incident-response'       && <IncidentResponseTemplateView />}
      </div>
    </div>
  )
}
