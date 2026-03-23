import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import type { AnalysisResult, ApkAnalyzerConfig } from './types'
import { API_CATEGORY_COLORS } from './types'

interface ApkFile {
  name: string
  path: string
}

type ResultTab = 'apis' | 'strings' | 'classes' | 'libraries'
type AnalysisStatus = 'idle' | 'uploading' | 'analyzing' | 'done' | 'error'

export default function ApkAnalyzerView() {
  const [apkFile, setApkFile] = useState<ApkFile | null>(null)
  const [status, setStatus] = useState<AnalysisStatus>('idle')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [activeTab, setActiveTab] = useState<ResultTab>('apis')
  const [stringTypeFilter, setStringTypeFilter] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [apkPath, setApkPath] = useState('')


  const processApkPath = async (path: string) => {
    if (!path.trim()) {
      alert('Please enter a valid APK path')
      return
    }

    setResult(null)
    const fileName = path.split('/').pop() || 'app.apk'
    setApkFile({ name: fileName, path })
    await runAnalysis(path)
  }

  const runAnalysis = async (apkPath: string) => {
    setStatus('analyzing')
    setResult(null)

    try {
      const analysisRes = await fetch('/security/apk/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apkPath })
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
                console.error('Backend error:', event.message)
                alert(`Analysis error: ${event.message}`)
              } else if (event.type === 'progress') {
                console.log('Progress:', event.message)
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
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }


  const handleCopyString = (value: string) => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div className="flex flex-1 gap-4 p-4 overflow-hidden">
        {/* APK Path Input */}
        <div className="flex-shrink-0 w-80 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-surface-800 overflow-y-auto scrollbar-thin flex flex-col">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            APK File
          </h3>

          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
              APK Path
            </label>
            <input
              type="text"
              value={apkPath}
              onChange={e => setApkPath(e.target.value)}
              placeholder="e.g. ~/Documents/app.apk"
              className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>

          {apkFile && (
            <div className="mb-4 p-2 rounded bg-emerald-100 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300 truncate">
                    {apkFile.name}
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    {apkFile.path}
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={() => processApkPath(apkPath)}
            disabled={!apkPath.trim() || status === 'analyzing'}
            className="w-full px-3 py-2 rounded bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white dark:text-white text-sm font-medium transition-colors disabled:cursor-not-allowed"
          >
            {status === 'analyzing' ? 'Analyzing...' : '▶ Run Analysis'}
          </button>

          <div className="mt-4 p-2 rounded bg-blue-100 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700">
            <p className="text-[10px] text-blue-700 dark:text-blue-300">
              <span className="font-semibold">Example:</span> /home/user/app.apk or ~/Downloads/test.apk
            </p>
          </div>
        </div>


        {/* Results panel */}
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
        ) : status !== 'idle' ? (
          <div className="flex-1 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800">
            <div className="text-center">
              <div className="text-4xl mb-2">⏳</div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {status === 'uploading' ? 'Uploading APK...' : 'Analyzing...'}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-surface-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">Analysis results will appear here</p>
          </div>
        )}
      </div>

      {/* Terminal */}
      <div className="flex-shrink-0 h-48 border-t border-gray-200 dark:border-gray-700 bg-gray-900 dark:bg-black overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800">
          <div className="flex items-center gap-2">
            <Terminal size={16} className="text-gray-400" />
            <span className="text-xs font-semibold text-gray-300">Terminal - Use for Soot setup and configuration</span>
          </div>
          <button
            onClick={() => setTerminalVisible(!terminalVisible)}
            className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
          >
            {terminalVisible ? 'Hide' : 'Show'}
          </button>
        </div>
        {terminalVisible && (
          <React.Suspense fallback={<div className="flex-1 bg-gray-900 flex items-center justify-center text-gray-400">Loading terminal...</div>}>
            <div className="flex-1 overflow-hidden">
              <TerminalPanel ref={terminalRef} />
            </div>
          </React.Suspense>
        )}
      </div>
    </div>
  )
}
