import React, { useState, useEffect } from 'react'
import { Copy, Check, FolderOpen, HelpCircle, X } from 'lucide-react'
import type { AnalysisResult } from './types'
import { API_CATEGORY_COLORS } from './types'

type ResultTab = 'apis' | 'strings' | 'classes' | 'libraries'
type AnalysisStatus = 'idle' | 'analyzing' | 'done' | 'error'

function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-800 shadow-2xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Jimple Analyzer — Help</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X size={16} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="space-y-5 text-sm text-gray-700 dark:text-gray-300">

          <section>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">What is Jimple?</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Jimple is a simplified, typed, 3-address intermediate representation (IR) produced by the Soot framework when decompiling Android APKs. Each <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">.jimple</code> file corresponds to one Java/Kotlin class from the app. Analyzing Jimple lets you inspect what an app actually does at the bytecode level without needing source code.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Controls</h3>
            <div className="space-y-2">
              <div className="flex gap-3">
                <span className="shrink-0 font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded h-fit">Folder Path input</span>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">Type or paste the full path to a folder containing <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">.jimple</code> files (e.g. the output directory from the Soot Compiler tab). Analysis starts automatically when the path changes.</p>
              </div>
              <div className="flex gap-3">
                <span className="shrink-0 font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded h-fit">Browse button</span>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">Opens a native folder picker dialog. The full absolute path of the selected folder is populated into the input and analysis begins immediately.</p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Result Tabs</h3>
            <div className="space-y-3">

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold bg-emerald-500 text-white px-2 py-0.5 rounded">APIs</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  Shows sensitive Android API calls detected across all classes, grouped by category (e.g. Location, Camera, Network, Crypto). Each entry shows the full method signature and the class it was called from. High-interest API categories are colour-coded. This is the primary tab for spotting potentially dangerous or privacy-sensitive behavior.
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold bg-emerald-500 text-white px-2 py-0.5 rounded">Strings</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  Lists interesting string constants extracted from the bytecode, classified by type:
                </p>
                <ul className="mt-1 ml-3 space-y-0.5 text-xs text-gray-600 dark:text-gray-400 list-disc list-inside">
                  <li><span className="font-medium">URL</span> — http/https endpoints the app communicates with</li>
                  <li><span className="font-medium">IP</span> — hardcoded IP addresses</li>
                  <li><span className="font-medium">Email</span> — email addresses embedded in the code</li>
                  <li><span className="font-medium">Base64</span> — base64-encoded blobs (may contain hidden data)</li>
                  <li><span className="font-medium">Path</span> — filesystem paths referenced by the app</li>
                  <li><span className="font-medium">Other</span> — other notable strings that don't fit the above categories</li>
                </ul>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">Use the filter buttons to show only specific types. Click the copy icon to copy any string to the clipboard.</p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold bg-emerald-500 text-white px-2 py-0.5 rounded">Classes</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  Lists every class found in the Jimple output. Classes identified as Android <span className="font-medium">Activities</span>, <span className="font-medium">Services</span>, or <span className="font-medium">Receivers</span> are tagged. Expand any class to see its superclass, implemented interfaces, and method signatures.
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold bg-emerald-500 text-white px-2 py-0.5 rounded">Libraries</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  Detects third-party libraries bundled into the APK by matching class package patterns against a known-library database. Each entry shows the library name, the package pattern that matched, the number of classes found, and a confidence level (<span className="font-medium">High</span> or <span className="font-medium">Medium</span>). Useful for identifying ad SDKs, analytics, crash reporters, and other embedded dependencies.
                </p>
              </div>

            </div>
          </section>

          <section>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">Typical Workflow</h3>
            <ol className="ml-4 space-y-1 text-xs text-gray-600 dark:text-gray-400 list-decimal list-outside leading-relaxed">
              <li>Use the <span className="font-medium">Soot Compiler</span> tab to convert an APK into Jimple files and note the output directory.</li>
              <li>Switch to the <span className="font-medium">Jimple Analyzer</span> tab and enter (or Browse to) that output directory.</li>
              <li>Review <span className="font-medium">APIs</span> for sensitive permission usage and dangerous calls.</li>
              <li>Check <span className="font-medium">Strings</span> for hardcoded URLs, IPs, and encoded payloads.</li>
              <li>Inspect <span className="font-medium">Classes</span> to understand the app structure and entry points.</li>
              <li>Look at <span className="font-medium">Libraries</span> to identify bundled third-party SDKs.</li>
            </ol>
          </section>

        </div>
      </div>
    </div>
  )
}

