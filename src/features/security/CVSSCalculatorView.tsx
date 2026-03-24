import React, { useState, useMemo } from 'react'
import { Copy, Check } from 'lucide-react'

type CVSSVersion = '3.1' | '2.0'

// CVSS 3.1 Metrics
interface CVSS31Metrics {
  // Base Metrics
  AV: 'N' | 'A' | 'L' | 'P' // Attack Vector: Network, Adjacent, Local, Physical
  AT: 'N' | 'L' // Attack Complexity: Low, High
  PR: 'N' | 'L' | 'H' // Privileges Required: None, Low, High
  UI: 'N' | 'R' // User Interaction: None, Required
  S: 'U' | 'C' // Scope: Unchanged, Changed
  C: 'H' | 'L' | 'N' // Confidentiality: High, Low, None
  I: 'H' | 'L' | 'N' // Integrity: High, Low, None
  A: 'H' | 'L' | 'N' // Availability: High, Low, None

  // Temporal Metrics (optional)
  E?: 'X' | 'P' | 'F' | 'U' | 'O' // Exploit Code Maturity
  RL?: 'X' | 'O' | 'T' | 'W' | 'U' // Remediation Level
  RC?: 'X' | 'C' | 'R' | 'U' // Report Confidence

  // Environmental Metrics (optional)
  CR?: 'X' | 'H' | 'M' | 'L' // Confidentiality Requirement
  IR?: 'X' | 'H' | 'M' | 'L' // Integrity Requirement
  AR?: 'X' | 'H' | 'M' | 'L' // Availability Requirement
  MAV?: 'X' | 'N' | 'A' | 'L' | 'P' // Modified Attack Vector
  MAC?: 'X' | 'L' | 'H' // Modified Attack Complexity
  MPR?: 'X' | 'N' | 'L' | 'H' // Modified Privileges Required
  MUI?: 'X' | 'N' | 'R' // Modified User Interaction
  MS?: 'X' | 'U' | 'C' // Modified Scope
  MC?: 'X' | 'H' | 'L' | 'N' // Modified Confidentiality
  MI?: 'X' | 'H' | 'L' | 'N' // Modified Integrity
  MA?: 'X' | 'H' | 'L' | 'N' // Modified Availability
}

interface CVSSResult {
  baseScore: number
  baseSeverity: string
  temporalScore?: number
  temporalSeverity?: string
  environmentalScore?: number
  environmentalSeverity?: string
  vector: string
}

