import React, { useState, useMemo } from 'react'
import { Copy, Check, HelpCircle, Download } from 'lucide-react'

interface Technique {
  id: string
  name: string
  description: string
  selected: boolean
  score?: number
  comment?: string
}

interface TacticGroup {
  id: string
  name: string
  description: string
  techniques: Technique[]
}

const MITRE_TACTICS: TacticGroup[] = [
  {
    id: 'reconnaissance',
    name: 'Reconnaissance',
    description: 'Adversary is trying to gather information they can use to plan future operations.',
    techniques: [
      { id: 'T1592', name: 'Gather Victim Host Information', description: 'Adversary gathers information about the victim\'s hosts', selected: false },
      { id: 'T1589', name: 'Gather Victim Identity Information', description: 'Adversary gathers information about victim identities', selected: false },
      { id: 'T1590', name: 'Gather Victim Network Information', description: 'Adversary gathers information about victim\'s network', selected: false },
      { id: 'T1598', name: 'Phishing for Information', description: 'Adversary sends phishing messages to gather information', selected: false },
      { id: 'T1591', name: 'Gather Victim Org Information', description: 'Adversary gathers information about victim organization', selected: false },
    ]
  },
  {
    id: 'resource-development',
    name: 'Resource Development',
    description: 'Adversary is trying to establish resources they can use to support operations.',
    techniques: [
      { id: 'T1583', name: 'Acquire Infrastructure', description: 'Adversary buys, leases, or rents infrastructure', selected: false },
      { id: 'T1586', name: 'Compromise Accounts', description: 'Adversary compromises accounts they can leverage', selected: false },
      { id: 'T1584', name: 'Compromise Infrastructure', description: 'Adversary compromises infrastructure to support operations', selected: false },
      { id: 'T1587', name: 'Develop Capabilities', description: 'Adversary develops capabilities for use in attacks', selected: false },
      { id: 'T1585', name: 'Establish Accounts', description: 'Adversary creates accounts for operations', selected: false },
    ]
  },
  {
    id: 'initial-access',
    name: 'Initial Access',
    description: 'Adversary is trying to get into your network.',
    techniques: [
      { id: 'T1189', name: 'Drive-by Compromise', description: 'User visits malicious website that compromises system', selected: false },
      { id: 'T1190', name: 'Exploit Public-Facing Application', description: 'Adversary exploits publicly facing applications', selected: false },
      { id: 'T1200', name: 'Hardware Additions', description: 'Adversary introduces hardware for unauthorized access', selected: false },
      { id: 'T1566', name: 'Phishing', description: 'Adversary sends phishing messages to compromise accounts', selected: false },
      { id: 'T1091', name: 'Replication Through Removable Media', description: 'Malware spreads via removable media', selected: false },
    ]
  },
  {
    id: 'execution',
    name: 'Execution',
    description: 'Adversary is trying to run malicious code.',
    techniques: [
      { id: 'T1059', name: 'Command and Scripting Interpreter', description: 'Adversary executes commands via interpreter', selected: false },
      { id: 'T1609', name: 'Container Administration Command', description: 'Adversary uses container administration commands', selected: false },
      { id: 'T1203', name: 'Exploitation for Client Execution', description: 'Adversary exploits vulnerabilities for code execution', selected: false },
      { id: 'T1559', name: 'Inter-Process Communication', description: 'Adversary uses IPC for execution', selected: false },
      { id: 'T1106', name: 'Native API', description: 'Adversary calls native APIs for execution', selected: false },
    ]
  },
  {
    id: 'persistence',
    name: 'Persistence',
    description: 'Adversary is trying to maintain their foothold.',
    techniques: [
      { id: 'T1547', name: 'Boot or Logon Autostart Execution', description: 'Malware executes at boot or logon', selected: false },
      { id: 'T1547.001', name: 'Registry Run Keys', description: 'Malware uses registry run keys for persistence', selected: false },
      { id: 'T1197', name: 'BITS Jobs', description: 'Adversary uses BITS for persistence', selected: false },
      { id: 'T1547.011', name: 'Start Folder', description: 'Malware uses Startup folder for persistence', selected: false },
      { id: 'T1547.014', name: 'Login Hook', description: 'Adversary abuses login hooks for persistence', selected: false },
    ]
  },
  {
    id: 'privilege-escalation',
    name: 'Privilege Escalation',
    description: 'Adversary is trying to gain higher-level permissions.',
    techniques: [
      { id: 'T1548', name: 'Abuse Elevation Control Mechanism', description: 'Adversary abuses elevation mechanisms', selected: false },
      { id: 'T1134', name: 'Access Token Manipulation', description: 'Adversary manipulates access tokens', selected: false },
      { id: 'T1037', name: 'Boot or Logon Initialization Scripts', description: 'Adversary uses initialization scripts', selected: false },
      { id: 'T1547', name: 'Boot or Logon Autostart Execution', description: 'Uses autostart mechanisms for escalation', selected: false },
      { id: 'T1547.001', name: 'Registry Run Keys', description: 'Modifies registry for privilege escalation', selected: false },
    ]
  },
  {
    id: 'defense-evasion',
    name: 'Defense Evasion',
    description: 'Adversary is trying to avoid being detected.',
    techniques: [
      { id: 'T1548', name: 'Abuse Elevation Control Mechanism', description: 'Evades detection by abusing elevation mechanisms', selected: false },
      { id: 'T1197', name: 'BITS Jobs', description: 'Uses BITS to evade detection', selected: false },
      { id: 'T1197.001', name: 'Masquerading', description: 'Hides identity by masquerading as legitimate process', selected: false },
      { id: 'T1036', name: 'Obfuscated Files or Information', description: 'Obfuscates malicious files', selected: false },
      { id: 'T1578', name: 'Modify Cloud Compute Infrastructure', description: 'Modifies cloud infrastructure to evade detection', selected: false },
    ]
  },
  {
    id: 'credential-access',
    name: 'Credential Access',
    description: 'Adversary is trying to steal account names and passwords.',
    techniques: [
      { id: 'T1110', name: 'Brute Force', description: 'Adversary uses brute force to crack credentials', selected: false },
      { id: 'T1555', name: 'Credentials from Password Stores', description: 'Adversary harvests credentials from stores', selected: false },
      { id: 'T1187', name: 'Forced Authentication', description: 'Adversary forces authentication requests', selected: false },
      { id: 'T1040', name: 'Network Sniffing', description: 'Adversary captures network traffic for credentials', selected: false },
      { id: 'T1056', name: 'Input Capture', description: 'Adversary captures user input for credentials', selected: false },
    ]
  },
  {
    id: 'discovery',
    name: 'Discovery',
    description: 'Adversary is trying to figure out your environment.',
    techniques: [
      { id: 'T1087', name: 'Account Discovery', description: 'Adversary discovers accounts on system', selected: false },
      { id: 'T1010', name: 'Application Window Discovery', description: 'Adversary discovers application windows', selected: false },
      { id: 'T1217', name: 'Browser Bookmark Discovery', description: 'Adversary discovers browser bookmarks', selected: false },
      { id: 'T1580', name: 'Cloud Infrastructure Discovery', description: 'Adversary discovers cloud infrastructure', selected: false },
      { id: 'T1538', name: 'Cloud Service Dashboard', description: 'Adversary accesses cloud service dashboards', selected: false },
    ]
  },
  {
    id: 'lateral-movement',
    name: 'Lateral Movement',
    description: 'Adversary is trying to move through your environment.',
    techniques: [
      { id: 'T1210', name: 'Exploitation of Remote Services', description: 'Adversary exploits remote services to move laterally', selected: false },
      { id: 'T1534', name: 'Internal Spearphishing', description: 'Adversary uses internal spearphishing', selected: false },
      { id: 'T1570', name: 'Lateral Tool Transfer', description: 'Adversary transfers tools laterally', selected: false },
      { id: 'T1570.001', name: 'RDP Hijacking', description: 'Adversary hijacks RDP sessions', selected: false },
      { id: 'T1021.005', name: 'VNC', description: 'Adversary uses VNC for lateral movement', selected: false },
    ]
  },
  {
    id: 'collection',
    name: 'Collection',
    description: 'Adversary is trying to gather data of interest.',
    techniques: [
      { id: 'T1557', name: 'Adversary-in-the-Middle', description: 'Adversary intercepts communications', selected: false },
      { id: 'T1123', name: 'Audio Capture', description: 'Adversary captures audio', selected: false },
      { id: 'T1119', name: 'Automated Exfiltration', description: 'Adversary automatically exfiltrates data', selected: false },
      { id: 'T1115', name: 'Clipboard Data', description: 'Adversary collects clipboard data', selected: false },
      { id: 'T1530', name: 'Data from Cloud Storage', description: 'Adversary collects data from cloud storage', selected: false },
    ]
  },
  {
    id: 'command-control',
    name: 'Command and Control',
    description: 'Adversary is trying to communicate with compromised systems.',
    techniques: [
      { id: 'T1071', name: 'Application Layer Protocol', description: 'C2 uses application layer protocols', selected: false },
      { id: 'T1092', name: 'Communication Through Removable Media', description: 'C2 uses removable media', selected: false },
      { id: 'T1001', name: 'Data Obfuscation', description: 'C2 traffic is obfuscated', selected: false },
      { id: 'T1008', name: 'Fallback Channels', description: 'C2 has fallback communication channels', selected: false },
      { id: 'T1105', name: 'Ingress Tool Transfer', description: 'Adversary transfers tools via C2', selected: false },
    ]
  },
  {
    id: 'exfiltration',
    name: 'Exfiltration',
    description: 'Adversary is trying to steal data.',
    techniques: [
      { id: 'T1020', name: 'Automated Exfiltration', description: 'Malware automatically exfiltrates data', selected: false },
      { id: 'T1030', name: 'Data Transfer Size Limits', description: 'Exfiltration follows size limits', selected: false },
      { id: 'T1048', name: 'Exfiltration Over Alternative Protocol', description: 'Data exfiltrated over alternative protocols', selected: false },
      { id: 'T1041', name: 'Exfiltration Over C2 Channel', description: 'Data exfiltrated over C2 channel', selected: false },
      { id: 'T1011', name: 'Exfiltration Over Other Network Medium', description: 'Data exfiltrated over alternative network', selected: false },
    ]
  },
  {
    id: 'impact',
    name: 'Impact',
    description: 'Adversary is trying to manipulate, interrupt, or destroy systems and data.',
    techniques: [
      { id: 'T1531', name: 'Account Access Removal', description: 'Adversary removes account access', selected: false },
      { id: 'T1531.001', name: 'Console Account Lockout', description: 'Locks console accounts', selected: false },
      { id: 'T1531.002', name: 'Disable Cloud Accounts', description: 'Disables cloud accounts', selected: false },
      { id: 'T1531.003', name: 'Disable Cloud Console', description: 'Disables cloud console access', selected: false },
      { id: 'T1531.004', name: 'Revoke Cloud API Credentials', description: 'Revokes API credentials', selected: false },
    ]
  }
]