export default function JimpleAnalyzerView() {
  const [folderPath, setFolderPath] = useState('')
  const [status, setStatus] = useState<AnalysisStatus>('idle')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [activeTab, setActiveTab] = useState<ResultTab>('apis')
  const [stringTypeFilter, setStringTypeFilter] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [browsing, setBrowsing] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const handleBrowse = async () => {
    setBrowsing(true)
    try {
      const res = await fetch('http://localhost:3001/security/jimple/browse')
      if (res.status === 204) return // user cancelled
      if (!res.ok) throw new Error(`Browse failed: ${res.status}`)
      const { path } = await res.json()
      if (path) setFolderPath(path)
    } catch {
      // server unavailable — silently ignore so user can still type manually
    } finally {
      setBrowsing(false)
    }
  }

  // Auto-analyze when path is provided
  useEffect(() => {
    if (folderPath.trim()) {
      runAnalysis(folderPath)
    }
  }, [folderPath])

  const runAnalysis = async (path: string) => {
    setStatus('analyzing')
    setResult(null)
    setErrorMessage('')

    try {
      const analysisRes = await fetch('/security/jimple/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath: path })
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
                setResult(event.data)
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

  const handleCopyString = (value: string) => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}
      <div className="flex flex-col gap-4 p-4 flex-1 overflow-hidden">
        {/* Folder Path Input */}
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-surface-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Jimple Folder
            </h3>
            <button
              onClick={() => setShowHelp(true)}
              title="Help"
              className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors"
            >
              <HelpCircle size={13} />
              Help
            </button>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={folderPath}
              onChange={e => setFolderPath(e.target.value)}
              placeholder="e.g. /home/user/soot_output/jimple"
              className="flex-1 px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
            />
            <button
              onClick={handleBrowse}
              disabled={browsing}
              title="Browse for folder"
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-600 transition-colors disabled:opacity-50"
            >
              <FolderOpen size={14} />
              {browsing ? 'Opening…' : 'Browse'}
            </button>
          </div>
          <div className="mt-2 p-2 rounded bg-blue-100 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700">
            <p className="text-[10px] text-blue-700 dark:text-blue-300">
              <span className="font-semibold">Example:</span> /home/user/soot_output/jimple (folder containing .jimple files from Soot)
            </p>
          </div>
          {status === 'analyzing' && (
            <div className="mt-2 text-sm text-blue-600 dark:text-blue-400">
              ⏳ Analyzing jimple files...
            </div>
          )}
          {errorMessage && (
            <div className="mt-2 p-2 rounded bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
              <p className="text-xs text-red-700 dark:text-red-300">{errorMessage}</p>
            </div>
          )}
        </div>

        {/* Results Panel */}
        {result ? (
          <div className="flex-1 flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-surface-800">
            <div className="flex gap-1 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-700">
              {['apis', 'strings', 'classes', 'libraries'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as ResultTab)}
                  className={`px-3 py-1 text-sm rounded font-medium transition-colors ${
                    activeTab === tab
                      ? 'bg-emerald-500 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {tab === 'apis' && `APIs (${result.sensitiveApis.length})`}
                  {tab === 'strings' && `Strings (${result.strings.length})`}
                  {tab === 'classes' && `Classes (${result.classes.length})`}
                  {tab === 'libraries' && `Libraries (${result.libraries.length})`}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
              {activeTab === 'apis' && (
                <div className="space-y-3">
                  {result.sensitiveApis.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No sensitive APIs found.</p>
                  ) : (
                    Object.entries(
                      result.sensitiveApis.reduce(
                        (acc, call) => {
                          if (!acc[call.category]) acc[call.category] = []
                          acc[call.category].push(call)
                          return acc
                        },
                        {} as Record<string, typeof result.sensitiveApis>
                      )
                    )
                      .sort((a, b) => b[1].length - a[1].length)
                      .map(([category, calls]) => {
                        const colorInfo = API_CATEGORY_COLORS[category] || { color: '#6366f1', icon: '🔍' }
                        return (
                          <div key={category} className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{colorInfo.icon}</span>
                              <span className="px-2 py-0.5 rounded text-xs font-semibold text-white" style={{ backgroundColor: colorInfo.color }}>
                                {category} ({calls.length})
                              </span>
                            </div>
                            <div className="ml-6 space-y-1">
                              {calls.map((call, idx) => (
                                <div key={idx} className="text-xs">
                                  <div className="font-mono text-gray-700 dark:text-gray-300 truncate">{call.api}</div>
                                  <div className="text-gray-500 dark:text-gray-400 text-[10px]">from {call.calledFrom}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })
                  )}
                </div>
              )}

              {activeTab === 'strings' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1 mb-3">
                    {['URL', 'IP', 'Email', 'Base64', 'Path', 'Other'].map(type => (
                      <button
                        key={type}
                        onClick={() => setStringTypeFilter(f => f.includes(type) ? f.filter(x => x !== type) : [...f, type])}
                        className={`px-2 py-1 text-xs rounded font-medium transition-colors ${
                          stringTypeFilter.includes(type)
                            ? 'bg-emerald-500 text-white'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  {result.strings.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No interesting strings found.</p>
                  ) : (
                    <div className="space-y-2">
                      {result.strings
                        .filter(s => stringTypeFilter.length === 0 || stringTypeFilter.includes(s.type))
                        .map((str, idx) => (
                          <div key={idx} className="p-2 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-700">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 mb-1">
                                  {str.type}
                                </div>
                                <div className="font-mono text-xs text-gray-700 dark:text-gray-300 break-all">{str.value}</div>
                                <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">{str.foundIn}</div>
                              </div>
                              <button onClick={() => handleCopyString(str.value)} className="flex-shrink-0 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors">
                                {copied ? <Check size={14} className="text-green-600 dark:text-green-400" /> : <Copy size={14} className="text-gray-500 dark:text-gray-400" />}
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'classes' && (
                <div className="space-y-2">
                  {result.classes.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No classes found.</p>
                  ) : (
                    result.classes.map((cls, idx) => (
                      <details key={idx} className="border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
                        <summary className="p-2 bg-gray-50 dark:bg-surface-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-surface-600 text-sm font-medium text-gray-700 dark:text-gray-300">
                          <div className="flex items-center gap-2">
                            {cls.isActivity && <span className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded">Activity</span>}
                            {cls.isService && <span className="text-xs bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 px-1.5 py-0.5 rounded">Service</span>}
                            {cls.isReceiver && <span className="text-xs bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 px-1.5 py-0.5 rounded">Receiver</span>}
                            <span className="font-mono text-xs">{cls.name}</span>
                          </div>
                        </summary>
                        <div className="p-3 bg-white dark:bg-surface-800 space-y-2 border-t border-gray-200 dark:border-gray-700">
                          {cls.superClass && <div className="text-xs text-gray-600 dark:text-gray-400"><span className="font-semibold">Extends:</span> {cls.superClass}</div>}
                          {cls.interfaces.length > 0 && <div className="text-xs text-gray-600 dark:text-gray-400"><span className="font-semibold">Implements:</span> {cls.interfaces.join(', ')}</div>}
                          {cls.methods.length > 0 && (
                            <div>
                              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Methods:</div>
                              <div className="space-y-1">
                                {cls.methods.map((m, midx) => (
                                  <div key={midx} className="text-[10px] font-mono text-gray-600 dark:text-gray-400 truncate">
                                    {m.modifiers} {m.returnType} {m.name}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </details>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'libraries' && (
                <div className="space-y-2">
                  {result.libraries.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">No libraries detected.</p>
                  ) : (
                    result.libraries
                      .sort((a, b) => b.classCount - a.classCount)
                      .map((lib, idx) => (
                        <div key={idx} className="p-3 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-700">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="font-medium text-sm text-gray-700 dark:text-gray-300">{lib.name}</div>
                            <span className="text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded">
                              {lib.confidence === 'high' ? '✓ High' : '~ Medium'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-600 dark:text-gray-400 font-mono mb-1">{lib.packagePattern}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{lib.classCount} classes</div>
                        </div>
                      ))
                  )}
                </div>
              )}
            </div>
          </div>
        ) : status === 'idle' && !errorMessage ? (
          <div className="flex-1 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-surface-700">
            <div className="text-center">
              <p className="text-gray-500 dark:text-gray-400 mb-2">Enter a jimple folder path to analyze</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Example: ~/soot_output/jimple</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
