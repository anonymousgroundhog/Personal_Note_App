import React, { useState, useRef, useEffect } from 'react'
import { FolderOpen, Play, Square } from 'lucide-react'
import PathPickerModal from '../../components/PathPickerModal'

type RunStatus = 'idle' | 'running' | 'done' | 'error'

const CONTAINER_MOUNT = '/root/host-home'

export default function ApkAnalyzerView() {
  const [apkPath, setApkPath] = useState('')
  const [outputDir, setOutputDir] = useState('')
  const [status, setStatus] = useState<RunStatus>('idle')
  const [logs, setLogs] = useState<string[]>([])
  const [pickerOpen, setPickerOpen] = useState<'apk' | 'output' | null>(null)
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [hostHome, setHostHome] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/security/host-info')
      .then(r => r.json())
      .then(d => {
        if (d.hostHome) setHostHome(d.hostHome)
        const mount = d.containerMount || '/root/host-home'
        setOutputDir(`${mount}/apktool_output`)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // Translate a container path to its host equivalent for display only
  const toDisplayPath = (p: string) =>
    hostHome ? p.replace(CONTAINER_MOUNT, hostHome) : p

  const onPickerSelect = (path: string) => {
    if (pickerOpen === 'apk') setApkPath(path)
    else if (pickerOpen === 'output') setOutputDir(path)
    setPickerOpen(null)
  }

  const uploadApkFile = async (file: File) => {
    setUploading(true)
    try {
      const data = await file.arrayBuffer()
      // Chunk the conversion to avoid call stack overflow on large APKs
      const bytes = new Uint8Array(data)
      let binary = ''
      const chunkSize = 8192
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
      }
      const base64 = btoa(binary)
      const res = await fetch('/security/apk/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, data: base64 }),
      })
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
      const { apkPath: uploaded } = await res.json()
      if (uploaded) setApkPath(uploaded)
    } catch (err) {
      setLogs(prev => [...prev, `ERROR: Upload failed — ${err instanceof Error ? err.message : 'Unknown error'}`])
    } finally {
      setUploading(false)
    }
  }

  const onFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await uploadApkFile(file)
    e.target.value = ''
  }

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && file.name.endsWith('.apk')) await uploadApkFile(file)
  }

  const runDecompile = async () => {
    if (!apkPath.trim()) return
    setStatus('running')
    setLogs([])

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/security/apk/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apkPath: apkPath.trim(),
          ...(outputDir.trim() ? { outputDir: outputDir.trim() } : {}),
        }),
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
              if (event.type === 'progress') {
                setLogs(prev => [...prev, event.message])
              } else if (event.type === 'result') {
                const dir = event.data?.outputDir
                if (dir) setLogs(prev => [...prev, `✓ Decompiled to: ${toDisplayPath(dir)}`])
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
      <PathPickerModal
        isOpen={pickerOpen === 'apk'}
        onClose={() => setPickerOpen(null)}
        onSelect={onPickerSelect}
        title="Select APK File"
        dirOnly={false}
        fileFilter=".apk"
      />
      <PathPickerModal
        isOpen={pickerOpen === 'output'}
        onClose={() => setPickerOpen(null)}
        onSelect={onPickerSelect}
        title="Select Output Directory"
        dirOnly={true}
      />

      <div className="flex flex-col gap-4 p-4 flex-1 overflow-hidden">

        {/* Config panel */}
        <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-surface-800">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">APK Decompiler (apktool)</h3>

          <div className="space-y-3">

            {/* APK file — drop zone + path input + browse */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">APK File</label>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`mb-2 flex items-center justify-center h-16 rounded border-2 border-dashed cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/10'
                }`}
              >
                <input ref={fileInputRef} type="file" accept=".apk" className="hidden" onChange={onFileInputChange} />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {uploading ? 'Uploading…' : 'Drop .apk here or click to upload'}
                </p>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={apkPath}
                  onChange={e => setApkPath(e.target.value)}
                  placeholder="e.g. /root/host-home/Downloads/app.apk"
                  className="flex-1 px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                />
                <button
                  onClick={() => setPickerOpen('apk')}
                  title="Browse for APK file"
                  className="flex items-center gap-1.5 px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-600 transition-colors"
                >
                  <FolderOpen size={14} />
                  Browse
                </button>
              </div>
            </div>

            {/* Output directory */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Output Directory
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={outputDir}
                  onChange={e => setOutputDir(e.target.value)}
                  placeholder="e.g. /root/host-home/Desktop/decompiled"
                  className="flex-1 px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                />
                <button
                  onClick={() => setPickerOpen('output')}
                  title="Browse for output directory"
                  className="flex items-center gap-1.5 px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-600 transition-colors"
                >
                  <FolderOpen size={14} />
                  Browse
                </button>
              </div>
              {hostHome && outputDir.startsWith(CONTAINER_MOUNT) && (
                <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                  Host path: <span className="font-mono">{toDisplayPath(outputDir)}</span>
                </p>
              )}
            </div>
          </div>

          <div className="mt-3 p-2 rounded bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700">
            <p className="text-[10px] text-blue-700 dark:text-blue-300">
              Runs <span className="font-mono">apktool d</span> to decode the APK into smali code, resources, and <span className="font-mono">AndroidManifest.xml</span>. Paths use <span className="font-mono">/root/host-home</span> which maps to your home directory on the host.
            </p>
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={runDecompile}
              disabled={!apkPath.trim() || status === 'running' || uploading}
              className="flex items-center gap-1.5 px-4 py-2 text-sm rounded bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play size={14} />
              {status === 'running' ? 'Decompiling…' : 'Decompile'}
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
            <div className="mt-3 p-2 rounded bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700">
              <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                ✓ apktool completed. Output written to: {toDisplayPath(outputDir.trim() || '/root/host-home/apktool_output')}
              </p>
            </div>
          )}
        </div>

        {/* Output log */}
        <div className="flex-1 flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden min-h-0">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-700">
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Output</span>
            {status === 'running' && (
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </div>
          <div className="flex-1 overflow-y-auto bg-gray-900 p-3 font-mono text-xs text-gray-200 space-y-0.5">
            {logs.length === 0 ? (
              <span className="text-gray-500">apktool output will appear here…</span>
            ) : (
              logs.map((line, i) => (
                <div
                  key={i}
                  className={line.startsWith('ERROR:') ? 'text-red-400' : line.startsWith('✓') ? 'text-emerald-400' : 'text-gray-200'}
                >
                  {line}
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>

      </div>
    </div>
  )
}
