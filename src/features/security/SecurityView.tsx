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

type SecurityTool = 'jimple-analyzer' | 'soot-compiler' | 'manifest-analyzer' | 'cvss-calculator' | 'mitre-navigator' | 'pentest-report' | 'incident-response' | 'osint' | 'pcap-analyzer' | 'live-capture'

interface Tool {
  id: SecurityTool
  label: string
  icon: string
}

const TOOLS: Tool[] = [
  { id: 'osint',             label: 'OSINT',            icon: '🕵️' },
  { id: 'pcap-analyzer',    label: 'PCAP Analyzer',    icon: '📡' },
  { id: 'live-capture',     label: 'Live Capture',     icon: '🔴' },
  { id: 'soot-compiler',     label: 'Soot Compiler',    icon: '⚙️' },
  { id: 'jimple-analyzer',   label: 'Jimple Analyzer',  icon: '🔍' },
  { id: 'manifest-analyzer', label: 'Manifest Analyzer', icon: '📋' },
  { id: 'cvss-calculator',   label: 'CVSS Calculator',  icon: '🎯' },
  { id: 'mitre-navigator',   label: 'MITRE Navigator',  icon: '🗺️' },
  { id: 'pentest-report',    label: 'Pentest Report',   icon: '📄' },
  { id: 'incident-response', label: 'Incident Response', icon: '🚨' },
]

export default function SecurityView() {
  const [activeTool, setActiveTool] = useState<SecurityTool>('osint')

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-surface-900 overflow-hidden">
      {/* Header with tool tabs */}
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

      {/* Tool content area */}
      <div className="flex-1 overflow-hidden">
        {activeTool === 'osint'             && <OsintView />}
        {activeTool === 'pcap-analyzer'    && <PcapAnalyzerView />}
        {activeTool === 'live-capture'     && <LiveCaptureView />}
        {activeTool === 'soot-compiler'     && <SootCompilerView />}
        {activeTool === 'jimple-analyzer'   && <JimpleAnalyzerView />}
        {activeTool === 'manifest-analyzer' && <AndroidManifestAnalyzerView />}
        {activeTool === 'cvss-calculator'   && <CVSSCalculatorView />}
        {activeTool === 'mitre-navigator'   && <MitreAttackNavigatorView />}
        {activeTool === 'pentest-report'    && <PentestReportView />}
        {activeTool === 'incident-response' && <IncidentResponseTemplateView />}
      </div>
    </div>
  )
}