export default function CVSSCalculatorView() {
  const [version, setVersion] = useState<CVSSVersion>('3.1')
  const [copied, setCopied] = useState(false)
  const [metrics, setMetrics] = useState<CVSS31Metrics>({
    AV: 'N',
    AT: 'L',
    PR: 'N',
    UI: 'N',
    S: 'U',
    C: 'N',
    I: 'N',
    A: 'N',
  })
  const [showAdvanced, setShowAdvanced] = useState(false)

  // CVSS 3.1 Score Calculation
  const calculateCVSS31 = (m: CVSS31Metrics): CVSSResult => {
    // Attack Vector values
    const AVScore = { N: 0.85, A: 0.62, L: 0.55, P: 0.2 }
    // Attack Complexity values
    const ATScore = { L: 0.77, H: 0.44 }
    // Privileges Required values (depends on Scope)
    const PRScore = { U: { N: 0.85, L: 0.62, H: 0.27 }, C: { N: 0.85, L: 0.68, H: 0.5 } }
    // User Interaction values
    const UIScore = { N: 0.85, R: 0.62 }
    // Scope values
    const SScore = { U: 0.0, C: 1.0 }
    // CIA values
    const CIAScore = { H: 0.56, L: 0.22, N: 0.0 }

    // Base Score Calculation
    const scopeChanged = m.S === 'C'
    const prValue = PRScore[scopeChanged ? 'C' : 'U'][m.PR]
    const impact = scopeChanged
      ? 7.52 * (1 - (1 - CIAScore[m.C]) * (1 - CIAScore[m.I]) * (1 - CIAScore[m.A])) - 0.029
      : 6.42 * (1 - (1 - CIAScore[m.C]) * (1 - CIAScore[m.I]) * (1 - CIAScore[m.A]))

    const exploitability = 8.22 * AVScore[m.AV] * ATScore[m.AT] * prValue * UIScore[m.UI]
    const baseScore = scopeChanged ? Math.min(1.08 * (exploitability + impact), 10) : Math.min(exploitability + impact, 10)

    const roundScore = (score: number) => Math.round(score * 10) / 10

    const getSeverity = (score: number): string => {
      if (score === 0) return 'None'
      if (score < 4.0) return 'Low'
      if (score < 7.0) return 'Medium'
      if (score < 9.0) return 'High'
      return 'Critical'
    }

    const baseScoreRounded = roundScore(baseScore)

    // Temporal Score (if provided)
    const E = { X: 1.0, P: 0.97, F: 0.97, U: 0.91, O: 0.87 }[m.E || 'X']
    const RL = { X: 1.0, O: 0.95, T: 0.96, W: 0.97, U: 1.0 }[m.RL || 'X']
    const RC = { X: 1.0, C: 1.0, R: 0.96, U: 0.92 }[m.RC || 'X']
    const temporalScore = m.E || m.RL || m.RC ? roundScore(baseScoreRounded * E * RL * RC) : undefined

    // Environmental Score (if provided)
    let environmentalScore: number | undefined = undefined
    if (m.CR || m.IR || m.AR || m.MAV) {
      const CR = { X: 1.0, H: 1.5, M: 1.0, L: 0.5 }[m.CR || 'X']
      const IR = { X: 1.0, H: 1.5, M: 1.0, L: 0.5 }[m.IR || 'X']
      const AR = { X: 1.0, H: 1.5, M: 1.0, L: 0.5 }[m.AR || 'X']

      // Modified Base Score
      const mAV = m.MAV ? { N: 0.85, A: 0.62, L: 0.55, P: 0.2 }[m.MAV] : AVScore[m.AV]
      const mAT = m.MAC ? { L: 0.77, H: 0.44 }[m.MAC] : ATScore[m.AT]
      const mS = m.MS || m.S
      const mPR = m.MPR ? PRScore[mS === 'C' ? 'C' : 'U'][m.MPR] : prValue
      const mUI = m.MUI ? { N: 0.85, R: 0.62 }[m.MUI] : UIScore[m.UI]
      const mC = m.MC ? { H: 0.56, L: 0.22, N: 0.0 }[m.MC] : CIAScore[m.C]
      const mI = m.MI ? { H: 0.56, L: 0.22, N: 0.0 }[m.MI] : CIAScore[m.I]
      const mA = m.MA ? { H: 0.56, L: 0.22, N: 0.0 }[m.MA] : CIAScore[m.A]

      const scopeChangedM = mS === 'C'
      const mImpact = scopeChangedM
        ? 7.52 * (1 - (1 - mC) * (1 - mI) * (1 - mA)) - 0.029
        : 6.42 * (1 - (1 - mC) * (1 - mI) * (1 - mA))

      const mExploitability = 8.22 * mAV * mAT * mPR * mUI
      const modifiedBaseScore = scopeChangedM
        ? Math.min(1.08 * (mExploitability + mImpact), 10)
        : Math.min(mExploitability + mImpact, 10)

      environmentalScore = roundScore(Math.min(modifiedBaseScore * CR * IR * AR, 10) * E * RL * RC)
    }

    // Build CVSS Vector
    const parts = [
      `CVSS:3.1/AV:${m.AV}/AT:${m.AT}/PR:${m.PR}/UI:${m.UI}/S:${m.S}/C:${m.C}/I:${m.I}/A:${m.A}`,
    ]
    if (m.E || m.RL || m.RC) {
      parts.push(`E:${m.E || 'X'}`)
      parts.push(`RL:${m.RL || 'X'}`)
      parts.push(`RC:${m.RC || 'X'}`)
    }
    if (m.CR || m.IR || m.AR || m.MAV) {
      parts.push(`CR:${m.CR || 'X'}`)
      parts.push(`IR:${m.IR || 'X'}`)
      parts.push(`AR:${m.AR || 'X'}`)
      parts.push(`MAV:${m.MAV || 'X'}`)
      parts.push(`MAC:${m.MAC || 'X'}`)
      parts.push(`MPR:${m.MPR || 'X'}`)
      parts.push(`MUI:${m.MUI || 'X'}`)
      parts.push(`MS:${m.MS || 'X'}`)
      parts.push(`MC:${m.MC || 'X'}`)
      parts.push(`MI:${m.MI || 'X'}`)
      parts.push(`MA:${m.MA || 'X'}`)
    }

    return {
      baseScore: baseScoreRounded,
      baseSeverity: getSeverity(baseScoreRounded),
      temporalScore,
      temporalSeverity: temporalScore ? getSeverity(temporalScore) : undefined,
      environmentalScore,
      environmentalSeverity: environmentalScore ? getSeverity(environmentalScore) : undefined,
      vector: parts.join('/'),
    }
  }

  const result = useMemo(() => calculateCVSS31(metrics), [metrics])

  const handleMetricChange = (key: keyof CVSS31Metrics, value: any) => {
    setMetrics(prev => ({ ...prev, [key]: value }))
  }

  const handleCopyVector = () => {
    navigator.clipboard.writeText(result.vector)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'Critical':
        return { bg: 'bg-red-100 dark:bg-red-900/20', text: 'text-red-700 dark:text-red-400', border: 'border-red-300 dark:border-red-700' }
      case 'High':
        return { bg: 'bg-orange-100 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-300 dark:border-orange-700' }
      case 'Medium':
        return { bg: 'bg-yellow-100 dark:bg-yellow-900/20', text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-300 dark:border-yellow-700' }
      case 'Low':
        return { bg: 'bg-blue-100 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-300 dark:border-blue-700' }
      default:
        return { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300', border: 'border-gray-300 dark:border-gray-700' }
    }
  }

  const ScoreDisplay = ({ label, score, severity }: { label: string; score?: number; severity?: string }) => {
    if (score === undefined) return null
    const colors = getSeverityColor(severity || '')
    return (
      <div className={`p-4 rounded border-2 ${colors.bg} ${colors.border}`}>
        <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{label}</div>
        <div className="flex items-baseline gap-3">
          <div className={`text-3xl font-bold ${colors.text}`}>{score.toFixed(1)}</div>
          <div className={`text-sm font-semibold ${colors.text}`}>{severity}</div>
        </div>
      </div>
    )
  }

  const MetricSelector = ({ label, value, onChange, options, description }: { label: string; value: string; onChange: (v: string) => void; options: string[]; description: string }) => (
    <div className="border border-gray-200 dark:border-gray-700 rounded p-3">
      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">{label}</label>
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">{description}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-auto">
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
              value === opt
                ? 'bg-emerald-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full w-full overflow-hidden gap-4 p-4">
      {/* Version Selector */}
      <div className="flex gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setVersion('3.1')}
          className={`px-4 py-2 rounded font-medium text-sm transition-colors ${
            version === '3.1'
              ? 'bg-emerald-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300'
          }`}
        >
          CVSS 3.1
        </button>
        <button
          onClick={() => setVersion('2.0')}
          disabled
          className="px-4 py-2 rounded font-medium text-sm text-gray-400 cursor-not-allowed"
        >
          CVSS 2.0 (Coming Soon)
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin space-y-4">
        {/* Score Results */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ScoreDisplay label="Base Score" score={result.baseScore} severity={result.baseSeverity} />
          {result.temporalScore !== undefined && (
            <ScoreDisplay label="Temporal Score" score={result.temporalScore} severity={result.temporalSeverity} />
          )}
          {result.environmentalScore !== undefined && (
            <ScoreDisplay label="Environmental Score" score={result.environmentalScore} severity={result.environmentalSeverity} />
          )}
        </div>

        {/* CVSS Vector String */}
        <div className="p-4 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-700">
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">CVSS Vector</label>
          <div className="flex gap-2 items-start">
            <code className="flex-1 text-xs bg-gray-100 dark:bg-surface-800 p-2 rounded font-mono text-gray-900 dark:text-gray-100 break-all">
              {result.vector}
            </code>
            <button
              onClick={handleCopyVector}
              className="flex-shrink-0 p-2 hover:bg-gray-200 dark:hover:bg-surface-600 rounded transition-colors"
            >
              {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} className="text-gray-500" />}
            </button>
          </div>
        </div>

        {/* Base Metrics */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Base Metrics</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MetricSelector
              label="Attack Vector (AV)"
              value={metrics.AV}
              onChange={v => handleMetricChange('AV', v)}
              options={['N', 'A', 'L', 'P']}
              description="Network, Adjacent, Local, Physical"
            />
            <MetricSelector
              label="Attack Complexity (AT)"
              value={metrics.AT}
              onChange={v => handleMetricChange('AT', v)}
              options={['L', 'H']}
              description="Low, High"
            />
            <MetricSelector
              label="Privileges Required (PR)"
              value={metrics.PR}
              onChange={v => handleMetricChange('PR', v)}
              options={['N', 'L', 'H']}
              description="None, Low, High"
            />
            <MetricSelector
              label="User Interaction (UI)"
              value={metrics.UI}
              onChange={v => handleMetricChange('UI', v)}
              options={['N', 'R']}
              description="None, Required"
            />
            <MetricSelector
              label="Scope (S)"
              value={metrics.S}
              onChange={v => handleMetricChange('S', v)}
              options={['U', 'C']}
              description="Unchanged, Changed"
            />
            <MetricSelector
              label="Confidentiality (C)"
              value={metrics.C}
              onChange={v => handleMetricChange('C', v)}
              options={['N', 'L', 'H']}
              description="None, Low, High"
            />
            <MetricSelector
              label="Integrity (I)"
              value={metrics.I}
              onChange={v => handleMetricChange('I', v)}
              options={['N', 'L', 'H']}
              description="None, Low, High"
            />
            <MetricSelector
              label="Availability (A)"
              value={metrics.A}
              onChange={v => handleMetricChange('A', v)}
              options={['N', 'L', 'H']}
              description="None, Low, High"
            />
          </div>
        </div>

        {/* Advanced Metrics */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
        >
          {showAdvanced ? '▼ Hide' : '▶ Show'} Advanced Metrics (Temporal & Environmental)
        </button>

        {showAdvanced && (
          <>
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Temporal Metrics (Optional)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <MetricSelector
                  label="Exploit Code Maturity (E)"
                  value={metrics.E || 'X'}
                  onChange={v => handleMetricChange('E', v === 'X' ? undefined : v)}
                  options={['X', 'P', 'F', 'U', 'O']}
                  description="Unproven, Proof of Concept, Functional, Unproven, Official"
                />
                <MetricSelector
                  label="Remediation Level (RL)"
                  value={metrics.RL || 'X'}
                  onChange={v => handleMetricChange('RL', v === 'X' ? undefined : v)}
                  options={['X', 'O', 'T', 'W', 'U']}
                  description="Unknown, Official, Temporary, Workaround, Unavailable"
                />
                <MetricSelector
                  label="Report Confidence (RC)"
                  value={metrics.RC || 'X'}
                  onChange={v => handleMetricChange('RC', v === 'X' ? undefined : v)}
                  options={['X', 'C', 'R', 'U']}
                  description="Unknown, Confirmed, Reasonable, Unconfirmed"
                />
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Environmental Metrics (Optional)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <MetricSelector
                  label="Confidentiality Requirement (CR)"
                  value={metrics.CR || 'X'}
                  onChange={v => handleMetricChange('CR', v === 'X' ? undefined : v)}
                  options={['X', 'L', 'M', 'H']}
                  description="Low, Medium, High"
                />
                <MetricSelector
                  label="Integrity Requirement (IR)"
                  value={metrics.IR || 'X'}
                  onChange={v => handleMetricChange('IR', v === 'X' ? undefined : v)}
                  options={['X', 'L', 'M', 'H']}
                  description="Low, Medium, High"
                />
                <MetricSelector
                  label="Availability Requirement (AR)"
                  value={metrics.AR || 'X'}
                  onChange={v => handleMetricChange('AR', v === 'X' ? undefined : v)}
                  options={['X', 'L', 'M', 'H']}
                  description="Low, Medium, High"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
