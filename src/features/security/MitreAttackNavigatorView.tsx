import React, { useState, useMemo, useEffect } from 'react'
import { Copy, Check, Download, X, AlertCircle } from 'lucide-react'
import { useSecurityStore } from './securityStore'

const STORAGE_KEY = 'mitre_navigator_data_v1'

const loadTactics = (): TacticGroup[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return parsed
    }
  } catch {}
  return MITRE_TACTICS
}

const saveTactics = (tactics: TacticGroup[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tactics))
  } catch {}
}

interface Technique {
  id: string
  name: string
  description: string
  selected: boolean
  cvssScore?: number
  cvssVector?: string
  cvssSeverity?: string
  notes?: string
  platforms?: string[]
}

interface TacticGroup {
  id: string
  name: string
  description: string
  techniques: Technique[]
}

interface FocusedTechnique {
  tacticId: string
  techniqueId: string
}

const MITRE_TACTICS: TacticGroup[] = [
  {
    id: 'reconnaissance',
    name: 'Reconnaissance',
    description: 'Adversary is trying to gather information they can use to plan future operations.',
    techniques: [
      { id: 'T1592', name: 'Gather Victim Host Information', description: 'Adversary gathers information about the victim\'s hosts', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
      { id: 'T1589', name: 'Gather Victim Identity Information', description: 'Adversary gathers information about victim identities', selected: false, platforms: ['Windows', 'macOS'] },
      { id: 'T1590', name: 'Gather Victim Network Information', description: 'Adversary gathers information about victim\'s network', selected: false, platforms: ['Windows', 'Linux'] },
      { id: 'T1598', name: 'Phishing for Information', description: 'Adversary sends phishing messages to gather information', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
      { id: 'T1591', name: 'Gather Victim Org Information', description: 'Adversary gathers information about victim organization', selected: false, platforms: ['Windows', 'macOS'] },
    ]
  },
  {
    id: 'resource-development',
    name: 'Resource Development',
    description: 'Adversary is trying to establish resources they can use to support operations.',
    techniques: [
      { id: 'T1583', name: 'Acquire Infrastructure', description: 'Adversary buys, leases, or rents infrastructure', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
      { id: 'T1586', name: 'Compromise Accounts', description: 'Adversary compromises accounts they can leverage', selected: false, platforms: ['Windows', 'macOS'] },
      { id: 'T1584', name: 'Compromise Infrastructure', description: 'Adversary compromises infrastructure to support operations', selected: false, platforms: ['Windows', 'Linux'] },
      { id: 'T1587', name: 'Develop Capabilities', description: 'Adversary develops capabilities for use in attacks', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
      { id: 'T1585', name: 'Establish Accounts', description: 'Adversary creates accounts for operations', selected: false, platforms: ['Windows', 'macOS'] },
    ]
  },
  {
    id: 'initial-access',
    name: 'Initial Access',
    description: 'Adversary is trying to get into your network.',
    techniques: [
      { id: 'T1189', name: 'Drive-by Compromise', description: 'User visits malicious website that compromises system', selected: false, platforms: ['Windows', 'macOS'] },
      { id: 'T1190', name: 'Exploit Public-Facing Application', description: 'Adversary exploits publicly facing applications', selected: false, platforms: ['Windows', 'Linux'] },
      { id: 'T1200', name: 'Hardware Additions', description: 'Adversary introduces hardware for unauthorized access', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
      { id: 'T1566', name: 'Phishing', description: 'Adversary sends phishing messages to compromise accounts', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
      { id: 'T1091', name: 'Replication Through Removable Media', description: 'Malware spreads via removable media', selected: false, platforms: ['Windows', 'Linux'] },
    ]
  },
  {
    id: 'execution',
    name: 'Execution',
    description: 'Adversary is trying to run malicious code.',
    techniques: [
      { id: 'T1059', name: 'Command and Scripting Interpreter', description: 'Adversary executes commands via interpreter', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
      { id: 'T1609', name: 'Container Administration Command', description: 'Adversary uses container administration commands', selected: false, platforms: ['Linux'] },
      { id: 'T1203', name: 'Exploitation for Client Execution', description: 'Adversary exploits vulnerabilities for code execution', selected: false, platforms: ['Windows', 'macOS'] },
      { id: 'T1559', name: 'Inter-Process Communication', description: 'Adversary uses IPC for execution', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
      { id: 'T1106', name: 'Native API', description: 'Adversary calls native APIs for execution', selected: false, platforms: ['Windows', 'macOS'] },
    ]
  },
  {
    id: 'persistence',
    name: 'Persistence',
    description: 'Adversary is trying to maintain their foothold.',
    techniques: [
      { id: 'T1547', name: 'Boot or Logon Autostart Execution', description: 'Malware executes at boot or logon', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
      { id: 'T1197', name: 'BITS Jobs', description: 'Adversary uses BITS for persistence', selected: false, platforms: ['Windows'] },
      { id: 'T1547.011', name: 'Start Folder', description: 'Malware uses Startup folder for persistence', selected: false, platforms: ['Windows', 'macOS'] },
      { id: 'T1547.014', name: 'Login Hook', description: 'Adversary abuses login hooks for persistence', selected: false, platforms: ['macOS', 'Linux'] },
      { id: 'T1098', name: 'Account Manipulation', description: 'Adversary manipulates user account settings', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
    ]
  },
  {
    id: 'privilege-escalation',
    name: 'Privilege Escalation',
    description: 'Adversary is trying to gain higher-level permissions.',
    techniques: [
      { id: 'T1548', name: 'Abuse Elevation Control Mechanism', description: 'Adversary abuses elevation mechanisms', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
      { id: 'T1134', name: 'Access Token Manipulation', description: 'Adversary manipulates access tokens', selected: false, platforms: ['Windows'] },
      { id: 'T1037', name: 'Boot or Logon Initialization Scripts', description: 'Adversary uses initialization scripts', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
      { id: 'T1547', name: 'Boot or Logon Autostart Execution', description: 'Uses autostart mechanisms for escalation', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
      { id: 'T1547.001', name: 'Registry Run Keys', description: 'Modifies registry for privilege escalation', selected: false, platforms: ['Windows'] },
    ]
  },
  {
    id: 'defense-evasion',
    name: 'Defense Evasion',
    description: 'Adversary is trying to avoid being detected.',
    techniques: [
      { id: 'T1548', name: 'Abuse Elevation Control Mechanism', description: 'Evades detection by abusing elevation mechanisms', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
      { id: 'T1197', name: 'BITS Jobs', description: 'Uses BITS to evade detection', selected: false, platforms: ['Windows'] },
      { id: 'T1036', name: 'Obfuscated Files or Information', description: 'Obfuscates malicious files', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
      { id: 'T1578', name: 'Modify Cloud Compute Infrastructure', description: 'Modifies cloud infrastructure to evade detection', selected: false, platforms: ['Linux'] },
      { id: 'T1140', name: 'Deobfuscate/Decode Files or Information', description: 'Decodes obfuscated files to evade detection', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
    ]
  },
  {
    id: 'credential-access',
    name: 'Credential Access',
    description: 'Adversary is trying to steal account names and passwords.',
    techniques: [
      { id: 'T1110', name: 'Brute Force', description: 'Adversary uses brute force to crack credentials', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
      { id: 'T1555', name: 'Credentials from Password Stores', description: 'Adversary harvests credentials from stores', selected: false, platforms: ['Windows', 'macOS'] },
      { id: 'T1187', name: 'Forced Authentication', description: 'Adversary forces authentication requests', selected: false, platforms: ['Windows', 'Linux'] },
      { id: 'T1040', name: 'Network Sniffing', description: 'Adversary captures network traffic for credentials', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
      { id: 'T1056', name: 'Input Capture', description: 'Adversary captures user input for credentials', selected: false, platforms: ['Windows', 'macOS'] },
    ]
  },
  {
    id: 'discovery',
    name: 'Discovery',
    description: 'Adversary is trying to figure out your environment.',
    techniques: [
      { id: 'T1087', name: 'Account Discovery', description: 'Adversary discovers accounts on system', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
      { id: 'T1010', name: 'Application Window Discovery', description: 'Adversary discovers application windows', selected: false, platforms: ['Windows', 'macOS'] },
      { id: 'T1217', name: 'Browser Bookmark Discovery', description: 'Adversary discovers browser bookmarks', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
      { id: 'T1580', name: 'Cloud Infrastructure Discovery', description: 'Adversary discovers cloud infrastructure', selected: false, platforms: ['Linux'] },
      { id: 'T1538', name: 'Cloud Service Dashboard', description: 'Adversary accesses cloud service dashboards', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
    ]
  },
  {
    id: 'lateral-movement',
    name: 'Lateral Movement',
    description: 'Adversary is trying to move through your environment.',
    techniques: [
      { id: 'T1210', name: 'Exploitation of Remote Services', description: 'Adversary exploits remote services to move laterally', selected: false, platforms: ['Windows', 'Linux'] },
      { id: 'T1534', name: 'Internal Spearphishing', description: 'Adversary uses internal spearphishing', selected: false, platforms: ['Windows', 'macOS'] },
      { id: 'T1570', name: 'Lateral Tool Transfer', description: 'Adversary transfers tools laterally', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
      { id: 'T1021.005', name: 'VNC', description: 'Adversary uses VNC for lateral movement', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
      { id: 'T1021.001', name: 'RDP', description: 'Adversary uses RDP for lateral movement', selected: false, platforms: ['Windows'] },
    ]
  },
  {
    id: 'collection',
    name: 'Collection',
    description: 'Adversary is trying to gather data of interest.',
    techniques: [
      { id: 'T1557', name: 'Adversary-in-the-Middle', description: 'Adversary intercepts communications', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
      { id: 'T1123', name: 'Audio Capture', description: 'Adversary captures audio', selected: false, platforms: ['Windows', 'macOS'] },
      { id: 'T1119', name: 'Automated Exfiltration', description: 'Adversary automatically exfiltrates data', selected: false, platforms: ['Windows', 'Linux'] },
      { id: 'T1115', name: 'Clipboard Data', description: 'Adversary collects clipboard data', selected: false, platforms: ['Windows', 'macOS'] },
      { id: 'T1530', name: 'Data from Cloud Storage', description: 'Adversary collects data from cloud storage', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
    ]
  },
  {
    id: 'command-control',
    name: 'Command and Control',
    description: 'Adversary is trying to communicate with compromised systems.',
    techniques: [
      { id: 'T1071', name: 'Application Layer Protocol', description: 'C2 uses application layer protocols', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
      { id: 'T1092', name: 'Communication Through Removable Media', description: 'C2 uses removable media', selected: false, platforms: ['Windows', 'Linux'] },
      { id: 'T1001', name: 'Data Obfuscation', description: 'C2 traffic is obfuscated', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
      { id: 'T1008', name: 'Fallback Channels', description: 'C2 has fallback communication channels', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
      { id: 'T1105', name: 'Ingress Tool Transfer', description: 'Adversary transfers tools via C2', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
    ]
  },
  {
    id: 'exfiltration',
    name: 'Exfiltration',
    description: 'Adversary is trying to steal data.',
    techniques: [
      { id: 'T1020', name: 'Automated Exfiltration', description: 'Malware automatically exfiltrates data', selected: false, platforms: ['Windows', 'Linux'] },
      { id: 'T1030', name: 'Data Transfer Size Limits', description: 'Exfiltration follows size limits', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
      { id: 'T1048', name: 'Exfiltration Over Alternative Protocol', description: 'Data exfiltrated over alternative protocols', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
      { id: 'T1041', name: 'Exfiltration Over C2 Channel', description: 'Data exfiltrated over C2 channel', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
      { id: 'T1011', name: 'Exfiltration Over Other Network Medium', description: 'Data exfiltrated over alternative network', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
    ]
  },
  {
    id: 'impact',
    name: 'Impact',
    description: 'Adversary is trying to manipulate, interrupt, or destroy systems and data.',
    techniques: [
      { id: 'T1531', name: 'Account Access Removal', description: 'Adversary removes account access', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
      { id: 'T1531.001', name: 'Console Account Lockout', description: 'Locks console accounts', selected: false, platforms: ['Windows'] },
      { id: 'T1531.002', name: 'Disable Cloud Accounts', description: 'Disables cloud accounts', selected: false, platforms: ['Windows', 'Linux'] },
      { id: 'T1485', name: 'Data Destruction', description: 'Adversary destroys data', selected: false, platforms: ['Windows', 'Linux', 'macOS'] },
      { id: 'T1491', name: 'Defacement', description: 'Adversary modifies system display', selected: false, platforms: ['Windows', 'Linux'] },
    ]
  }
]

export default function MitreAttackNavigatorView() {
  const [tactics, setTactics] = useState<TacticGroup[]>(() => loadTactics())
  const [focusedTechnique, setFocusedTechnique] = useState<FocusedTechnique | null>(null)
  const [copied, setCopied] = useState(false)
  const [svgFilterCvssOnly, setSvgFilterCvssOnly] = useState(true)
  const [svgSelectedPlatform, setSvgSelectedPlatform] = useState<string>('All')
  const [showSvgModal, setShowSvgModal] = useState(false)
  const lastCvssResult = useSecurityStore(s => s.lastCvssResult)

  // Get all unique platforms from selected techniques
  const allPlatforms = useMemo(() => {
    const platforms = new Set<string>()
    tactics.forEach(tactic => {
      tactic.techniques.forEach(tech => {
        if (tech.selected && tech.platforms) {
          tech.platforms.forEach(p => platforms.add(p))
        }
      })
    })
    return Array.from(platforms).sort()
  }, [tactics])

  // Persist tactics to localStorage whenever they change
  useEffect(() => {
    saveTactics(tactics)
  }, [tactics])

  const statistics = useMemo(() => {
    let total = 0
    let selected = 0
    tactics.forEach(tactic => {
      tactic.techniques.forEach(() => {
        total++
      })
      selected += tactic.techniques.filter(t => t.selected).length
    })
    return { total, selected, coverage: total > 0 ? Math.round((selected / total) * 100) : 0 }
  }, [tactics])

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

  const updateTechnique = (tacticId: string, techniqueId: string, updates: Partial<Technique>) => {
    setTactics(
      tactics.map(tactic =>
        tactic.id === tacticId
          ? {
              ...tactic,
              techniques: tactic.techniques.map(tech =>
                tech.id === techniqueId ? { ...tech, ...updates } : tech
              )
            }
          : tactic
      )
    )
  }

  const getTechnique = (tacticId: string, techniqueId: string): Technique | undefined => {
    const tactic = tactics.find(t => t.id === tacticId)
    return tactic?.techniques.find(t => t.id === techniqueId)
  }

  const handleClearAllScores = () => {
    if (window.confirm('Are you sure you want to clear all CVSS scores? This cannot be undone.')) {
      setTactics(
        tactics.map(tactic => ({
          ...tactic,
          techniques: tactic.techniques.map(tech => ({
            ...tech,
            cvssScore: undefined,
            cvssVector: undefined,
            cvssSeverity: undefined,
          }))
        }))
      )
    }
  }

  const getCVSSColor = (score?: number): string => {
    if (!score) return 'bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-800/50'
    if (score < 4.0) return 'bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-800/50'
    if (score < 7.0) return 'bg-orange-100 dark:bg-orange-900/30 hover:bg-orange-200 dark:hover:bg-orange-800/50'
    if (score < 9.0) return 'bg-orange-300 dark:bg-orange-700/50 hover:bg-orange-400 dark:hover:bg-orange-700/70'
    return 'bg-red-300 dark:bg-red-700/50 hover:bg-red-400 dark:hover:bg-red-700/70'
  }

  const handleImportCVSS = () => {
    if (!focusedTechnique || !lastCvssResult) return
    updateTechnique(focusedTechnique.tacticId, focusedTechnique.techniqueId, {
      cvssScore: lastCvssResult.baseScore,
      cvssVector: lastCvssResult.vector,
      cvssSeverity: lastCvssResult.baseSeverity,
    })
  }

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
          description: t.description,
          cvssScore: t.cvssScore,
          cvssVector: t.cvssVector,
          cvssSeverity: t.cvssSeverity,
          notes: t.notes,
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
    URL.revokeObjectURL(url)
  }

  const handleDownloadSVG = () => {
    const colWidth = 200
    const rowHeight = 80
    const headerHeight = 60
    const padding = 20
    const cellPadding = 8
    const legendHeight = 120
    const bottomPadding = 30

    // Filter techniques based on settings - export ALL techniques, not just selected ones
    const filteredTactics = tactics.map(tactic => ({
      ...tactic,
      techniques: tactic.techniques.filter(t => {
        if (svgFilterCvssOnly && t.cvssScore === undefined) return false
        if (svgSelectedPlatform !== 'All' && !t.platforms?.includes(svgSelectedPlatform)) return false
        return true
      })
    })).filter(t => t.techniques.length > 0)

    const maxTechniquesInTactic = Math.max(...filteredTactics.map(t => t.techniques.length), 1)
    const svgHeight = padding + legendHeight + padding + maxTechniquesInTactic * rowHeight + headerHeight + bottomPadding
    const svgWidth = filteredTactics.length * colWidth + padding * 2

    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}">`

    svgContent += `<defs><style>
      .tactic-header { font-size: 14px; font-weight: bold; fill: white; }
      .technique-id { font-size: 10px; font-weight: bold; fill: #1f2937; }
      .technique-name { font-size: 11px; fill: #1f2937; }
      .cvss-score { font-size: 10px; font-weight: bold; fill: #1f2937; }
      .legend-label { font-size: 11px; font-weight: bold; fill: #1f2937; }
      .legend-value { font-size: 10px; fill: #4b5563; }
    </style></defs>`

    // Draw legend at top
    svgContent += `<text x="${padding}" y="${padding + 15}" class="legend-label">CVSS Score Gradient Legend</text>`
    const gradientColors = [
      { range: '0.0-3.9', color: '#fef08a', label: 'Low' },
      { range: '4.0-6.9', color: '#fed7aa', label: 'Medium' },
      { range: '7.0-8.9', color: '#fca5a5', label: 'High' },
      { range: '9.0-10.0', color: '#f87171', label: 'Critical' }
    ]

    let legendX = padding
    gradientColors.forEach(({ range, color, label }) => {
      svgContent += `<rect x="${legendX}" y="${padding + 25}" width="25" height="25" fill="${color}" stroke="#999" stroke-width="1" />`
      svgContent += `<text x="${legendX + 30}" y="${padding + 42}" class="legend-value">${label} ${range}</text>`
      legendX += 180
    })

    const matrixStartY = padding + legendHeight

    // Draw tactic headers
    filteredTactics.forEach((tactic, tacticIdx) => {
      const x = padding + tacticIdx * colWidth
      const y = matrixStartY

      svgContent += `<rect x="${x}" y="${y}" width="${colWidth - 2}" height="${headerHeight}" fill="#1e40af" />`
      svgContent += `<text x="${x + cellPadding}" y="${y + 25}" class="tactic-header">${tactic.name}</text>`
      svgContent += `<text x="${x + cellPadding}" y="${y + 45}" style="font-size: 10px; fill: rgba(255,255,255,0.8);">${tactic.techniques.length} shown</text>`
    })

    // Draw technique cells
    filteredTactics.forEach((tactic, tacticIdx) => {
      tactic.techniques.forEach((technique, techniqueIdx) => {
        const x = padding + tacticIdx * colWidth
        const y = matrixStartY + headerHeight + techniqueIdx * rowHeight

        const color = technique.cvssScore
          ? technique.cvssScore < 4.0
            ? '#fef08a'
            : technique.cvssScore < 7.0
            ? '#fed7aa'
            : technique.cvssScore < 9.0
            ? '#fca5a5'
            : '#f87171'
          : '#fef08a'

        svgContent += `<rect x="${x + 2}" y="${y}" width="${colWidth - 4}" height="${rowHeight - 2}" fill="${color}" stroke="#999" stroke-width="1" />`
        svgContent += `<text x="${x + cellPadding}" y="${y + 15}" class="technique-id">${technique.id}</text>`
        svgContent += `<text x="${x + cellPadding}" y="${y + 30}" class="technique-name">${technique.name.substring(0, 18)}${technique.name.length > 18 ? '...' : ''}</text>`

        if (technique.cvssScore !== undefined) {
          svgContent += `<text x="${x + cellPadding}" y="${y + 65}" class="cvss-score">CVSS: ${technique.cvssScore}</text>`
        }

        if (technique.platforms && technique.platforms.length > 0) {
          const platformText = technique.platforms.join(', ').substring(0, 20)
          svgContent += `<text x="${x + cellPadding}" y="${y + 75}" style="font-size: 8px; fill: #666;">${platformText}</text>`
        }
      })
    })

    svgContent += '</svg>'

    const blob = new Blob([svgContent], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mitre-attack-navigator-${Date.now()}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }

  const focusedData = focusedTechnique ? getTechnique(focusedTechnique.tacticId, focusedTechnique.techniqueId) : null

  return (
    <div className="flex flex-col h-full w-full overflow-hidden gap-3 p-4">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-3">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">MITRE ATT&CK Navigator</h2>
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
          Map adversary tactics and techniques to your threat model. Click techniques to view details and assign CVSS scores.
        </p>

        {/* Statistics & Controls */}
        <div className="grid grid-cols-3 gap-2">
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
            <button
              onClick={() => setShowSvgModal(true)}
              className="flex-1 px-2 py-2 rounded text-xs bg-purple-500 hover:bg-purple-600 text-white font-medium transition-colors flex items-center justify-center gap-1"
            >
              <Download size={12} />
              SVG
            </button>
            <button
              onClick={handleClearAllScores}
              className="flex-1 px-2 py-2 rounded text-xs bg-red-500 hover:bg-red-600 text-white font-medium transition-colors flex items-center justify-center gap-1"
            >
              <X size={12} />
              Clear All
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-3 overflow-hidden">
        {/* Matrix */}
        <div className="flex-1 overflow-auto border border-gray-200 dark:border-gray-700 rounded">
          <div className="inline-flex gap-0 p-4 bg-white dark:bg-surface-800 min-w-full">
            {tactics.map((tactic) => (
              <div key={tactic.id} className="flex flex-col gap-0 w-48 flex-shrink-0">
                {/* Tactic Header */}
                <div className="bg-blue-600 dark:bg-blue-700 text-white p-3 rounded-t min-h-16 flex flex-col justify-center">
                  <h3 className="font-bold text-sm">{tactic.name}</h3>
                  <p className="text-xs opacity-75 mt-1">{tactic.techniques.filter(t => t.selected).length} selected</p>
                </div>

                {/* Techniques */}
                <div className="flex flex-col gap-1 p-2 bg-gray-50 dark:bg-surface-700 flex-shrink-0">
                  {tactic.techniques.map((technique) => (
                    <button
                      key={technique.id}
                      onClick={() => {
                        setFocusedTechnique({ tacticId: tactic.id, techniqueId: technique.id })
                        toggleTechnique(tactic.id, technique.id)
                      }}
                      className={`p-2 rounded text-left text-xs border border-gray-300 dark:border-gray-600 transition-all ${
                        technique.selected
                          ? getCVSSColor(technique.cvssScore)
                          : 'bg-white dark:bg-surface-800 hover:bg-gray-100 dark:hover:bg-surface-700'
                      }`}
                    >
                      <div className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400">{technique.id}</div>
                      <div className="font-medium text-xs line-clamp-2">{technique.name}</div>
                      {technique.cvssScore !== undefined && (
                        <div className="text-xs font-bold mt-1 text-gray-700 dark:text-gray-300">
                          CVSS: {technique.cvssScore}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail Panel */}
        {focusedData && focusedTechnique && (
          <div className="w-72 flex flex-col gap-3 bg-white dark:bg-surface-800 border border-gray-200 dark:border-gray-700 rounded p-4 overflow-y-auto">
            {/* Close Button */}
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">Technique Details</h3>
              <button
                onClick={() => setFocusedTechnique(null)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              >
                <X size={16} className="text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            {/* Technique Info */}
            <div className="space-y-3">
              <div>
                <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">ID</div>
                <div className="text-sm font-mono text-blue-600 dark:text-blue-400">{focusedData.id}</div>
              </div>

              <div>
                <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Name</div>
                <div className="text-sm font-medium text-gray-900 dark:text-white">{focusedData.name}</div>
              </div>

              <div>
                <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Description</div>
                <div className="text-xs text-gray-700 dark:text-gray-300">{focusedData.description}</div>
              </div>

              <div>
                <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Platforms</div>
                <div className="flex flex-wrap gap-1">
                  {focusedData.platforms?.map(platform => (
                    <span key={platform} className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded font-medium">
                      {platform}
                    </span>
                  )) || <span className="text-xs text-gray-500">No platforms specified</span>}
                </div>
              </div>

              {/* CVSS Section */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">CVSS Score</div>
                {focusedData.cvssScore !== undefined ? (
                  <div className="space-y-2">
                    <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded">
                      <div className="text-xs text-gray-600 dark:text-gray-400">Base Score</div>
                      <div className="text-lg font-bold text-gray-900 dark:text-white">{focusedData.cvssScore}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{focusedData.cvssSeverity}</div>
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400 break-all font-mono">
                      {focusedData.cvssVector}
                    </div>
                    <button
                      onClick={() => {
                        updateTechnique(focusedTechnique.tacticId, focusedTechnique.techniqueId, {
                          cvssScore: undefined,
                          cvssVector: undefined,
                          cvssSeverity: undefined,
                        })
                      }}
                      className="w-full px-3 py-2 text-xs rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium transition-colors"
                    >
                      Clear Score
                    </button>
                  </div>
                ) : (
                  <div>
                    {lastCvssResult ? (
                      <button
                        onClick={handleImportCVSS}
                        className="w-full px-3 py-2 text-xs rounded bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors"
                      >
                        Import CVSS ({lastCvssResult.baseScore})
                      </button>
                    ) : (
                      <div className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-700">
                        <AlertCircle size={14} className="text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-blue-700 dark:text-blue-300">Go to CVSS Calculator tab and compute a score to import it here.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Notes Section */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Notes</div>
                <textarea
                  value={focusedData.notes || ''}
                  onChange={(e) =>
                    updateTechnique(focusedTechnique.tacticId, focusedTechnique.techniqueId, {
                      notes: e.target.value,
                    })
                  }
                  className="w-full h-24 p-2 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-surface-900 text-gray-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add notes about this technique..."
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Tip */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-2 text-xs text-gray-600 dark:text-gray-400">
        <p>💡 <strong>Tip:</strong> Click technique cells to select and add details. Use the CVSS Calculator tab to compute scores, then import them here.</p>
      </div>

      {/* SVG Export Modal */}
      {showSvgModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-surface-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">SVG Export Options</h3>
              <button
                onClick={() => setShowSvgModal(false)}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
              >
                <X size={16} className="text-gray-600 dark:text-gray-400" />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              {/* CVSS Filter */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={svgFilterCvssOnly}
                    onChange={(e) => setSvgFilterCvssOnly(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Show only techniques with CVSS scores
                  </span>
                </label>
              </div>

              {/* Platform Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Filter by Platform
                </label>
                <select
                  value={svgSelectedPlatform}
                  onChange={(e) => setSvgSelectedPlatform(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-surface-900 text-gray-900 dark:text-white text-sm"
                >
                  <option>All</option>
                  {allPlatforms.map((platform) => (
                    <option key={platform} value={platform}>
                      {platform}
                    </option>
                  ))}
                </select>
              </div>

              {/* Preview Stats */}
              <div className="p-3 bg-gray-100 dark:bg-gray-700/50 rounded">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Export Preview:</p>
                <p className="text-sm font-bold text-gray-900 dark:text-white">
                  {tactics.reduce((count, tactic) => {
                    return count + tactic.techniques.filter(t => {
                      if (svgFilterCvssOnly && t.cvssScore === undefined) return false
                      if (svgSelectedPlatform !== 'All' && !t.platforms?.includes(svgSelectedPlatform)) return false
                      return true
                    }).length
                  }, 0)} techniques will be included
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Exports all techniques that match filters (not just selected ones)</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowSvgModal(false)}
                className="flex-1 px-4 py-2 rounded text-sm font-medium bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleDownloadSVG()
                  setShowSvgModal(false)
                }}
                className="flex-1 px-4 py-2 rounded text-sm font-medium bg-purple-500 hover:bg-purple-600 text-white transition-colors flex items-center justify-center gap-2"
              >
                <Download size={14} />
                Export SVG
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