export default function MitreAttackNavigatorView() {
  const [tactics, setTactics] = useState<TacticGroup[]>(MITRE_TACTICS)
  const [selectedView, setSelectedView] = useState<'matrix' | 'heatmap'>('matrix')
  const [copied, setCopied] = useState(false)

  const toggleTechnique = (tacticId: string, techniqueId: string) => {
    setTactics(
      tactics.map(tactic =>
        tactic.id === tacticId
          ? {
              ...tactic,
              techniques: tactic.techniques.map(tech =>
                tech.id === techniqueId ? { ...tech, selected: !tech.selected } : tech
              )
            }
          : tactic
      )
    )
  }

  const statistics = useMemo(() => {
    let total = 0
    let selected = 0
    tactics.forEach(tactic => {
      tactic.techniques.forEach(() => {
        total++
        selected += tactic.techniques.filter(t => t.selected).length
      })
    })
    return { total, selected, coverage: total > 0 ? Math.round((selected / total) * 100) : 0 }
  }, [tactics])

  const handleCopyMatrix = () => {
    const matrix = tactics
      .map(
        tactic =>
          `${tactic.name}: ${tactic.techniques.filter(t => t.selected).map(t => t.id).join(', ')}`
      )
      .filter(line => !line.endsWith(': '))
      .join('\n')
    navigator.clipboard.writeText(matrix)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadJSON = () => {
    const data = {
      timestamp: new Date().toISOString(),
      statistics,
      tactics: tactics.map(tactic => ({
        name: tactic.name,
        techniques: tactic.techniques.filter(t => t.selected).map(t => ({
          id: t.id,
          name: t.name,
          description: t.description
        }))
      }))
    }
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mitre-attack-navigator-${Date.now()}.json`
    a.click()
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden gap-4 p-4">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-3">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">MITRE ATT&CK Navigator</h2>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
          Map adversary tactics and techniques to your threat model. Select techniques to build your attack matrix visualization.
        </p>

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="p-2 rounded bg-blue-100 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700">
            <div className="text-xs text-blue-700 dark:text-blue-400">Coverage</div>
            <div className="text-lg font-bold text-blue-700 dark:text-blue-400">{statistics.coverage}%</div>
          </div>
          <div className="p-2 rounded bg-emerald-100 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
            <div className="text-xs text-emerald-700 dark:text-emerald-400">Selected</div>
            <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{statistics.selected}/{statistics.total}</div>
          </div>
          <div className="flex gap-1">
            <button
              onClick={handleCopyMatrix}
              className="flex-1 px-2 py-2 rounded text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium transition-colors flex items-center justify-center gap-1"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              Copy
            </button>
            <button
              onClick={handleDownloadJSON}
              className="flex-1 px-2 py-2 rounded text-xs bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors flex items-center justify-center gap-1"
            >
              <Download size={12} />
              JSON
            </button>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedView('matrix')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              selectedView === 'matrix'
                ? 'bg-emerald-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300'
            }`}
          >
            Matrix View
          </button>
          <button
            onClick={() => setSelectedView('heatmap')}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              selectedView === 'heatmap'
                ? 'bg-emerald-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300'
            }`}
          >
            Heatmap View
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {selectedView === 'matrix' ? (
          // Matrix View
          <div className="space-y-4 pr-2">
            {tactics.map(tactic => {
              const selectedCount = tactic.techniques.filter(t => t.selected).length
              return (
                <div key={tactic.id} className="border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
                  <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-3 text-white">
                    <h3 className="font-bold text-sm">{tactic.name}</h3>
                    <p className="text-xs opacity-90 mt-1">{tactic.description}</p>
                    <div className="text-xs mt-2 opacity-75">{selectedCount} of {tactic.techniques.length} selected</div>
                  </div>
                  <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-50 dark:bg-surface-800">
                    {tactic.techniques.map(technique => (
                      <label key={technique.id} className="flex items-start gap-2 p-2 rounded hover:bg-gray-200 dark:hover:bg-surface-700 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={technique.selected}
                          onChange={() => toggleTechnique(tactic.id, technique.id)}
                          className="mt-1 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{technique.id}</div>
                          <div className="text-xs font-medium text-gray-900 dark:text-gray-100">{technique.name}</div>
                          <div className="text-[10px] text-gray-600 dark:text-gray-400 mt-0.5">{technique.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          // Heatmap View
          <div className="space-y-2 pr-2">
            {tactics.map(tactic => {
              const selectedCount = tactic.techniques.filter(t => t.selected).length
              const intensity = selectedCount / tactic.techniques.length
              const bgColor =
                intensity === 0
                  ? 'bg-gray-100 dark:bg-gray-800'
                  : intensity < 0.3
                    ? 'bg-blue-100 dark:bg-blue-900/30'
                    : intensity < 0.7
                      ? 'bg-blue-300 dark:bg-blue-700'
                      : 'bg-blue-600 dark:bg-blue-900'

              return (
                <div
                  key={tactic.id}
                  className={`p-3 rounded border border-gray-200 dark:border-gray-700 ${bgColor} transition-colors`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="font-bold text-sm text-gray-900 dark:text-white">{tactic.name}</h3>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {selectedCount} of {tactic.techniques.length} techniques mapped
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all"
                          style={{ width: `${intensity * 100}%` }}
                        ></div>
                      </div>
                      <div className="text-xs font-bold text-gray-700 dark:text-gray-300 w-8">
                        {Math.round(intensity * 100)}%
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Info Footer */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-2 text-xs text-gray-600 dark:text-gray-400">
        <p>💡 <strong>Tip:</strong> Select techniques to build your threat model. Use Matrix view for detailed selection, Heatmap for coverage overview.</p>
      </div>
    </div>
  )
}
