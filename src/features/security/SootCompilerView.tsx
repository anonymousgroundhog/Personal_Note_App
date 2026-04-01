import React, { useState, useRef, useEffect } from 'react'
import { FolderOpen, Play, Square, HelpCircle, X } from 'lucide-react'
import type { MethodCFG } from './types'
import PathPickerModal from '../../components/PathPickerModal'

type RunStatus = 'idle' | 'running' | 'done' | 'error'
type DisplayTab = 'output' | 'cfg'

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
              <li>Set the <span className="font-medium">Output Directory</span> to where you want Jimple files written — use the Browse button to pick a folder under your home directory, or use the default <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">/root/host-home/sootOutput</code>.</li>
              <li>The <span className="font-medium">Android Platforms Directory</span> is auto-detected from the container's installed platforms — leave it blank unless you need to override it.</li>
              <li>Click <span className="font-medium">Run Soot</span> and watch the output panel — large APKs can take a minute or more.</li>
              <li>Once complete, switch to the <span className="font-medium">Jimple Analyzer</span> tab and enter the same output directory to inspect the results.</li>
            </ol>
          </section>

          <section>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Understanding Compilers and Jimple Components</h3>

            <div className="space-y-3">
              <div>
                <h4 className="font-medium text-gray-800 dark:text-gray-100 text-xs mb-1">What is a Compiler?</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  A compiler is a program that translates code from one form to another. In traditional software, a compiler transforms human-readable source code (e.g., Java, C) into machine-executable bytecode or native instructions. Soot acts as a special kind of compiler: instead of compiling to executable code, it compiles Android APK bytecode into <span className="font-medium">Jimple</span>, a simplified intermediate representation (IR) that is designed to be human-readable and easier to analyze.
                </p>
              </div>

              <div>
                <h4 className="font-medium text-gray-800 dark:text-gray-100 text-xs mb-1">Jimple Intermediate Representation</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  Jimple is a <span className="font-medium">three-address intermediate representation (3-address IR)</span> designed by the Soot team. Unlike raw bytecode (which is stack-based and complex), Jimple breaks down operations into simple, three-operand statements that are close to how a compiler would represent code before optimization. This makes it much easier for humans (and analysis tools) to understand what the original code does.
                </p>
              </div>

              <div>
                <h4 className="font-medium text-gray-800 dark:text-gray-100 text-xs mb-1">Jimple Components</h4>
                <div className="space-y-2 mt-1">
                  <div>
                    <span className="font-mono text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-800 dark:text-gray-200">Units</span>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      Units are individual statements or instructions in a Jimple method body. Common types include assignments (<code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">x = y + z</code>), method calls, field access, conditionals, and jumps. Each unit represents one semantic operation that the code performs. They are the building blocks of method logic.
                    </p>
                  </div>

                  <div>
                    <span className="font-mono text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-800 dark:text-gray-200">Locals</span>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      Locals are local variables inside a method, such as parameters, temporary variables, and objects created within the method scope. Each local has a type (e.g., <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">int</code>, <code className="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">String</code>, or a custom class). Unlike raw bytecode which uses a generic value stack, Jimple's locals are named and typed, making the code logic much clearer.
                    </p>
                  </div>

                  <div>
                    <span className="font-mono text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-800 dark:text-gray-200">Values & Value Boxes</span>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      Values represent runtime data — constants, local variables, fields, array references, expressions, and method calls. A <span className="font-medium">Value Box</span> is a container that holds a reference to a value within a unit. It allows Soot's analysis and transformation tools to track which values are used and defined at each point, enabling data-flow analysis.
                    </p>
                  </div>

                  <div>
                    <span className="font-mono text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-800 dark:text-gray-200">Control Flow Graph (CFG)</span>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      The CFG is an implicit structure created from units: each unit is a node, and directed edges connect consecutive units or jump targets (e.g., branches, loops). By tracing the CFG, you can understand which code paths are reachable and what variables are live at any given point. This is essential for detecting unreachable code, identifying loops, and understanding program flow.
                    </p>
                  </div>

                  <div>
                    <span className="font-mono text-[10px] bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-gray-800 dark:text-gray-200">Side Effects & Refs</span>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                      Jimple tracks what values are <span className="font-medium">used</span> (read from) and <span className="font-medium">defined</span> (written to) at each unit. This is critical for data-flow analysis: by knowing which variables are used and defined, you can identify where values come from and what operations depend on them. This is how Soot detects data dependencies and potential issues like use-after-free or uninitialized reads.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-800 dark:text-gray-100 text-xs mb-1">Why This Matters for APK Analysis</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  By converting an APK to Jimple, you gain the ability to:
                  <ul className="list-inside list-disc mt-1 space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
                    <li>Read and understand app logic without source code</li>
                    <li>Detect suspicious patterns (data exfiltration, permission abuse, etc.)</li>
                    <li>Perform static analysis to find potential security issues</li>
                    <li>Track how sensitive data flows through the app (taint analysis)</li>
                    <li>Identify obfuscation and reverse-engineer obfuscated code</li>
                  </ul>
                </p>
              </div>
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">CFG (Control Flow Graph)</h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-2">
              After Soot completes, a <span className="font-medium">CFG</span> tab appears in the results panel showing control flow graphs for individual methods. The CFG visualizes program flow by displaying statements (nodes) and the transitions between them (edges):
            </p>
            <ul className="ml-3 space-y-1 text-xs text-gray-600 dark:text-gray-400 list-disc list-inside">
              <li><span className="font-medium">Green nodes</span> — Entry points where execution begins</li>
              <li><span className="font-medium">Red nodes</span> — Exit points where execution ends</li>
              <li><span className="font-medium">Gray nodes</span> — Regular statements or operations</li>
              <li><span className="font-medium">Arrows</span> — Control flow edges showing possible execution paths</li>
            </ul>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">This is essential for understanding program logic, detecting unreachable code, identifying loops, and tracing security-sensitive execution paths.</p>
          </section>

        </div>
      </div>
    </div>
  )
}

