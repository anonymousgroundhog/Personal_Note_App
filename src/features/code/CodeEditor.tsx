import React, { useEffect, useRef, useState, useCallback, lazy, Suspense } from 'react'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, indentWithTab, history, historyKeymap } from '@codemirror/commands'
import { indentOnInput, bracketMatching, foldGutter, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { python } from '@codemirror/lang-python'
import { java } from '@codemirror/lang-java'
import { cpp } from '@codemirror/lang-cpp'
import { javascript } from '@codemirror/lang-javascript'
import { markdown } from '@codemirror/lang-markdown'
import { useUiStore } from '../../stores/uiStore'
import {
  Play, Square, Terminal, ChevronDown, ChevronRight,
  FileCode, FilePlus, FolderOpen, X, AlertCircle, Folder,
  FileText, Settings, Search as SearchIcon, TerminalSquare,
} from 'lucide-react'
import type { TerminalPanelHandle } from './TerminalPanel'
const TerminalPanel = lazy(() => import('./TerminalPanel'))

// ── Types ──────────────────────────────────────────────────────────────────────

type Language = 'python' | 'node' | 'bash' | 'java' | 'cpp'

interface CodeFile {
  id: string
  name: string
  language: Language
  content: string
  /** true if loaded from disk (read-only display, editable in memory) */
  fromDisk?: boolean
}

interface FolderEntry {
  name: string
  path: string        // relative path inside folder
  language: Language
  file: File
}

interface FolderNode {
  name: string
  path: string
  children: FolderNode[]
  entry?: FolderEntry  // leaf files have this
}

interface RunCaps {
  python: string | null
  node: string | null
  bash: string | null
  java: string | null
}

interface OutputLine {
  type: 'stdout' | 'stderr' | 'info' | 'done'
  text: string
}

// ── Constants ──────────────────────────────────────────────────────────────────

const LANG_LABELS: Record<Language, string> = {
  python: 'Python', node: 'Node.js', bash: 'Shell', java: 'Java', cpp: 'C++',
}
const LANG_EXT: Record<Language, string> = {
  python: '.py', node: '.mjs', bash: '.sh', java: '.java', cpp: '.cpp',
}
const LANG_STARTERS: Record<Language, string> = {
  python: '# Python script\nprint("Hello, World!")\n',
  node: '// Node.js script\nconsole.log("Hello, World!");\n',
  bash: '#!/usr/bin/env bash\necho "Hello, World!"\n',
  java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n',
  cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}\n',
}
const LANG_COLORS: Record<Language, string> = {
  python: '#3b82f6', node: '#f59e0b', bash: '#10b981', java: '#ef4444', cpp: '#8b5cf6',
}
const EXT_MAP: Record<string, Language> = {
  py: 'python', python: 'python',
  js: 'node', mjs: 'node', cjs: 'node', ts: 'node',
  sh: 'bash', bash: 'bash', zsh: 'bash',
  java: 'java',
  cpp: 'cpp', cc: 'cpp', cxx: 'cpp', c: 'cpp', h: 'cpp',
}
const CODE_EXTS = new Set(Object.keys(EXT_MAP).concat(['txt', 'md', 'json', 'yaml', 'yml', 'toml', 'xml', 'csv', 'sql']))

const SERVER = `http://${window.location.hostname}:3001`
const STORAGE_KEY = 'code_editor_files_v2'

// ── Helpers ────────────────────────────────────────────────────────────────────

function getLangExtension(lang: Language) {
  switch (lang) {
    case 'python': return python()
    case 'node':   return javascript()
    case 'bash':   return markdown()
    case 'java':   return java()
    case 'cpp':    return cpp()
    default:       return []
  }
}

function langFromExt(name: string): Language {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  return EXT_MAP[ext] ?? 'python'
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const lang = EXT_MAP[ext]
  const color = lang ? LANG_COLORS[lang] : '#9ca3af'
  return <FileText size={13} style={{ color, flexShrink: 0 }} />
}

