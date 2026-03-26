import React, { useState, useRef, useEffect } from 'react'
import { FolderOpen, Play, Square, HelpCircle, X } from 'lucide-react'

type RunStatus = 'idle' | 'running' | 'done' | 'error'

function HelpPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-800 shadow-2xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Soot Compiler — Help</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X size={16} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="space-y-5 text-sm text-gray-700 dark:text-gray-300">

          <section>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">What is Soot?</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Soot is a Java/Android bytecode analysis and transformation framework. This tool uses it to decompile an Android APK into <span className="font-medium">Jimple</span> — a simplified 3-address intermediate representation (IR) that makes the app's logic readable and analyzable without needing the original source code. The resulting <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">.jimple</code> files can then be loaded into the Jimple Analyzer tab.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Fields</h3>
            <div className="space-y-3">

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="shrink-0 font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">APK File</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  The full path to the <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">.apk</code> file you want to decompile. Type the path directly or click <span className="font-medium">Browse</span> to open a native file picker filtered to <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">.apk</code> files. This is the only required field.
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="shrink-0 font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">Output Directory</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  The folder where Soot will write the generated <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">.jimple</code> files. Defaults to <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">sootOutput</code> (relative to the server working directory). The directory is created automatically if it does not exist. You can type an absolute path or use <span className="font-medium">Browse</span> to pick a folder. Use this same path in the Jimple Analyzer tab to inspect the results.
                </p>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="shrink-0 font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">Android Platforms Directory</span>
                  <span className="text-[10px] text-gray-400 font-mono">-android-jars</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  The path to your Android SDK <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">platforms/</code> directory. Soot needs this to resolve Android framework classes (e.g. <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">android.app.Activity</code>) when analyzing the APK. Without it, Soot will throw a <span className="italic">RuntimeException: did not define android.jar</span> error. The default path assumes a standard Android Studio SDK install at <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">~/Android/Sdk/platforms</code>. Each sub-folder inside (e.g. <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">android-34/</code>) must contain an <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">android.jar</code>.
                </p>
              </div>

            </div>
          </section>

          <section>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Buttons</h3>
            <div className="space-y-2">
              <div className="flex gap-3">
                <span className="shrink-0 font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded h-fit">Browse</span>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">Each field has its own Browse button. Clicking it opens a native OS file/folder picker and populates the corresponding input with the full absolute path of whatever you select.</p>
              </div>
              <div className="flex gap-3">
                <span className="shrink-0 font-mono text-xs bg-emerald-500 text-white px-2 py-0.5 rounded h-fit">Run Soot</span>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">Sends the configuration to the backend and starts the Soot process. Live output streams into the Output panel below as Soot processes each class. The button is disabled until an APK path is entered and re-disabled while a run is in progress.</p>
              </div>
              <div className="flex gap-3">
                <span className="shrink-0 font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded h-fit">Cancel</span>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">Appears only while Soot is running. Immediately kills the Soot process and stops the output stream.</p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">Output Panel</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
              Displays live stdout and stderr from the Soot process. Lines beginning with <span className="font-mono text-red-400">ERROR:</span> are highlighted in red. A green pulse indicator in the header shows that Soot is still running. The panel auto-scrolls to the latest output. When Soot finishes successfully a green confirmation banner appears above the panel showing the output directory path.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">Soot Flags Used</h3>
            <div className="mt-1 space-y-1">
              {[
                ['-src-prec apk', 'Tells Soot the input is an Android APK rather than Java source or class files.'],
                ['-output-format J', 'Outputs Jimple (.jimple) files instead of class files or other formats.'],
                ['-allow-phantom-refs', 'Allows classes that cannot be fully resolved to be treated as phantom references rather than causing a hard failure.'],
                ['-whole-program', 'Enables whole-program analysis mode, giving Soot visibility across all classes in the APK.'],
                ['-p cg enabled:false', 'Disables call-graph construction to speed up the plain IR dump — not needed just to produce Jimple files.'],
              ].map(([flag, desc]) => (
                <div key={flag} className="flex gap-3">
                  <code className="shrink-0 font-mono text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded h-fit whitespace-nowrap">{flag}</code>
                  <p className="text-xs text-gray-600 dark:text-gray-400">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-1">Typical Workflow</h3>
            <ol className="ml-4 space-y-1 text-xs text-gray-600 dark:text-gray-400 list-decimal list-outside leading-relaxed">
              <li>Set the <span className="font-medium">APK File</span> path to the APK you want to analyze.</li>
              <li>Set the <span className="font-medium">Output Directory</span> to where you want Jimple files written (e.g. <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">~/sootOutput</code>).</li>
              <li>Confirm the <span className="font-medium">Android Platforms Directory</span> points to your SDK's <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">platforms/</code> folder.</li>
              <li>Click <span className="font-medium">Run Soot</span> and watch the output panel — large APKs can take a minute or more.</li>
              <li>Once complete, switch to the <span className="font-medium">Jimple Analyzer</span> tab and enter the same output directory to inspect the results.</li>
            </ol>
          </section>

        </div>
      </div>
    </div>
  )
}

export default function SootCompilerView() {
  const [apkPath, setApkPath] = useState('')
  const [outputDir, setOutputDir] = useState('sootOutput')
  const [androidJarsPath, setAndroidJarsPath] = useState('/home/sean/Android/Sdk/platforms')
  const [status, setStatus] = useState<RunStatus>('idle')
  const [logs, setLogs] = useState<string[]>([])
  const [browsingApk, setBrowsingApk] = useState(false)
  const [browsingOut, setBrowsingOut] = useState(false)
  const [browsingJars, setBrowsingJars] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const browseApk = async () => {
    setBrowsingApk(true)
    try {
      const res = await fetch('http://localhost:3001/security/apk/browse')
      if (res.status === 204) return
      if (!res.ok) throw new Error(`Browse failed: ${res.status}`)
      const { path } = await res.json()
      if (path) setApkPath(path)
    } catch {
      // server unavailable — user can type manually
    } finally {
      setBrowsingApk(false)
    }
  }

  const browseOutput = async () => {
    setBrowsingOut(true)
    try {
      const res = await fetch('http://localhost:3001/security/jimple/browse?title=Select+Output+Directory')
      if (res.status === 204) return
      if (!res.ok) throw new Error(`Browse failed: ${res.status}`)
      const { path } = await res.json()
      if (path) setOutputDir(path)
    } catch {
      // server unavailable — user can type manually
    } finally {
      setBrowsingOut(false)
    }
  }

  const browseJars = async () => {
    setBrowsingJars(true)
    try {
      const res = await fetch('http://localhost:3001/security/jimple/browse?title=Select+Android+Platforms+Directory')
      if (res.status === 204) return
      if (!res.ok) throw new Error(`Browse failed: ${res.status}`)
      const { path } = await res.json()
      if (path) setAndroidJarsPath(path)
    } catch {
      // server unavailable — user can type manually
    } finally {
      setBrowsingJars(false)
    }
  }

  const runSoot = async () => {
    if (!apkPath.trim()) return
    setStatus('running')
    setLogs([])

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('http://localhost:3001/security/soot/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apkPath: apkPath.trim(), outputDir: outputDir.trim(), androidJarsPath: androidJarsPath.trim() }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      const reader = res.body?.getReader()
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
              if (event.type === 'log') {
                setLogs(prev => [...prev, event.message])
              } else if (event.type === 'done') {
                setStatus('done')
              } else if (event.type === 'error') {
                setLogs(prev => [...prev, `ERROR: ${event.message}`])
                setStatus('error')
              }
            } catch {
              // ignore malformed lines
            }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setLogs(prev => [...prev, 'Cancelled.'])
        setStatus('idle')
      } else {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        setLogs(prev => [...prev, `ERROR: ${msg}`])
        setStatus('error')
      }
    }
  }

  const cancel = () => {
    abortRef.current?.abort()
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}
      <div className="flex flex-col gap-4 p-4 flex-1 overflow-hidden">

        {/* APK Path */}
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-surface-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Soot Compiler (APK → Jimple)</h3>
            <button
              onClick={() => setShowHelp(true)}
              title="Help"
              className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors"
            >
              <HelpCircle size={13} />
              Help
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">APK File</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={apkPath}
                  onChange={e => setApkPath(e.target.value)}
                  placeholder="e.g. /home/user/target.apk"
                  className="flex-1 px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                />
                <button
                  onClick={browseApk}
                  disabled={browsingApk}
                  title="Browse for APK file"
                  className="flex items-center gap-1.5 px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-600 transition-colors disabled:opacity-50"
                >
                  <FolderOpen size={14} />
                  {browsingApk ? 'Opening…' : 'Browse'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Output Directory</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={outputDir}
                  onChange={e => setOutputDir(e.target.value)}
                  placeholder="e.g. /home/user/sootOutput"
                  className="flex-1 px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                />
                <button
                  onClick={browseOutput}
                  disabled={browsingOut}
                  title="Browse for output directory"
                  className="flex items-center gap-1.5 px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-600 transition-colors disabled:opacity-50"
                >
                  <FolderOpen size={14} />
                  {browsingOut ? 'Opening…' : 'Browse'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Android Platforms Directory <span className="text-gray-400 font-normal">(-android-jars)</span></label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={androidJarsPath}
                  onChange={e => setAndroidJarsPath(e.target.value)}
                  placeholder="e.g. /home/user/Android/Sdk/platforms"
                  className="flex-1 px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                />
                <button
                  onClick={browseJars}
                  disabled={browsingJars}
                  title="Browse for Android platforms directory"
                  className="flex items-center gap-1.5 px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-600 transition-colors disabled:opacity-50"
                >
                  <FolderOpen size={14} />
                  {browsingJars ? 'Opening…' : 'Browse'}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 p-2 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700">
            <p className="text-[10px] text-blue-700 dark:text-blue-300">
              Runs Soot with <span className="font-mono">soot_jar/soot-4.4.0-*-jar-with-dependencies.jar</span> to convert the APK into Jimple IR. Helper jars (commons-io, polyglot) are included automatically.
            </p>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={runSoot}
              disabled={!apkPath.trim() || status === 'running'}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play size={14} />
              Run Soot
            </button>
            {status === 'running' && (
              <button
                onClick={cancel}
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <Square size={14} />
                Cancel
              </button>
            )}
          </div>

          {status === 'done' && (
            <div className="mt-2 p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700">
              <p className="text-xs text-green-700 dark:text-green-400 font-medium">Soot completed. Jimple files written to: {outputDir}</p>
            </div>
          )}
        </div>

        {/* Log output */}
        {logs.length > 0 && (
          <div className="flex-1 flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-gray-900 dark:bg-black">
            <div className="px-3 py-1.5 border-b border-gray-700 bg-gray-800 flex items-center gap-2">
              <span className="text-xs font-medium text-gray-300">Output</span>
              {status === 'running' && (
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-3 font-mono text-xs text-gray-200 space-y-0.5">
              {logs.map((line, i) => (
                <div
                  key={i}
                  className={line.startsWith('ERROR:') ? 'text-red-400' : line.startsWith('Cancelled') ? 'text-yellow-400' : ''}
                >
                  {line}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        )}

        {logs.length === 0 && status === 'idle' && (
          <div className="flex-1 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-surface-700">
            <div className="text-center">
              <p className="text-gray-500 dark:text-gray-400 mb-1">Select an APK and run Soot to generate Jimple IR</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">Output will appear here</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
