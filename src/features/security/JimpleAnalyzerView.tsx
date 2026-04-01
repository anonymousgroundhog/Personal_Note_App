import React, { useState, useEffect } from 'react'
import { Copy, Check, FolderOpen, HelpCircle, X } from 'lucide-react'
import type { AnalysisResult } from './types'
import { API_CATEGORY_COLORS } from './types'
import PathPickerModal from '../../components/PathPickerModal'

type ResultTab = 'apis' | 'strings' | 'classes' | 'libraries' | 'jimple'
type AnalysisStatus = 'idle' | 'analyzing' | 'done' | 'error'

// Jimple syntax highlighting tooltip content
const JIMPLE_TOOLTIPS: Record<string, string> = {
  'staticinvoke': 'Static invocation — calls a static method on a class. No object instance needed.',
  'specialinvoke': 'Special invocation — used for constructors (<init>), super methods, and private calls.',
  'virtualinvoke': 'Virtual invocation — instance method call with dynamic dispatch based on runtime type.',
  'interfaceinvoke': 'Interface invocation — calls a method via an interface reference.',
  'goto': 'Goto — unconditional jump to another unit in the method body.',
  'if': 'Conditional branch — jumps to target unit if expression is true.',
  'return': 'Return — exits the method, optionally carrying a return value.',
  'throw': 'Throw — raises an exception, transferring control to a catch handler.',
  'nop': 'Nop — no-operation placeholder unit with no effect.',
  'new': 'New — allocates heap memory for an object. Constructor called separately via specialinvoke <init>.',
  'instanceof': 'Instanceof — runtime type check. Tests if object is instance of a class/interface.',
  'catch': 'Catch — exception handler that intercepts thrown exceptions.',
  'case': 'Case — target label in a switch statement.',
  'switch': 'Switch — multi-way branch based on expression value.',
  'default': 'Default — fallback branch in a switch or catch-all handler.',
  'cast': 'Cast — explicit type conversion between types.',
  'newarray': 'Newarray — allocates a new primitive array.',
  'newmultiarray': 'Newmultiarray — allocates a multi-dimensional array.',
  'local': 'Local variable — a temporary typed variable in this method\'s stack frame. (Soot auto-names them: r0, l1, $stack2, etc.)',
  'classRef': 'Class reference — Soot\'s fully qualified method signature format: <ClassName: returnType methodName(params)>',
}

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

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold bg-emerald-500 text-white px-2 py-0.5 rounded">Jimple Code</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-2">
                  View the raw Jimple code for any analyzed class. The left sidebar lists all classes (searchable by name or package). Click a class to view its decompiled code with syntax highlighting.
                </p>
                <div className="bg-gray-100 dark:bg-gray-900 rounded p-2 text-xs font-mono text-gray-700 dark:text-gray-300 mb-2">
                  <div className="mb-1"><span className="text-purple-400">staticinvoke</span>, <span className="text-purple-400">specialinvoke</span>, <span className="text-purple-400">virtualinvoke</span></div>
                  <div className="mb-1"><span className="text-blue-400">if</span>, <span className="text-blue-400">goto</span>, <span className="text-blue-400">return</span>, <span className="text-blue-400">throw</span>, <span className="text-blue-400">nop</span></div>
                  <div className="text-gray-600 dark:text-gray-400 text-[10px] mt-2">Colors highlight different Jimple constructs. Hover any keyword for a tooltip.</div>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  <span className="font-medium">Note:</span> Requires backend endpoint <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">POST /security/jimple/read-file</code> to load files.
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

function JimpleIRInfoPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-800 shadow-2xl p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Jimple — Intermediate Representation Details</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <X size={16} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="space-y-5 text-sm text-gray-700 dark:text-gray-300">

          <section>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">What is Jimple?</h3>
            <p className="text-xs leading-relaxed mb-2">
              Jimple is a <span className="font-medium">typed, 3-address intermediate representation (IR)</span> of Java bytecode produced by the Soot framework. It simplifies bytecode into a human-readable form while preserving the exact semantics of the original program. Each line in Jimple represents a single operation—unlike bytecode which often has multi-operation instructions.
            </p>
          </section>

          <section>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Core Concepts</h3>
            <div className="space-y-3">

              <div>
                <div className="font-medium text-gray-800 dark:text-gray-100 text-xs mb-1">Units (Statements)</div>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-1">
                  Each line is called a <span className="font-mono">Unit</span>. Units are the atomic instructions of Jimple. Examples:
                </p>
                <div className="bg-gray-100 dark:bg-gray-900 rounded p-2 font-mono text-[10px] text-gray-700 dark:text-gray-300 space-y-1">
                  <div><span className="text-cyan-400">int</span> r0 = 42;  <span className="text-gray-500">// assignment</span></div>
                  <div><span className="text-blue-400">if</span> r0 &gt; 10 <span className="text-blue-400">goto</span> label1;  <span className="text-gray-500">// conditional branch</span></div>
                  <div><span className="text-blue-400">return</span> r0;  <span className="text-gray-500">// return statement</span></div>
                  <div><span className="text-blue-400">throw</span> $e;  <span className="text-gray-500">// exception throw</span></div>
                </div>
              </div>

              <div>
                <div className="font-medium text-gray-800 dark:text-gray-100 text-xs mb-1">Locals (Local Variables)</div>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-1">
                  Jimple auto-names all local variables using consistent patterns:
                </p>
                <div className="bg-gray-100 dark:bg-gray-900 rounded p-2 font-mono text-[10px] text-gray-700 dark:text-gray-300 space-y-1">
                  <div><span className="text-orange-400">r0</span>, <span className="text-orange-400">r1</span>, <span className="text-orange-400">r2</span>  <span className="text-gray-500">// reference locals (objects)</span></div>
                  <div><span className="text-orange-400">i0</span>, <span className="text-orange-400">i1</span>  <span className="text-gray-500">// integer locals</span></div>
                  <div><span className="text-orange-400">l0</span>, <span className="text-orange-400">l1</span>  <span className="text-gray-500">// long locals</span></div>
                  <div><span className="text-orange-400">f0</span>, <span className="text-orange-400">f1</span>  <span className="text-gray-500">// float locals</span></div>
                  <div><span className="text-orange-400">d0</span>, <span className="text-orange-400">d1</span>  <span className="text-gray-500">// double locals</span></div>
                  <div><span className="text-orange-400">$stack0</span>, <span className="text-orange-400">$stack1</span>  <span className="text-gray-500">// temporary stack values</span></div>
                </div>
              </div>

              <div>
                <div className="font-medium text-gray-800 dark:text-gray-100 text-xs mb-1">Method Invocations (Invoke Types)</div>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-1">
                  Four types of method calls, each with different dispatch rules:
                </p>
                <div className="space-y-2">
                  <div className="bg-gray-100 dark:bg-gray-900 rounded p-2">
                    <div className="font-mono text-[10px] text-purple-400 mb-1">staticinvoke &lt;ClassName: returnType methodName(params)&gt;(args)</div>
                    <p className="text-[10px] text-gray-600 dark:text-gray-400">Calls a <span className="font-semibold">static method</span> directly on the class. No object instance needed. Used for utility methods and Android system APIs.</p>
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-900 rounded p-2">
                    <div className="font-mono text-[10px] text-purple-400 mb-1">specialinvoke receiver.&lt;ClassName: returnType methodName(params)&gt;(args)</div>
                    <p className="text-[10px] text-gray-600 dark:text-gray-400">Calls a <span className="font-semibold">constructor (&lt;init&gt;)</span>, <span className="font-semibold">superclass method</span>, or <span className="font-semibold">private method</span>. Bypasses virtual dispatch.</p>
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-900 rounded p-2">
                    <div className="font-mono text-[10px] text-purple-400 mb-1">virtualinvoke receiver.&lt;ClassName: returnType methodName(params)&gt;(args)</div>
                    <p className="text-[10px] text-gray-600 dark:text-gray-400">Calls an <span className="font-semibold">instance method</span> using <span className="font-semibold">dynamic dispatch</span>. The actual method executed depends on the runtime type of <span className="font-mono">receiver</span>.</p>
                  </div>
                  <div className="bg-gray-100 dark:bg-gray-900 rounded p-2">
                    <div className="font-mono text-[10px] text-purple-400 mb-1">interfaceinvoke receiver.&lt;InterfaceName: returnType methodName(params)&gt;(args)</div>
                    <p className="text-[10px] text-gray-600 dark:text-gray-400">Calls a method defined in an <span className="font-semibold">interface</span>. Similar to virtual dispatch but used when the static type is an interface.</p>
                  </div>
                </div>
              </div>

              <div>
                <div className="font-medium text-gray-800 dark:text-gray-100 text-xs mb-1">3-Address Code Format</div>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-1">
                  Jimple uses 3-address code: each unit performs <span className="font-semibold">at most one operation</span> on <span className="font-semibold">at most 3 operands</span>:
                </p>
                <div className="bg-gray-100 dark:bg-gray-900 rounded p-2 font-mono text-[10px] text-gray-700 dark:text-gray-300 space-y-1">
                  <div><span className="text-orange-400">r0</span> = <span className="text-orange-400">r1</span> + <span className="text-orange-400">r2</span>;  <span className="text-gray-500">// dest = operand1 op operand2</span></div>
                  <div><span className="text-orange-400">r0</span> = <span className="text-orange-400">r1</span>;  <span className="text-gray-500">// dest = source</span></div>
                  <div><span className="text-orange-400">r0</span> = <span className="text-blue-400">new</span> java.lang.String;  <span className="text-gray-500">// dest = allocation</span></div>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mt-1">
                  This differs from bytecode where a single instruction might perform multiple operations. The 3-address format makes it easier to analyze control flow and data flow.
                </p>
              </div>

              <div>
                <div className="font-medium text-gray-800 dark:text-gray-100 text-xs mb-1">Type Information</div>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-1">
                  All locals and values have explicit types, making the IR <span className="font-medium">fully typed</span>. This preserves Java's type safety:
                </p>
                <div className="bg-gray-100 dark:bg-gray-900 rounded p-2 font-mono text-[10px] text-gray-700 dark:text-gray-300 space-y-1">
                  <div><span className="text-cyan-400">int</span> <span className="text-orange-400">i0</span> = 42;</div>
                  <div><span className="text-cyan-400">java.lang.String</span> <span className="text-orange-400">r0</span> = &quot;hello&quot;;</div>
                  <div><span className="text-cyan-400">java.util.List</span> <span className="text-orange-400">r1</span> = <span className="text-blue-400">new</span> java.util.ArrayList;</div>
                </div>
              </div>

              <div>
                <div className="font-medium text-gray-800 dark:text-gray-100 text-xs mb-1">Control Flow Statements</div>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-1">
                  Jimple represents control flow explicitly:
                </p>
                <div className="bg-gray-100 dark:bg-gray-900 rounded p-2 font-mono text-[10px] text-gray-700 dark:text-gray-300 space-y-1">
                  <div><span className="text-blue-400">if</span> <span className="text-orange-400">r0</span> &gt; 10 <span className="text-blue-400">goto</span> label1;  <span className="text-gray-500">// conditional jump</span></div>
                  <div><span className="text-blue-400">goto</span> label2;  <span className="text-gray-500">// unconditional jump</span></div>
                  <div><span className="text-blue-400">switch</span>(<span className="text-orange-400">r0</span>) &#123; <span className="text-blue-400">case</span> 1: ... &#125;  <span className="text-gray-500">// multi-way branch</span></div>
                  <div><span className="text-blue-400">return</span> <span className="text-orange-400">r0</span>;  <span className="text-gray-500">// method exit with value</span></div>
                  <div><span className="text-blue-400">throw</span> <span className="text-orange-400">$e</span>;  <span className="text-gray-500">// exception throw</span></div>
                </div>
              </div>

            </div>
          </section>

          <section>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Analyzing Jimple Code</h3>
            <ol className="ml-4 space-y-1 text-xs text-gray-600 dark:text-gray-400 list-decimal list-outside leading-relaxed">
              <li><span className="font-medium">Identify method entry/exit:</span> Find <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">public/private void methodName(params)</code> and trace flow to <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">return</code> statements.</li>
              <li><span className="font-medium">Trace data flow:</span> Follow how values are assigned and passed through locals (e.g., <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">r0 = r1 + r2</code>).</li>
              <li><span className="font-medium">Spot sensitive operations:</span> Look for <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">staticinvoke</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">virtualinvoke</code> to API calls like location, camera, network, etc.</li>
              <li><span className="font-medium">Check control flow:</span> <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">if</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">goto</code>, <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">switch</code> show branching logic and conditions.</li>
              <li><span className="font-medium">Understand exceptions:</span> <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">throw</code> and <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">catch</code> show error handling paths.</li>
            </ol>
          </section>

          <section>
            <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Syntax Highlighting Legend</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <span className="text-purple-400 font-mono text-xs">●</span>
                <span className="text-xs text-gray-600 dark:text-gray-400">Invoke types</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-400 font-mono text-xs">●</span>
                <span className="text-xs text-gray-600 dark:text-gray-400">Keywords</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-cyan-400 font-mono text-xs">●</span>
                <span className="text-xs text-gray-600 dark:text-gray-400">Primitive types</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-green-400 font-mono text-xs">●</span>
                <span className="text-xs text-gray-600 dark:text-gray-400">Class names</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-orange-400 font-mono text-xs">●</span>
                <span className="text-xs text-gray-600 dark:text-gray-400">Local variables</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-mono text-xs">●</span>
                <span className="text-xs text-gray-600 dark:text-gray-400">String literals</span>
              </div>
            </div>
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
  const [pickerOpen, setPickerOpen] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  // Jimple viewer state
  const [selectedClassName, setSelectedClassName] = useState<string | null>(null)
  const [jimpleContent, setJimpleContent] = useState<string | null>(null)
  const [loadingJimple, setLoadingJimple] = useState(false)
  const [jimpleError, setJimpleError] = useState<string | null>(null)
  const [classSearchFilter, setClassSearchFilter] = useState('')
  const [showJimpleIRInfo, setShowJimpleIRInfo] = useState(false)

  const handleBrowse = () => setPickerOpen(true)

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

  const loadJimpleFile = async (className: string) => {
    setSelectedClassName(className)
    setLoadingJimple(true)
    setJimpleContent(null)
    setJimpleError(null)
    try {
      const res = await fetch('/security/jimple/read-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderPath, className })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { content } = await res.json()
      setJimpleContent(content)
    } catch {
      setJimpleError('Could not load file. Ensure the backend endpoint POST /security/jimple/read-file is implemented with body { folderPath, className } → response { content: string }')
    } finally {
      setLoadingJimple(false)
    }
  }

  // Jimple tokenizer - returns array of {text, type}
  const tokenizeLine = (line: string): Array<{text: string, type: string}> => {
    if (!line.trim()) return [{text: line, type: 'plain'}]

    const tokens: Array<{text: string, type: string}> = []
    let remaining = line
    let position = 0

    // Patterns: applied in priority order
    const patterns = [
      { regex: /^\/\/.*/, type: 'comment' },
      { regex: /^"[^"]*"/, type: 'string' },
      { regex: /\b(staticinvoke|specialinvoke|virtualinvoke|interfaceinvoke)\b/, type: 'invokeType' },
      { regex: /\b(if|goto|return|throw|nop|new|instanceof|cast|switch|case|default|catch|newarray|newmultiarray)\b/, type: 'keyword' },
      { regex: /\b(public|private|protected|static|final|abstract|synchronized|native|transient|volatile)\b/, type: 'modifier' },
      { regex: /\b(void|int|long|boolean|float|double|byte|short|char)\b/, type: 'primitive' },
      { regex: /<[^>]+>/, type: 'classRef' },
      { regex: /\d+(\.\d+)?/, type: 'number' },
      { regex: /\$?[a-z_]\w*/, type: 'local' },
    ]

    while (remaining.length > 0) {
      let matched = false

      for (const pattern of patterns) {
        const match = remaining.match(pattern.regex)
        if (match) {
          // Get the matched text
          const matchText = match[0]

          // Get text before match
          if (match.index && match.index > 0) {
            tokens.push({ text: remaining.substring(0, match.index), type: 'plain' })
          }

          // Add matched token
          tokens.push({ text: matchText, type: pattern.type })

          remaining = remaining.substring((match.index || 0) + matchText.length)
          matched = true
          break
        }
      }

      if (!matched) {
        // No pattern matched, consume one character
        const char = remaining[0]
        if (tokens.length > 0 && tokens[tokens.length - 1].type === 'plain') {
          tokens[tokens.length - 1].text += char
        } else {
          tokens.push({ text: char, type: 'plain' })
        }
        remaining = remaining.substring(1)
      }
    }

    return tokens
  }

  // Render tokenized line with syntax highlighting
  const renderTokenizedLine = (line: string) => {
    const tokens = tokenizeLine(line)
    const colorMap: Record<string, string> = {
      'invokeType': 'text-purple-400',
      'keyword': 'text-blue-400',
      'modifier': 'text-blue-300',
      'primitive': 'text-cyan-400',
      'classRef': 'text-emerald-400',
      'string': 'text-amber-400',
      'number': 'text-orange-300',
      'comment': 'text-gray-500 italic',
      'local': 'text-orange-400',
      'plain': 'text-gray-200',
    }

    return (
      <span className="whitespace-pre">
        {tokens.map((token, idx) => (
          <span
            key={idx}
            className={colorMap[token.type] || 'text-gray-200'}
          >
            {token.text}
          </span>
        ))}
      </span>
    )
  }

  // Jimple code highlighter component
  const JimpleHighlighter = ({ code }: { code: string }) => {
    const lines = code.split('\n')
    return (
      <div className="font-mono text-xs leading-5 select-text overflow-auto h-full p-4 bg-gray-900 dark:bg-black rounded">
        {lines.map((line, i) => (
          <div key={i} className="flex">
            <span className="select-none text-gray-600 dark:text-gray-500 w-10 text-right pr-3 shrink-0">{i + 1}</span>
            <span className="flex-1">{renderTokenizedLine(line)}</span>
          </div>
        ))}
      </div>
    )
  }

  // Filtered classes for search
  const filteredClasses = result?.classes.filter(cls =>
    cls.name.toLowerCase().includes(classSearchFilter.toLowerCase()) ||
    cls.packageName.toLowerCase().includes(classSearchFilter.toLowerCase())
  ) || []

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {showHelp && <HelpPanel onClose={() => setShowHelp(false)} />}
      {showJimpleIRInfo && <JimpleIRInfoPanel onClose={() => setShowJimpleIRInfo(false)} />}
      <PathPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={path => { setFolderPath(path); setPickerOpen(false) }}
        title="Select Jimple Folder"
        dirOnly={true}
      />
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
              {['apis', 'strings', 'classes', 'libraries', 'jimple'].map(tab => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab as ResultTab)
                    if (tab === 'jimple' && !selectedClassName && result?.classes.length) {
                      loadJimpleFile(result.classes[0].name)
                    }
                  }}
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
                  {tab === 'jimple' && 'Jimple Code'}
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

              {activeTab === 'jimple' && (
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  {/* Header with info button */}
                  <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-700 flex items-center justify-between">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Select a class to view decompiled Jimple code</span>
                    <button
                      onClick={() => setShowJimpleIRInfo(true)}
                      title="Learn about Jimple IR"
                      className="flex items-center gap-1 px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-600 transition-colors"
                    >
                      <HelpCircle size={13} />
                      Jimple IR
                    </button>
                  </div>

                  {/* Class selector and code viewer */}
                  <div className="flex-1 flex gap-3 h-full overflow-hidden">
                    {/* Class selector sidebar */}
                    <div className="flex flex-col w-1/3 border-r border-gray-200 dark:border-gray-700">
                    <input
                      type="text"
                      placeholder="Search classes..."
                      value={classSearchFilter}
                      onChange={e => setClassSearchFilter(e.target.value)}
                      className="px-3 py-2 text-xs rounded border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                    />
                    <div className="flex-1 overflow-y-auto scrollbar-thin">
                      {result.classes.length === 0 ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400 p-3">No classes found.</p>
                      ) : (
                        <div className="divide-y divide-gray-200 dark:divide-gray-700">
                          {filteredClasses.map((cls, idx) => (
                            <button
                              key={idx}
                              onClick={() => loadJimpleFile(cls.name)}
                              className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                                selectedClassName === cls.name
                                  ? 'bg-emerald-500/20 border-l-2 border-emerald-500 text-emerald-600 dark:text-emerald-400'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-surface-600'
                              }`}
                            >
                              <div className="font-mono truncate">{cls.name.split('.').pop()}</div>
                              <div className="text-[9px] text-gray-500 dark:text-gray-400 truncate">{cls.packageName}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Code viewer panel */}
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {!selectedClassName ? (
                      <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
                        <p className="text-sm">Select a class from the list</p>
                      </div>
                    ) : loadingJimple ? (
                      <div className="flex-1 flex items-center justify-center">
                        <p className="text-sm text-blue-600 dark:text-blue-400">⏳ Loading {selectedClassName}...</p>
                      </div>
                    ) : jimpleError ? (
                      <div className="p-4 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded">
                        <p className="text-xs text-red-700 dark:text-red-300 font-mono">{jimpleError}</p>
                      </div>
                    ) : jimpleContent ? (
                      <JimpleHighlighter code={jimpleContent} />
                    ) : null}
                  </div>
                  </div>
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