/** Split a shell-like arg string respecting single/double quotes */
function parseArgs(raw: string): string[] {
  const result: string[] = []
  let current = ''
  let quote: '"' | "'" | null = null
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (quote) {
      if (ch === quote) { quote = null }
      else { current += ch }
    } else if (ch === '"' || ch === "'") {
      quote = ch
    } else if (ch === ' ' || ch === '\t') {
      if (current) { result.push(current); current = '' }
    } else {
      current += ch
    }
  }
  if (current) result.push(current)
  return result
}

function newScratch(language: Language = 'python'): CodeFile {
  return {
    id: crypto.randomUUID(),
    name: `script${LANG_EXT[language]}`,
    language,
    content: LANG_STARTERS[language],
  }
}

function loadScratchFiles(): CodeFile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return [newScratch('python')]
}

function buildFolderTree(entries: FolderEntry[]): FolderNode[] {
  const root: FolderNode[] = []
  const dirs = new Map<string, FolderNode>()

  const getOrMakeDir = (parts: string[]): FolderNode[] => {
    if (parts.length === 0) return root
    const key = parts.join('/')
    if (!dirs.has(key)) {
      const node: FolderNode = { name: parts[parts.length - 1], path: key, children: [] }
      dirs.set(key, node)
      getOrMakeDir(parts.slice(0, -1)).push(node)
    }
    return dirs.get(key)!.children
  }

  const sorted = [...entries].sort((a, b) => a.path.localeCompare(b.path))
  for (const entry of sorted) {
    const parts = entry.path.split('/')
    const parent = getOrMakeDir(parts.slice(0, -1))
    parent.push({ name: parts[parts.length - 1], path: entry.path, children: [], entry })
  }

  // Sort: folders first, then files
  const sortNodes = (nodes: FolderNode[]) => {
    nodes.sort((a, b) => {
      const af = !a.entry, bf = !b.entry
      if (af !== bf) return af ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    nodes.forEach(n => sortNodes(n.children))
  }
  sortNodes(root)
  return root
}

// ── File Tree Node ─────────────────────────────────────────────────────────────

function TreeNode({
  node, depth, onOpen, activeId, openIds,
}: {
  node: FolderNode
  depth: number
  onOpen: (entry: FolderEntry) => void
  activeId: string
  openIds: Set<string>
}) {
  const [expanded, setExpanded] = useState(depth < 2)
  const isDir = !node.entry
  const isActive = node.entry && openIds.has(node.path)

  if (isDir) {
    return (
      <div>
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center gap-1 px-2 py-0.5 hover:bg-[#2a2d2e] text-[#cccccc] text-xs text-left"
          style={{ paddingLeft: `${8 + depth * 12}px` }}
        >
          {expanded ? <ChevronDown size={11} className="text-[#bbb] shrink-0" /> : <ChevronRight size={11} className="text-[#bbb] shrink-0" />}
          <Folder size={13} className="text-[#dcb67a] shrink-0" />
          <span className="truncate ml-1">{node.name}</span>
        </button>
        {expanded && node.children.map(child => (
          <TreeNode key={child.path} node={child} depth={depth + 1} onOpen={onOpen} activeId={activeId} openIds={openIds} />
        ))}
      </div>
    )
  }

  return (
    <button
      onClick={() => node.entry && onOpen(node.entry)}
      className={`w-full flex items-center gap-1.5 py-0.5 text-xs text-left truncate ${isActive ? 'bg-[#37373d] text-white' : 'text-[#cccccc] hover:bg-[#2a2d2e]'}`}
      style={{ paddingLeft: `${8 + depth * 12 + 14}px` }}
    >
      {fileIcon(node.name)}
      <span className="truncate">{node.name}</span>
    </button>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function CodeEditor() {
  const { darkMode } = useUiStore()

  // Scratch files (persisted)
  const [scratchFiles, setScratchFiles] = useState<CodeFile[]>(loadScratchFiles)
  // Files opened from a folder (in-memory, not persisted)
  const [folderFiles, setFolderFiles] = useState<CodeFile[]>([])
  // Folder tree
  const [folderName, setFolderName] = useState<string | null>(null)
  const [folderTree, setFolderTree] = useState<FolderNode[]>([])
  const [folderEntries, setFolderEntries] = useState<FolderEntry[]>([])

  const allFiles = [...scratchFiles, ...folderFiles]

  const [activeId, setActiveId] = useState<string>(() => loadScratchFiles()[0]?.id ?? '')
  const [output, setOutput] = useState<OutputLine[]>([])
  const [running, setRunning] = useState(false)
  const [caps, setCaps] = useState<RunCaps | null>(null)
  const [serverError, setServerError] = useState(false)
  const [showLangPicker, setShowLangPicker] = useState(false)
  const [stdin, setStdin] = useState('')
  const [args, setArgs] = useState('')
  const [showStdin, setShowStdin] = useState(false)
  const [explorerOpen, setExplorerOpen] = useState(true)
  const [explorerWidth, setExplorerWidth] = useState(220)
  const [outputHeight, setOutputHeight] = useState(200)
  const [bottomTab, setBottomTab] = useState<'output' | 'terminal'>('output')
  const [terminalMounted, setTerminalMounted] = useState(false)
  const terminalRef = useRef<TerminalPanelHandle>(null)
  const [folderSectionOpen, setFolderSectionOpen] = useState(true)
  const [scratchSectionOpen, setScratchSectionOpen] = useState(true)

  const editorRef = useRef<HTMLDivElement>(null)
  const editorViewRef = useRef<EditorView | null>(null)
  const abortRef = useRef<(() => void) | null>(null)
  const outputRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const explorerResizeRef = useRef<HTMLDivElement>(null)
  const outputResizeRef = useRef<HTMLDivElement>(null)

  const activeFile = allFiles.find(f => f.id === activeId) ?? allFiles[0]
  const openFolderIds = new Set(folderFiles.map(f => f.name)) // used for tree highlight

  // ── Runtime caps ─────────────────────────────────────────────────────────

  useEffect(() => {
    fetch(`${SERVER}/run/caps`)
      .then(r => r.json())
      .then(c => { setCaps(c); setServerError(false) })
      .catch(() => setServerError(true))
  }, [])

  // ── Persist scratch files ─────────────────────────────────────────────────

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scratchFiles))
  }, [scratchFiles])

  // ── CodeMirror ────────────────────────────────────────────────────────────

  const updateContent = useCallback((content: string) => {
    if (!activeFile) return
    if (scratchFiles.find(f => f.id === activeFile.id)) {
      setScratchFiles(prev => prev.map(f => f.id === activeFile.id ? { ...f, content } : f))
    } else {
      setFolderFiles(prev => prev.map(f => f.id === activeFile.id ? { ...f, content } : f))
    }
  }, [activeFile, scratchFiles])

  useEffect(() => {
    if (!editorRef.current || !activeFile) return

    const view = new EditorView({
      state: EditorState.create({
        doc: activeFile.content,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          history(),
          indentOnInput(),
          bracketMatching(),
          foldGutter(),
          syntaxHighlighting(defaultHighlightStyle),
          getLangExtension(activeFile.language),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          oneDark,
          EditorView.updateListener.of(update => {
            if (update.docChanged) updateContent(update.state.doc.toString())
          }),
          EditorView.theme({
            '&': { height: '100%', fontSize: '13px', backgroundColor: '#1e1e1e' },
            '.cm-scroller': { fontFamily: '"Cascadia Code", "JetBrains Mono", "Fira Code", monospace', overflow: 'auto' },
            '.cm-gutters': { backgroundColor: '#1e1e1e', borderRight: '1px solid #333' },
            '.cm-content': { caretColor: '#aeafad' },
          }),
        ],
      }),
      parent: editorRef.current,
    })
    editorViewRef.current = view
    return () => { view.destroy(); editorViewRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, updateContent])

  // ── Auto-scroll output ────────────────────────────────────────────────────

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight
  }, [output])

  // ── Resize: explorer panel ─────────────────────────────────────────────────

  useEffect(() => {
    const el = explorerResizeRef.current
    if (!el) return
    let startX = 0, startW = 0
    const onMove = (e: MouseEvent) => setExplorerWidth(Math.max(140, Math.min(500, startW + e.clientX - startX)))
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    const onDown = (e: MouseEvent) => {
      startX = e.clientX; startW = explorerWidth
      document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
    }
    el.addEventListener('mousedown', onDown)
    return () => el.removeEventListener('mousedown', onDown)
  }, [explorerWidth])

  // ── Resize: output panel ───────────────────────────────────────────────────

  useEffect(() => {
    const el = outputResizeRef.current
    if (!el) return
    let startY = 0, startH = 0
    const onMove = (e: MouseEvent) => setOutputHeight(Math.max(80, Math.min(600, startH - (e.clientY - startY))))
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    const onDown = (e: MouseEvent) => {
      startY = e.clientY; startH = outputHeight
      document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
    }
    el.addEventListener('mousedown', onDown)
    return () => el.removeEventListener('mousedown', onDown)
  }, [outputHeight])

  // ── Run code ──────────────────────────────────────────────────────────────

  const runCode = useCallback(async () => {
    if (!activeFile || running) return
    setRunning(true)
    const argStr = args.trim() ? ` ${args.trim()}` : ''
    setOutput([{ type: 'info', text: `> Running ${activeFile.name}${argStr}` }])
    const startTime = Date.now()
    try {
      const resp = await fetch(`${SERVER}/run/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: activeFile.language,
          code: activeFile.content,
          stdin,
          args: args.trim() ? parseArgs(args) : [],
        }),
      })
      if (!resp.ok || !resp.body) {
        const errText = await resp.text()
        setOutput(prev => [...prev, { type: 'stderr', text: errText }])
        setRunning(false)
        return
      }
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buf = '', cancelled = false
      abortRef.current = () => { cancelled = true; reader.cancel() }
      while (true) {
        const { value, done } = await reader.read()
        if (done || cancelled) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          try {
            const msg = JSON.parse(line.slice(5).trim())
            if (msg.type === 'stdout') setOutput(prev => [...prev, { type: 'stdout', text: msg.data }])
            else if (msg.type === 'stderr') setOutput(prev => [...prev, { type: 'stderr', text: msg.data }])
            else if (msg.type === 'done') {
              const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
              setOutput(prev => [...prev, {
                type: 'done',
                text: msg.data.code === 0 ? `\n> Process exited with code 0 (${elapsed}s)` : `\n> Process exited with code ${msg.data.code} (${elapsed}s)`,
              }])
            }
          } catch { /* ignore */ }
        }
      }
    } catch (e) {
      setOutput(prev => [...prev, { type: 'stderr', text: String(e) }])
    } finally {
      abortRef.current = null
      setRunning(false)
    }
  }, [activeFile, running, stdin])

  const stopCode = useCallback(() => {
    abortRef.current?.()
    setOutput(prev => [...prev, { type: 'info', text: '> Stopped' }])
    setRunning(false)
  }, [])

  // ── Open single file ──────────────────────────────────────────────────────

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const language = langFromExt(file.name)
    const reader = new FileReader()
    reader.onload = ev => {
      const f: CodeFile = { id: crypto.randomUUID(), name: file.name, language, content: ev.target?.result as string, fromDisk: true }
      setScratchFiles(prev => [...prev, f])
      setActiveId(f.id)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // ── Open folder ───────────────────────────────────────────────────────────

  const onFolderInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    const entries: FolderEntry[] = []
    let rootName = ''
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const rel: string = (file as File & { webkitRelativePath: string }).webkitRelativePath
      if (!rel) continue
      if (!rootName) rootName = rel.split('/')[0]
      // strip leading folder name
      const path = rel.includes('/') ? rel.slice(rel.indexOf('/') + 1) : rel
      if (!path) continue
      // skip hidden / node_modules
      if (path.split('/').some(p => p.startsWith('.') || p === 'node_modules' || p === '__pycache__')) continue
      const ext = path.split('.').pop()?.toLowerCase() ?? ''
      if (!CODE_EXTS.has(ext)) continue
      entries.push({ name: path.split('/').pop() ?? path, path, language: langFromExt(path), file })
    }
    setFolderName(rootName)
    setFolderEntries(entries)
    setFolderTree(buildFolderTree(entries))
    setFolderFiles([])
    setFolderSectionOpen(true)
    e.target.value = ''
  }

  const openFolderEntry = async (entry: FolderEntry) => {
    // If already open, just switch to it
    const existing = folderFiles.find(f => f.name === entry.path)
    if (existing) { setActiveId(existing.id); return }
    const text = await entry.file.text()
    const f: CodeFile = { id: crypto.randomUUID(), name: entry.path, language: entry.language, content: text, fromDisk: true }
    setFolderFiles(prev => [...prev, f])
    setActiveId(f.id)
  }

  // ── Scratch file management ───────────────────────────────────────────────

  const addScratch = (lang: Language) => {
    const f = newScratch(lang)
    setScratchFiles(prev => [...prev, f])
    setActiveId(f.id)
    setShowLangPicker(false)
  }

  const closeFile = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const isScratch = !!scratchFiles.find(f => f.id === id)
    if (isScratch) {
      setScratchFiles(prev => {
        const next = prev.filter(f => f.id !== id)
        if (next.length === 0) {
          const f = newScratch('python')
          setActiveId(f.id)
          return [f]
        }
        if (id === activeId) setActiveId(next[next.length - 1].id)
        return next
      })
    } else {
      setFolderFiles(prev => {
        const next = prev.filter(f => f.id !== id)
        if (id === activeId) {
          const fallback = [...scratchFiles, ...next]
          setActiveId(fallback[fallback.length - 1]?.id ?? '')
        }
        return next
      })
    }
  }

  const openTerminal = useCallback(() => {
    setTerminalMounted(true)
    setBottomTab('terminal')
    setTimeout(() => terminalRef.current?.focus(), 50)
  }, [])

  // Ctrl+` shortcut to toggle terminal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === '`') { e.preventDefault(); openTerminal() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [openTerminal])

  const canRun = !serverError && caps && activeFile &&
    (caps[activeFile.language as keyof RunCaps] !== null && caps[activeFile.language as keyof RunCaps] !== undefined)

  // ── Tab display name ──────────────────────────────────────────────────────

  const tabName = (f: CodeFile) => f.name.includes('/') ? f.name.split('/').pop()! : f.name

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden" style={{ background: '#1e1e1e', color: '#cccccc', fontFamily: 'system-ui, sans-serif' }}>

      {/* Hidden inputs */}
      <input ref={fileInputRef} type="file" className="hidden"
        accept=".py,.js,.mjs,.ts,.sh,.bash,.java,.cpp,.cc,.c,.h,.txt,.md,.json,.yaml,.yml"
        onChange={onFileInput} />
      <input ref={folderInputRef} type="file" className="hidden"
        // @ts-expect-error webkitdirectory
        webkitdirectory="" multiple onChange={onFolderInput} />

      {/* ── Activity Bar ── */}
      <div className="flex flex-col items-center py-2 gap-1 shrink-0" style={{ width: 48, background: '#333333', borderRight: '1px solid #252526' }}>
        <button
          onClick={() => setExplorerOpen(o => !o)}
          title="Explorer"
          className={`w-10 h-10 flex items-center justify-center rounded hover:text-white transition-colors ${explorerOpen ? 'text-white border-l-2 border-white' : 'text-[#858585]'}`}
        >
          <FileCode size={22} />
        </button>
        <button title="Search (not implemented)" className="w-10 h-10 flex items-center justify-center text-[#858585] hover:text-white rounded transition-colors">
          <SearchIcon size={22} />
        </button>
        <div className="flex-1" />
        <button title="Settings (not implemented)" className="w-10 h-10 flex items-center justify-center text-[#858585] hover:text-white rounded transition-colors">
          <Settings size={20} />
        </button>
      </div>

      {/* ── Explorer Panel ── */}
      {explorerOpen && (
        <div className="flex flex-col shrink-0 overflow-hidden" style={{ width: explorerWidth, background: '#252526', borderRight: '1px solid #1e1e1e' }}>

          {/* Panel header */}
          <div className="px-3 py-2 flex items-center justify-between shrink-0" style={{ borderBottom: '1px solid #1e1e1e' }}>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-[#bbbbbb]">Explorer</span>
            <div className="flex items-center gap-1">
              <button onClick={() => folderInputRef.current?.click()} title="Open Folder" className="text-[#858585] hover:text-white p-0.5 rounded">
                <FolderOpen size={14} />
              </button>
              <button onClick={() => fileInputRef.current?.click()} title="Open File" className="text-[#858585] hover:text-white p-0.5 rounded">
                <FilePlus size={14} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#424242 transparent' }}>

            {/* ── Folder section ── */}
            {folderName && (
              <div>
                <button
                  onClick={() => setFolderSectionOpen(o => !o)}
                  className="w-full flex items-center gap-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-[#bbbbbb] hover:bg-[#2a2d2e]"
                >
                  {folderSectionOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                  <Folder size={12} className="text-[#dcb67a]" />
                  <span className="truncate ml-1">{folderName}</span>
                </button>
                {folderSectionOpen && (
                  <div>
                    {folderTree.map(node => (
                      <TreeNode
                        key={node.path}
                        node={node}
                        depth={0}
                        onOpen={openFolderEntry}
                        activeId={activeId}
                        openIds={new Set(folderFiles.map(f => f.name))}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Scratch files section ── */}
            <div>
              <button
                onClick={() => setScratchSectionOpen(o => !o)}
                className="w-full flex items-center gap-1 px-2 py-1 text-[11px] font-semibold uppercase tracking-widest text-[#bbbbbb] hover:bg-[#2a2d2e]"
              >
                {scratchSectionOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                <span className="ml-1">Scratch Files</span>
                <button
                  onClick={e => { e.stopPropagation(); setShowLangPicker(s => !s) }}
                  className="ml-auto text-[#858585] hover:text-white p-0.5 rounded"
                  title="New scratch file"
                >
                  <FilePlus size={12} />
                </button>
              </button>

              {showLangPicker && (
                <div className="mx-2 mb-1 rounded overflow-hidden border border-[#454545]" style={{ background: '#2d2d2d' }}>
                  {(Object.keys(LANG_LABELS) as Language[]).map(lang => (
                    <button
                      key={lang}
                      onClick={() => addScratch(lang)}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-[#37373d] text-[#cccccc] flex items-center gap-2"
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: LANG_COLORS[lang] }} />
                      {LANG_LABELS[lang]}
                    </button>
                  ))}
                </div>
              )}

              {scratchSectionOpen && scratchFiles.map(f => (
                <button
                  key={f.id}
                  onClick={() => setActiveId(f.id)}
                  className={`group w-full flex items-center gap-1.5 py-0.5 text-xs text-left ${f.id === activeId ? 'text-white' : 'text-[#cccccc] hover:bg-[#2a2d2e]'}`}
                  style={{
                    paddingLeft: '22px',
                    background: f.id === activeId ? '#37373d' : undefined,
                  }}
                >
                  {fileIcon(f.name)}
                  <span className="truncate flex-1">{f.name}</span>
                  <button
                    onClick={e => closeFile(f.id, e)}
                    className="opacity-0 group-hover:opacity-100 text-[#858585] hover:text-white mr-2 shrink-0"
                  >
                    <X size={11} />
                  </button>
                </button>
              ))}
            </div>
          </div>

          {/* Resize handle */}
          <div
            ref={explorerResizeRef}
            className="absolute top-0 h-full cursor-col-resize z-10"
            style={{ left: 48 + explorerWidth - 3, width: 6 }}
          />
        </div>
      )}

      {/* ── Main Editor Area ── */}
      <div className="flex flex-col flex-1 overflow-hidden" style={{ background: '#1e1e1e' }}>

        {/* ── Toolbar ── */}
        <div className="flex items-center gap-2 px-3 shrink-0" style={{ height: 36, background: '#323233', borderBottom: '1px solid #252526' }}>

          {running ? (
            <button onClick={stopCode}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium text-white"
              style={{ background: '#f14c4c' }}>
              <Square size={11} fill="white" /> Stop
            </button>
          ) : (
            <button onClick={runCode} disabled={!canRun}
              title={serverError ? 'Code runner server offline' : !canRun ? `${LANG_LABELS[activeFile?.language ?? 'python']} not installed` : `Run ${activeFile?.name}`}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: canRun ? '#388a34' : '#5a5a5a' }}>
              <Play size={11} fill="white" /> Run
            </button>
          )}

          {/* Language badge */}
          {activeFile && (
            <span className="text-xs px-2 py-0.5 rounded font-mono shrink-0" style={{ background: '#3c3c3c', color: LANG_COLORS[activeFile.language] }}>
              {LANG_LABELS[activeFile.language]}
            </span>
          )}

          {/* Args input */}
          <div className="flex items-center flex-1 mx-2 rounded px-2 gap-1.5" style={{ background: '#3c3c3c', border: '1px solid #555' }}>
            <span className="text-[11px] font-mono shrink-0" style={{ color: '#858585' }}>args:</span>
            <input
              value={args}
              onChange={e => setArgs(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canRun && !running) runCode() }}
              placeholder={`--flag value "spaced arg"`}
              className="flex-1 bg-transparent outline-none text-xs font-mono py-1"
              style={{ color: '#d4d4d4', minWidth: 0 }}
              title="Command-line arguments passed to the script"
            />
          </div>

          {/* Runtime indicators */}
          {serverError ? (
            <div className="flex items-center gap-1 text-xs" style={{ color: '#f14c4c' }}>
              <AlertCircle size={12} /> server offline
            </div>
          ) : caps ? (
            <div className="flex items-center gap-1.5">
              {(Object.entries(caps) as [string, string | null][]).map(([lang, ver]) => (
                <span key={lang} className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                  style={{ background: ver ? '#1e3a1e' : '#3c3c3c', color: ver ? '#4ec94e' : '#666' }}
                  title={ver ?? `${lang} not found`}>
                  {lang}
                </span>
              ))}
            </div>
          ) : null}

          {/* stdin toggle */}
          <button onClick={() => setShowStdin(s => !s)}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
            style={{ background: showStdin ? '#094771' : '#3c3c3c', color: showStdin ? '#fff' : '#cccccc' }}
            title="Toggle stdin">
            <Terminal size={11} /> stdin
          </button>

          {/* Terminal button */}
          <button onClick={openTerminal}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
            style={{ background: bottomTab === 'terminal' && terminalMounted ? '#1e4d78' : '#3c3c3c', color: '#cccccc' }}
            title="Open terminal (Ctrl+`)">
            <TerminalSquare size={11} /> Terminal
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-end overflow-x-auto shrink-0" style={{ background: '#252526', borderBottom: '1px solid #1e1e1e', minHeight: 35 }}>
          {allFiles.map(f => (
            <div
              key={f.id}
              onClick={() => setActiveId(f.id)}
              className="group flex items-center gap-2 px-4 cursor-pointer shrink-0 select-none"
              style={{
                height: 35,
                fontSize: 13,
                background: f.id === activeId ? '#1e1e1e' : 'transparent',
                color: f.id === activeId ? '#ffffff' : '#969696',
                borderTop: f.id === activeId ? '1px solid #007acc' : '1px solid transparent',
                borderRight: '1px solid #252526',
              }}
            >
              {fileIcon(f.name)}
              <span className="whitespace-nowrap">{tabName(f)}</span>
              <button
                onClick={e => closeFile(f.id, e)}
                className="opacity-0 group-hover:opacity-100 hover:text-white rounded"
                style={{ color: '#969696', marginLeft: 2 }}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>

        {/* ── Stdin bar ── */}
        {showStdin && (
          <div className="flex items-center gap-2 px-3 py-1.5 shrink-0" style={{ background: '#094771', borderBottom: '1px solid #1e1e1e' }}>
            <span className="text-xs font-mono text-[#9cdcfe] shrink-0">stdin:</span>
            <input
              value={stdin}
              onChange={e => setStdin(e.target.value)}
              placeholder="Input for the program (newline-separated for multiple lines)"
              className="flex-1 text-xs font-mono bg-transparent outline-none"
              style={{ color: '#d4d4d4' }}
            />
          </div>
        )}

        {/* ── Editor + Terminal ── */}
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Editor */}
          <div className="flex-1 overflow-hidden">
            {activeFile ? (
              <div ref={editorRef} className="h-full" />
            ) : (
              <div className="flex h-full items-center justify-center text-[#555]">
                <div className="text-center">
                  <FileCode size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Open a file to start editing</p>
                </div>
              </div>
            )}
          </div>

          {/* Output resize handle */}
          <div
            ref={outputResizeRef}
            className="shrink-0 cursor-row-resize flex items-center justify-center"
            style={{ height: 4, background: '#1e1e1e', borderTop: '1px solid #3c3c3c' }}
          >
            <div style={{ width: 40, height: 2, background: '#555', borderRadius: 1 }} />
          </div>

          {/* Bottom panel: Output + Terminal tabs */}
          <div className="shrink-0 flex flex-col overflow-hidden" style={{ height: outputHeight, background: '#1e1e1e', borderTop: '1px solid #252526' }}>
            {/* Tab bar */}
            <div className="flex items-center shrink-0" style={{ height: 30, background: '#252526', borderBottom: '1px solid #1e1e1e' }}>
              {/* Output tab */}
              <button
                onClick={() => setBottomTab('output')}
                className="flex items-center gap-1.5 px-3 h-full text-xs border-t-2 transition-colors"
                style={{
                  borderColor: bottomTab === 'output' ? '#007acc' : 'transparent',
                  color: bottomTab === 'output' ? '#ffffff' : '#969696',
                  background: 'transparent',
                }}
              >
                <Terminal size={11} /> Output
              </button>
              {/* Terminal tab */}
              <button
                onClick={() => {
                  setTerminalMounted(true)
                  setBottomTab('terminal')
                  setTimeout(() => terminalRef.current?.focus(), 50)
                }}
                className="flex items-center gap-1.5 px-3 h-full text-xs border-t-2 transition-colors"
                style={{
                  borderColor: bottomTab === 'terminal' ? '#007acc' : 'transparent',
                  color: bottomTab === 'terminal' ? '#ffffff' : '#969696',
                  background: 'transparent',
                }}
              >
                <TerminalSquare size={11} /> Terminal
              </button>
              <div className="flex-1" />
              {bottomTab === 'output' && (
                <button onClick={() => setOutput([])} className="text-xs hover:text-white px-2 py-0.5 rounded mr-2" style={{ color: '#969696', fontSize: 11 }}>
                  Clear
                </button>
              )}
            </div>

            {/* Output panel */}
            <div
              ref={outputRef}
              className="flex-1 overflow-y-auto p-3"
              style={{
                fontFamily: '"Cascadia Code","JetBrains Mono","Fira Code",monospace',
                fontSize: 12,
                lineHeight: '1.6',
                display: bottomTab === 'output' ? 'block' : 'none',
              }}
            >
              {output.length === 0 ? (
                <span style={{ color: '#555' }}>$ Run a file to see output here</span>
              ) : (
                output.map((line, i) => (
                  <div key={i} style={{
                    color: line.type === 'stderr' ? '#f48771'
                      : line.type === 'info'   ? '#569cd6'
                      : line.type === 'done'   ? (line.text.includes('code 0') ? '#4ec94e' : '#f48771')
                      : '#d4d4d4',
                    whiteSpace: 'pre-wrap',
                  }}>
                    {line.text}
                  </div>
                ))
              )}
            </div>

            {/* xterm.js terminal — lazy-mounted on first open, hidden not destroyed when switching tabs */}
            <div className="flex-1 overflow-hidden" style={{ display: bottomTab === 'terminal' ? 'flex' : 'none', flexDirection: 'column' }}>
              {terminalMounted && (
                <Suspense fallback={<div style={{ color: '#555', padding: 12, fontSize: 12 }}>Loading terminal…</div>}>
                  <TerminalPanel ref={terminalRef} />
                </Suspense>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
