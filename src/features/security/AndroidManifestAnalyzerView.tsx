import React, { useState, useEffect } from 'react'
import { Copy, Check, AlertCircle, FolderOpen } from 'lucide-react'
import type { AnalysisResult } from './types'
import PathPickerModal from '../../components/PathPickerModal'

interface ManifestData {
  packageName: string
  versionCode?: string
  versionName?: string
  minSdkVersion?: string
  targetSdkVersion?: string
  activities: string[]
  services: string[]
  receivers: string[]
  providers: string[]
  permissions: string[]
  dangerousPermissions: string[]
  features: string[]
  intentFilters: { [key: string]: string[] }
}

type ResultTab = 'metadata' | 'components' | 'permissions' | 'intents' | 'store'
type AnalysisStatus = 'idle' | 'analyzing' | 'done' | 'error'

const DANGEROUS_PERMISSIONS = [
  'android.permission.CAMERA',
  'android.permission.RECORD_AUDIO',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.READ_CONTACTS',
  'android.permission.WRITE_CONTACTS',
  'android.permission.READ_CALENDAR',
  'android.permission.WRITE_CALENDAR',
  'android.permission.READ_CALL_LOG',
  'android.permission.WRITE_CALL_LOG',
  'android.permission.READ_SMS',
  'android.permission.SEND_SMS',
  'android.permission.RECEIVE_SMS',
  'android.permission.READ_PHONE_STATE',
  'android.permission.CALL_PHONE',
  'android.permission.READ_EXTERNAL_STORAGE',
  'android.permission.WRITE_EXTERNAL_STORAGE',
  'android.permission.GET_ACCOUNTS',
]