function CFGVisualization({ cfg }: { cfg: MethodCFG }) {
  const nodeWidth = 160
  const nodeHeight = 70
  const nodeSpacing = 200
  const verticalSpacing = 100

  // Calculate layout: arrange nodes in columns based on reachability
  const nodePositions = new Map<string, { x: number; y: number }>()
  const visited = new Set<string>()

  const layoutNodes = (nodeId: string, column: number = 0, rowInColumn: number = 0): number => {
    if (visited.has(nodeId)) return rowInColumn
    visited.add(nodeId)

    const x = column * nodeSpacing + 100
    const y = rowInColumn * verticalSpacing + 50
    nodePositions.set(nodeId, { x, y })

    // Find all outgoing edges
    const outgoing = cfg.edges.filter(e => e.from === nodeId)
    let nextRow = rowInColumn + 1

    for (const edge of outgoing) {
      if (!visited.has(edge.to)) {
        const newRow = layoutNodes(edge.to, column + 1, nextRow)
        nextRow = Math.max(nextRow, newRow + 1)
      }
    }

    return nextRow
  }

  // Start layout from entry nodes
  let currentRow = 0
  for (const node of cfg.nodes) {
    if (node.isEntry && !visited.has(node.id)) {
      currentRow = layoutNodes(node.id, 0, currentRow) + 1
    }
  }

  // Layout remaining nodes
  for (const node of cfg.nodes) {
    if (!visited.has(node.id)) {
      currentRow = layoutNodes(node.id, 0, currentRow) + 1
    }
  }

  const width = Math.max(1000, cfg.nodes.length * nodeSpacing + 200)
  const height = Math.max(500, currentRow * verticalSpacing + 150)

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-surface-700 p-3">
      <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
        <span className="font-semibold">{cfg.nodes.length}</span> nodes, <span className="font-semibold">{cfg.edges.length}</span> edges
      </div>
      <div className="overflow-x-auto border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-surface-800">
        <svg width={width} height={height} className="min-w-full">
          {/* Draw edges */}
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
              <polygon points="0 0, 10 3, 0 6" fill="#666" />
            </marker>
          </defs>

          {cfg.edges.map((edge, idx) => {
            const from = nodePositions.get(edge.from)
            const to = nodePositions.get(edge.to)
            if (!from || !to) return null

            const offsetX = Math.abs(to.x - from.x) * 0.1
            const offsetY = Math.abs(to.y - from.y) * 0.2
            const controlX1 = from.x + offsetX
            const controlY1 = from.y + offsetY
            const controlX2 = to.x - offsetX
            const controlY2 = to.y - offsetY

            return (
              <g key={`edge-${idx}`}>
                <path
                  d={`M ${from.x} ${from.y} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${to.x} ${to.y}`}
                  stroke="#999"
                  strokeWidth="2"
                  fill="none"
                  markerEnd="url(#arrowhead)"
                  className="dark:stroke-gray-400"
                />
                {edge.label && (
                  <text
                    x={(from.x + to.x) / 2}
                    y={(from.y + to.y) / 2 - 5}
                    fontSize="10"
                    fill="#666"
                    textAnchor="middle"
                    className="dark:fill-gray-400"
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            )
          })}

          {/* Draw nodes */}
          {cfg.nodes.map((node) => {
            const pos = nodePositions.get(node.id)
            if (!pos) return null

            let nodeColor = '#e5e7eb'
            let textColor = '#1f2937'
            if (node.isEntry) {
              nodeColor = '#86efac'
              textColor = '#15803d'
            } else if (node.isExit) {
              nodeColor = '#fca5a5'
              textColor = '#991b1b'
            }

            // Split text into lines for wrapping
            const maxCharsPerLine = 20
            const words = node.label.split(/\s+/)
            const lines: string[] = []
            let currentLine = ''

            for (const word of words) {
              if ((currentLine + ' ' + word).length <= maxCharsPerLine) {
                currentLine += (currentLine ? ' ' : '') + word
              } else {
                if (currentLine) lines.push(currentLine)
                currentLine = word.length > maxCharsPerLine ? word.substring(0, maxCharsPerLine - 3) + '...' : word
              }
            }
            if (currentLine) lines.push(currentLine)
            if (lines.length === 0) lines.push(node.label.substring(0, maxCharsPerLine))

            return (
              <g key={`node-${node.id}`}>
                <rect
                  x={pos.x - nodeWidth / 2}
                  y={pos.y - nodeHeight / 2}
                  width={nodeWidth}
                  height={nodeHeight}
                  fill={nodeColor}
                  stroke="#999"
                  strokeWidth="2"
                  rx="4"
                  className="dark:stroke-gray-500"
                />
                <text
                  x={pos.x}
                  y={pos.y - (lines.length - 1) * 8}
                  fontSize="10"
                  fontFamily="monospace"
                  fill={textColor}
                  textAnchor="middle"
                  className="pointer-events-none"
                >
                  {lines.map((line, idx) => (
                    <tspan key={idx} x={pos.x} dy={idx === 0 ? 0 : 16}>
                      {line}
                    </tspan>
                  ))}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <div className="mt-2 flex gap-4 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-green-200 dark:bg-green-600 border border-green-700"></div>
          <span>Entry</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-red-200 dark:bg-red-600 border border-red-700"></div>
          <span>Exit</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded bg-gray-200 dark:bg-gray-600 border border-gray-700"></div>
          <span>Statement</span>
        </div>
      </div>
    </div>
  )
}

export default function SootCompilerView() {
  const [apkPath, setApkPath] = useState('')
  const [outputDir, setOutputDir] = useState('')
  const [androidJarsPath, setAndroidJarsPath] = useState('')
  const [status, setStatus] = useState<RunStatus>('idle')
  const [logs, setLogs] = useState<string[]>([])
  const [browsingApk, setBrowsingApk] = useState(false)
  const [browsingOut, setBrowsingOut] = useState(false)
  const [browsingJars, setBrowsingJars] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [pickerOpen, setPickerOpen] = useState<'apk' | 'output' | 'jars' | null>(null)
  const [cfgData, setCFGData] = useState<MethodCFG[] | null>(null)
  const [selectedCFGIndex, setSelectedCFGIndex] = useState(0)
  const [displayTab, setDisplayTab] = useState<DisplayTab>('output')
  const abortRef = useRef<AbortController | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)
  const apkFileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/security/host-info')
      .then(r => r.json())
      .then(d => {
        const mount = d.containerMount || '/root/host-home'
        setOutputDir(`${mount}/sootOutput`)
      })
      .catch(() => { setOutputDir('/root/host-home/sootOutput') })
  }, [])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const browseApk = () => setPickerOpen('apk')
  const browseOutput = () => setPickerOpen('output')
  const browseJars = () => setPickerOpen('jars')

  const onPickerSelect = (path: string) => {
    if (pickerOpen === 'apk') setApkPath(path)
    else if (pickerOpen === 'output') setOutputDir(path)
    else if (pickerOpen === 'jars') setAndroidJarsPath(path)
    setPickerOpen(null)
  }

  const onApkFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBrowsingApk(true)
    try {
      const data = await file.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(data)))
      const res = await fetch('/security/apk/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, data: base64 }),
      })
      if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
      const { apkPath: uploaded } = await res.json()
      if (uploaded) setApkPath(uploaded)
    } catch (err) {
      console.error('APK upload failed', err)
    } finally {
      setBrowsingApk(false)
      e.target.value = ''
    }
  }

  const runSoot = async () => {
    if (!apkPath.trim()) return
    setStatus('running')
    setLogs([])
    setCFGData(null)

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
      let analysisResult: any = null

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
              } else if (event.type === 'result') {
                // Store analysis result for later processing
                analysisResult = event.data
              } else if (event.type === 'done') {
                setStatus('done')
                // Extract CFG data from analysis result if available
                if (analysisResult && analysisResult.cfgData) {
                  setCFGData(analysisResult.cfgData)
                  setSelectedCFGIndex(0)
                  setLogs(prev => [...prev, `Extracted ${analysisResult.cfgData.length} method CFGs`])
                }
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

  const loadCFGFromBackend = async () => {
    if (!outputDir.trim()) {
      setLogs(prev => [...prev, 'ERROR: Output directory not set'])
      return
    }

    setLogs(prev => [...prev, 'Loading CFG data...'])

    try {
      // Try backend endpoint first (Approach 1)
      const res = await fetch('http://localhost:3001/security/soot/extract-cfg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jimpleDir: outputDir.trim() })
      })

      if (res.ok) {
        const result = await res.json()
        if (result.cfgData && Array.isArray(result.cfgData) && result.cfgData.length > 0) {
          setCFGData(result.cfgData)
          setSelectedCFGIndex(0)
          setDisplayTab('cfg')
          setLogs(prev => [...prev, `✓ Extracted ${result.cfgData.length} method CFGs from backend`])
          return
        }
      }
    } catch (err) {
      // Backend endpoint not available, continue to fallback
    }

    // Fallback: Generate sample CFG data for demonstration
    setLogs(prev => [...prev, 'Backend endpoint not configured - showing sample CFG data'])
    const sampleCFGs = createSampleCFGData()
    setCFGData(sampleCFGs)
    setSelectedCFGIndex(0)
    setDisplayTab('cfg')
    setLogs(prev => [...prev, `✓ Loaded ${sampleCFGs.length} sample method CFGs for visualization`])
  }

  const createSampleCFGData = (): MethodCFG[] => {
    // Create sample CFG data for demonstration
    return [
      {
        className: 'com.example.MainActivity',
        methodName: 'onCreate',
        methodSignature: 'onCreate(Bundle)',
        nodes: [
          { id: 'unit_0', label: '$r1 := @this: MainActivity', isEntry: true, isExit: false },
          { id: 'unit_1', label: '$r2 := @parameter0: Bundle', isEntry: false, isExit: false },
          { id: 'unit_2', label: '$r1.onCreate($r2)', isEntry: false, isExit: false },
          { id: 'unit_3', label: 'return', isEntry: false, isExit: true }
        ],
        edges: [
          { from: 'unit_0', to: 'unit_1', label: null },
          { from: 'unit_1', to: 'unit_2', label: null },
          { from: 'unit_2', to: 'unit_3', label: null }
        ]
      },
      {
        className: 'com.example.MainActivity',
        methodName: 'onResume',
        methodSignature: 'onResume()',
        nodes: [
          { id: 'unit_0', label: '$r1 := @this: MainActivity', isEntry: true, isExit: false },
          { id: 'unit_1', label: 'invoke $r1.<Activity.onResume>', isEntry: false, isExit: false },
          { id: 'unit_2', label: 'return', isEntry: false, isExit: true }
        ],
        edges: [
          { from: 'unit_0', to: 'unit_1', label: null },
          { from: 'unit_1', to: 'unit_2', label: null }
        ]
      }
    ]
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}
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
      <PathPickerModal
        isOpen={pickerOpen === 'jars'}
        onClose={() => setPickerOpen(null)}
        onSelect={onPickerSelect}
        title="Select Android Platforms Directory"
        dirOnly={true}
      />
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
                  ref={apkFileInputRef}
                  type="file"
                  accept=".apk"
                  className="hidden"
                  onChange={onApkFileSelected}
                />
                <input
                  type="text"
                  value={apkPath}
                  onChange={e => setApkPath(e.target.value)}
                  placeholder="e.g. /tmp/apk_xyz/target.apk"
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
                  placeholder="Auto-detected (leave blank to use installed platforms)"
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
            <div className="mt-2 space-y-2">
              <div className="p-2 rounded bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700">
                <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                  ✓ Soot completed. Jimple files written to: {outputDir}
                  {cfgData && cfgData.length > 0 && ` • ${cfgData.length} method CFGs extracted`}
                </p>
              </div>
              {!cfgData && (
                <button
                  onClick={() => loadCFGFromBackend()}
                  className="px-3 py-1.5 text-xs rounded bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors"
                >
                  Load CFG Data
                </button>
              )}
            </div>
          )}
        </div>

        {/* Results with tabs */}
        {(logs.length > 0 || cfgData) && (
          <div className="flex-1 flex flex-col rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-surface-800">
            {/* Tab buttons */}
            <div className="flex gap-1 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-700">
              <button
                onClick={() => setDisplayTab('output')}
                className={`px-3 py-1 text-sm rounded font-medium transition-colors ${
                  displayTab === 'output'
                    ? 'bg-emerald-500 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                Output
              </button>
              {cfgData && cfgData.length > 0 && (
                <button
                  onClick={() => setDisplayTab('cfg')}
                  className={`px-3 py-1 text-sm rounded font-medium transition-colors ${
                    displayTab === 'cfg'
                      ? 'bg-emerald-500 text-white'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  CFG ({cfgData.length})
                </button>
              )}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {/* Output tab */}
              {displayTab === 'output' && (
                <div className="flex-1 overflow-y-auto scrollbar-thin p-3 font-mono text-xs text-gray-200 space-y-0.5 bg-gray-900 dark:bg-black">
                  {logs.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-gray-500">No output yet</p>
                    </div>
                  ) : (
                    <>
                      {logs.map((line, i) => (
                        <div
                          key={i}
                          className={line.startsWith('ERROR:') ? 'text-red-400' : line.startsWith('Cancelled') ? 'text-yellow-400' : ''}
                        >
                          {line}
                        </div>
                      ))}
                      <div ref={logEndRef} />
                    </>
                  )}
                </div>
              )}

              {/* CFG tab */}
              {displayTab === 'cfg' && cfgData && cfgData.length > 0 && (
                <div className="flex-1 overflow-y-auto scrollbar-thin p-4 flex flex-col">
                  <div className="mb-3">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Select Method:</label>
                    <select
                      value={selectedCFGIndex}
                      onChange={(e) => setSelectedCFGIndex(parseInt(e.target.value))}
                      className="w-full px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-surface-700 text-gray-900 dark:text-gray-100"
                    >
                      {cfgData.map((cfg, idx) => (
                        <option key={idx} value={idx}>
                          {cfg.className}.{cfg.methodName}{cfg.methodSignature}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {cfgData[selectedCFGIndex] && (
                      <CFGVisualization cfg={cfgData[selectedCFGIndex]} />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {logs.length === 0 && status === 'idle' && !cfgData && (
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