export default function AndroidManifestAnalyzerView() {
  const [filePath, setFilePath] = useState('')
  const [status, setStatus] = useState<AnalysisStatus>('idle')
  const [manifest, setManifest] = useState<ManifestData | null>(null)
  const [activeTab, setActiveTab] = useState<ResultTab>('metadata')
  const [copied, setCopied] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)

  const handleBrowse = () => setPickerOpen(true)

  // Auto-analyze when path is provided
  useEffect(() => {
    if (filePath.trim()) {
      runAnalysis(filePath)
    }
  }, [filePath])

  const runAnalysis = async (path: string) => {
    setStatus('analyzing')
    setManifest(null)
    setErrorMessage('')

    try {
      const analysisRes = await fetch('/security/manifest/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: path })
      })

      if (!analysisRes.ok) {
        const errorData = await analysisRes.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || `HTTP ${analysisRes.status}`)
      }

      const reader = analysisRes.body?.getReader()
      if (!reader) throw new Error('No response body')

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6))
              if (event.type === 'result') {
                setManifest(event.data)
              } else if (event.type === 'error') {
                setStatus('error')
                setErrorMessage(event.message)
              } else if (event.type === 'done') {
                if (status !== 'error') {
                  setStatus('done')
                }
              }
            } catch (e) {
              console.error('Failed to parse SSE event:', line, e)
            }
          }
        }
      }
    } catch (error) {
      setStatus('error')
      const msg = error instanceof Error ? error.message : 'Unknown error'
      setErrorMessage(msg)
    }
  }

  const handleCopyText = (value: string) => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <PathPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={path => { setFilePath(path); setPickerOpen(false) }}
        title="Select AndroidManifest.xml"
        dirOnly={false}
        fileFilter=".xml"
      />
      <div className="flex flex-col gap-4 p-4 flex-1 overflow-hidden">
        {/* File Path Input */}
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-surface-800">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            AndroidManifest.xml
          </h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={filePath}
              onChange={e => setFilePath(e.target.value)}
              placeholder="e.g. /notes/sootOutput/AndroidManifest.xml"
              className="flex-1 px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
            />
            <button
              onClick={handleBrowse}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-600 transition-colors"
              title="Browse for manifest file"
            >
              <FolderOpen size={14} />
              Browse
            </button>
          </div>
          <div className="mt-2 p-2 rounded bg-blue-100 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700">
            <p className="text-[10px] text-blue-700 dark:text-blue-300">
              <span className="font-semibold">Example:</span> /home/user/decompiled_app/AndroidManifest.xml (from apktool decode)
            </p>
          </div>
          {status === 'analyzing' && (
            <div className="mt-2 text-sm text-blue-600 dark:text-blue-400">
              ⏳ Analyzing manifest...
            </div>
          )}
          {errorMessage && (
            <div className="mt-2 p-2 rounded bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
              <p className="text-xs text-red-700 dark:text-red-300">{errorMessage}</p>
            </div>
          )}
        </div>

        {/* Results Panel */}
        {manifest ? (
          <div className="flex-1 flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-surface-800">
            <div className="flex gap-1 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-700">
              {(['metadata', 'components', 'permissions', 'intents', 'store'] as ResultTab[]).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1 text-sm rounded font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-emerald-500 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {tab === 'metadata' && 'Metadata'}
                  {tab === 'components' && 'Components'}
                  {tab === 'permissions' && `Permissions (${manifest.permissions.length})`}
                  {tab === 'intents' && 'Intent Filters'}
                  {tab === 'store' && 'Play Store'}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
              {activeTab === 'metadata' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-700">
                      <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Package</div>
                      <div className="font-mono text-sm text-gray-900 dark:text-gray-100 truncate">{manifest.packageName}</div>
                      <button
                        onClick={() => handleCopyText(manifest.packageName)}
                        className="mt-1 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                      >
                        {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} className="text-gray-500" />}
                      </button>
                    </div>
                    {manifest.versionCode && (
                      <div className="p-3 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-700">
                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Version Code</div>
                        <div className="font-mono text-sm text-gray-900 dark:text-gray-100">{manifest.versionCode}</div>
                      </div>
                    )}
                    {manifest.versionName && (
                      <div className="p-3 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-700">
                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Version</div>
                        <div className="font-mono text-sm text-gray-900 dark:text-gray-100">{manifest.versionName}</div>
                      </div>
                    )}
                    {manifest.minSdkVersion && (
                      <div className="p-3 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-700">
                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Min SDK</div>
                        <div className="font-mono text-sm text-gray-900 dark:text-gray-100">{manifest.minSdkVersion}</div>
                      </div>
                    )}
                    {manifest.targetSdkVersion && (
                      <div className="p-3 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-700">
                        <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Target SDK</div>
                        <div className="font-mono text-sm text-gray-900 dark:text-gray-100">{manifest.targetSdkVersion}</div>
                      </div>
                    )}
                  </div>
                  {manifest.features.length > 0 && (
                    <div className="mt-4">
                      <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Features</div>
                      <div className="space-y-1">
                        {manifest.features.map((feat, idx) => (
                          <div key={idx} className="p-2 rounded bg-gray-100 dark:bg-surface-700 text-xs text-gray-700 dark:text-gray-300">
                            {feat}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'components' && (
                <div className="space-y-4">
                  {manifest.activities.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                        <span className="inline-block w-2 h-2 bg-blue-500 rounded-full"></span>
                        Activities ({manifest.activities.length})
                      </div>
                      <div className="space-y-1">
                        {manifest.activities.map((act, idx) => (
                          <div key={idx} className="p-2 rounded bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-700 text-xs text-gray-700 dark:text-gray-300 font-mono truncate">
                            {act}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {manifest.services.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                        <span className="inline-block w-2 h-2 bg-purple-500 rounded-full"></span>
                        Services ({manifest.services.length})
                      </div>
                      <div className="space-y-1">
                        {manifest.services.map((svc, idx) => (
                          <div key={idx} className="p-2 rounded bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-700 text-xs text-gray-700 dark:text-gray-300 font-mono truncate">
                            {svc}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {manifest.receivers.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                        <span className="inline-block w-2 h-2 bg-orange-500 rounded-full"></span>
                        Broadcast Receivers ({manifest.receivers.length})
                      </div>
                      <div className="space-y-1">
                        {manifest.receivers.map((rcv, idx) => (
                          <div key={idx} className="p-2 rounded bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-700 text-xs text-gray-700 dark:text-gray-300 font-mono truncate">
                            {rcv}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {manifest.providers.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1">
                        <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                        Content Providers ({manifest.providers.length})
                      </div>
                      <div className="space-y-1">
                        {manifest.providers.map((prov, idx) => (
                          <div key={idx} className="p-2 rounded bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-700 text-xs text-gray-700 dark:text-gray-300 font-mono truncate">
                            {prov}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {manifest.activities.length === 0 && manifest.services.length === 0 && manifest.receivers.length === 0 && manifest.providers.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No components found.</p>
                  )}
                </div>
              )}

              {activeTab === 'permissions' && (
                <div className="space-y-3">
                  {manifest.dangerousPermissions.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle size={14} className="text-red-500" />
                        <span className="text-xs font-semibold text-red-700 dark:text-red-400">Dangerous Permissions ({manifest.dangerousPermissions.length})</span>
                      </div>
                      <div className="space-y-1 mb-4">
                        {manifest.dangerousPermissions.map((perm, idx) => (
                          <div key={idx} className="p-2 rounded bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-700 text-xs text-gray-700 dark:text-gray-300">
                            <div className="font-mono text-red-700 dark:text-red-400">{perm}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {manifest.permissions.length > 0 && (
                    <div>
                      <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">All Permissions ({manifest.permissions.length})</div>
                      <div className="space-y-1">
                        {manifest.permissions.map((perm, idx) => (
                          <div key={idx} className="p-2 rounded bg-gray-100 dark:bg-surface-700 text-xs text-gray-700 dark:text-gray-300 font-mono">
                            {perm}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {manifest.permissions.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No permissions requested.</p>
                  )}
                </div>
              )}

              {activeTab === 'intents' && (
                <div className="space-y-3">
                  {Object.keys(manifest.intentFilters).length > 0 ? (
                    Object.entries(manifest.intentFilters).map(([component, actions], idx) => (
                      <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
                        <div className="p-2 bg-gray-100 dark:bg-surface-700 text-xs font-semibold text-gray-700 dark:text-gray-300">
                          {component}
                        </div>
                        <div className="p-2 space-y-1">
                          {actions.map((action, aidx) => (
                            <div key={aidx} className="text-xs text-gray-700 dark:text-gray-300 font-mono bg-gray-50 dark:bg-surface-800 p-1 rounded">
                              {action}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No intent filters found.</p>
                  )}
                </div>
              )}

              {activeTab === 'store' && (
                <div className="flex flex-col h-full" style={{ minHeight: '500px' }}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs text-gray-600 dark:text-gray-400 font-mono truncate">
                      https://play.google.com/store/apps/details?id={manifest.packageName}
                    </span>
                    <a
                      href={`https://play.google.com/store/apps/details?id=${manifest.packageName}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-600 transition-colors"
                    >
                      Open in browser
                    </a>
                  </div>
                  <iframe
                    src={`/security/manifest/store-proxy?pkg=${encodeURIComponent(manifest.packageName)}`}
                    className="flex-1 w-full rounded border border-gray-200 dark:border-gray-700"
                    style={{ minHeight: '460px' }}
                    title="Google Play Store"
                  />
                </div>
              )}
            </div>
          </div>
        ) : status === 'idle' && !errorMessage ? (
          <div className="flex-1 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-surface-700">
            <div className="text-center">
              <p className="text-gray-500 dark:text-gray-400 mb-2">Enter AndroidManifest.xml path to analyze</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Example: ~/decompiled_app/AndroidManifest.xml</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
