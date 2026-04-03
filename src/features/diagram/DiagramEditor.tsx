import React, {
  useState, useRef, useCallback, useEffect, useMemo,
} from 'react'
import { useUiStore } from '../../stores/uiStore'
import { useVaultStore } from '../../stores/vaultStore'
import MermaidDiagram from '../../components/MermaidDiagram'
import { nodeShapePath } from './diagramUtils'
import { computeMindmapLayout, getMindmapNodeColor, getMindmapBranchColor } from './mindmapLayout'
import { MINDMAP_THEMES, getActiveTheme } from './mindmapThemes'

// ─── WebviewNode overlay component ───────────────────────────────────────────

interface WebviewNodeProps {
  node: { id: string; x: number; y: number; w: number; h: number; label: string; webviewUrl?: string }
  viewport: { x: number; y: number; scale: number }
  isSel: boolean
  darkMode: boolean
  isEditing: boolean
  editingValue: string
  onFocusUrl: () => void
  onChangeUrl: (v: string) => void
  onCommitUrl: (raw: string) => void
  onCancelEdit: () => void
  onReload: () => void
}

function WebviewNode({
  node, viewport, isSel, darkMode,
  isEditing, editingValue,
  onFocusUrl, onChangeUrl, onCommitUrl, onCancelEdit, onReload,
}: WebviewNodeProps) {
  // Whether the user has chosen to show the iframe (toggled on demand)
  const [showIframe, setShowIframe] = useState(false)

  // Reset iframe toggle whenever URL changes
  useEffect(() => { setShowIframe(false) }, [node.webviewUrl])

  const left   = node.x * viewport.scale + viewport.x
  const top    = node.y * viewport.scale + viewport.y
  const width  = node.w * viewport.scale
  const height = node.h * viewport.scale
  const titleH = 28 * viewport.scale
  const bodyH  = height - titleH

  return (
    <div className="absolute" style={{ left, top, width, height, pointerEvents: 'none' }}>

      {/* Title bar — always interactive */}
      {(isSel || isEditing) && (
        <div
          className="absolute top-0 left-0 right-0 flex items-center gap-1 px-1.5"
          style={{ height: titleH, pointerEvents: 'auto', zIndex: 20 }}
          onMouseDown={e => e.stopPropagation()}
        >
          <span style={{ fontSize: 13 * viewport.scale }}>🌐</span>
          <input
            key={node.id + '-url'}
            type="text"
            defaultValue={node.webviewUrl ?? ''}
            autoFocus={isEditing}
            placeholder="https://example.com"
            onFocus={e => { onFocusUrl(); e.target.select() }}
            onChange={e => onChangeUrl(e.target.value)}
            onBlur={e => onCommitUrl(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') onCancelEdit()
              e.stopPropagation()
            }}
            style={{
              flex: 1, fontSize: Math.max(9, 11 * viewport.scale),
              background: 'transparent', border: 'none', outline: 'none',
              color: isSel ? 'white' : darkMode ? '#a5b4fc' : '#4338ca',
              fontFamily: 'inherit', minWidth: 0,
            }}
          />
          {node.webviewUrl && (
            <button
              title="Reload"
              style={{ fontSize: 11 * viewport.scale, color: isSel ? 'white' : '#6366f1', lineHeight: 1, flexShrink: 0 }}
              onClick={onReload}
            >↺</button>
          )}
        </div>
      )}

      {/* Body area */}
      {node.webviewUrl ? (
        <div style={{ position: 'absolute', left: 0, top: titleH, width: '100%', height: bodyH }}>

          {showIframe ? (
            /* ── Iframe view ── */
            <>
              <iframe
                src={node.webviewUrl}
                title={node.label}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                  border: 'none', borderRadius: '0 0 6px 6px',
                  pointerEvents: isSel ? 'none' : 'auto',
                }}
              />
              {/* "Back" button overlay — always accessible when selected */}
              {isSel && (
                <button
                  onMouseDown={e => e.stopPropagation()}
                  onClick={() => setShowIframe(false)}
                  style={{
                    position: 'absolute', bottom: 8, right: 8,
                    padding: '4px 10px', background: 'rgba(0,0,0,0.55)',
                    color: 'white', border: 'none', borderRadius: 5,
                    fontSize: Math.max(9, 10 * viewport.scale), cursor: 'pointer',
                    pointerEvents: 'auto',
                  }}
                >
                  ✕ Close embed
                </button>
              )}
            </>
          ) : (
            /* ── Default: URL card + actions ── */
            <div
              style={{
                position: 'absolute', inset: 0, borderRadius: '0 0 6px 6px',
                background: darkMode ? '#1e1e2e' : '#f5f5ff',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: Math.max(8, 10 * viewport.scale),
                padding: Math.max(12, 16 * viewport.scale),
                pointerEvents: 'auto',
              }}
              onMouseDown={e => e.stopPropagation()}
            >
              <span style={{ fontSize: Math.max(20, 26 * viewport.scale) }}>🌐</span>
              <p style={{
                margin: 0, textAlign: 'center',
                fontSize: Math.max(9, 11 * viewport.scale),
                color: darkMode ? '#9ca3af' : '#6b7280',
                wordBreak: 'break-all', maxWidth: '100%',
                lineHeight: 1.4,
              }}>{node.webviewUrl}</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  onClick={() => window.open(node.webviewUrl, '_blank', 'noopener,noreferrer')}
                  style={{
                    padding: `${Math.max(5, 6 * viewport.scale)}px ${Math.max(10, 12 * viewport.scale)}px`,
                    background: '#6366f1', color: 'white', border: 'none', borderRadius: 6,
                    fontSize: Math.max(9, 11 * viewport.scale), cursor: 'pointer', fontWeight: 500,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <span>↗</span> Open in new tab
                </button>
                <button
                  onClick={() => setShowIframe(true)}
                  style={{
                    padding: `${Math.max(5, 6 * viewport.scale)}px ${Math.max(10, 12 * viewport.scale)}px`,
                    background: 'transparent', color: darkMode ? '#818cf8' : '#6366f1',
                    border: `1px solid ${darkMode ? '#4338ca' : '#c7d2fe'}`,
                    borderRadius: 6,
                    fontSize: Math.max(9, 11 * viewport.scale), cursor: 'pointer', fontWeight: 500,
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  <span>⬜</span> Try embed
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* No URL yet */
        <div style={{
          position: 'absolute', left: 0, top: titleH, width: '100%', height: bodyH,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 6, pointerEvents: 'none',
          color: darkMode ? '#6366f1' : '#818cf8',
          fontSize: Math.max(10, 12 * viewport.scale),
        }}>
          <span style={{ fontSize: Math.max(20, 28 * viewport.scale) }}>🌐</span>
          <span style={{ fontWeight: 500 }}>Double-click to enter URL</span>
        </div>
      )}
    </div>
  )
}

// ─── Mermaid canvas node overlay ─────────────────────────────────────────────

function MermaidCanvasNode({ node, viewport, onMouseDown, scrollDivRef }: {
  node: { id: string; x: number; y: number; w: number; h: number; mermaidCode?: string }
  viewport: { x: number; y: number; scale: number }
  onMouseDown: (e: React.MouseEvent) => void
  scrollDivRef: (el: HTMLDivElement | null) => void
}) {
  const left   = node.x * viewport.scale + viewport.x
  const top    = node.y * viewport.scale + viewport.y
  const width  = node.w * viewport.scale
  const height = node.h * viewport.scale
  return (
    <div className="absolute" style={{ left, top, width, height, pointerEvents: 'none' }}>
      {node.mermaidCode ? (
        <div
          ref={scrollDivRef}
          onMouseDown={onMouseDown}
          style={{
            width: node.w,
            height: node.h,
            overflow: 'auto',
            pointerEvents: 'auto',
            transform: `scale(${viewport.scale})`,
            transformOrigin: 'top left',
            cursor: 'grab',
          }}
        >
          <MermaidDiagram code={node.mermaidCode} />
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 bg-gray-50 dark:bg-surface-800">
          No diagram code
        </div>
      )}
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type NodeShape =
  | 'rect' | 'diamond' | 'circle' | 'parallelogram' | 'cylinder' | 'hexagon'
  | 'server' | 'cloud' | 'router' | 'firewall' | 'laptop' | 'phone'
  | 'note' | 'webview' | 'mermaid'

export interface DiagramNode {
  id: string
  x: number
  y: number
  w: number
  h: number
  shape: NodeShape
  label: string
  color: string
  textColor: string
  strokeWidth: number
  notePath?: string
  isRoot?: boolean
  webviewUrl?: string
  mermaidCode?: string
}

export interface DiagramEdge {
  id: string
  fromId: string
  toId: string
  label: string
  style: 'solid' | 'dashed' | 'dotted'
  arrow: 'end' | 'both' | 'none'
  strokeWidth: number
  color?: string
}

export interface Diagram {
  id: string
  name: string
  nodes: DiagramNode[]
  edges: DiagramEdge[]
  transparentBg: boolean
  mindmapMode?: boolean
  mindmapTheme?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'diagramEditor_diagrams'
const DEFAULT_NODE_W = 140
const DEFAULT_NODE_H = 60
const GRID = 10
const snap = (v: number) => Math.round(v / GRID) * GRID

const PALETTE_SHAPES: { shape: NodeShape; label: string; icon: string; section: string }[] = [
  // Flowchart
  { shape: 'rect',          label: 'Process',   icon: '▭', section: 'Flow' },
  { shape: 'diamond',       label: 'Decision',  icon: '◇', section: 'Flow' },
  { shape: 'circle',        label: 'Start/End', icon: '○', section: 'Flow' },
  { shape: 'parallelogram', label: 'I/O',       icon: '▱', section: 'Flow' },
  { shape: 'cylinder',      label: 'Database',  icon: '⬭', section: 'Flow' },
  { shape: 'hexagon',       label: 'Prep',      icon: '⬡', section: 'Flow' },
  // Web
  { shape: 'webview',  label: 'Web View', icon: '🌐', section: 'Web' },
  // Network
  { shape: 'server',   label: 'Server',   icon: '🖥', section: 'Network' },
  { shape: 'cloud',    label: 'Cloud',    icon: '☁', section: 'Network' },
  { shape: 'router',   label: 'Router',   icon: '⬡', section: 'Network' },
  { shape: 'firewall', label: 'Firewall', icon: '🛡', section: 'Network' },
  { shape: 'laptop',   label: 'Laptop',   icon: '💻', section: 'Network' },
  { shape: 'phone',    label: 'Phone',    icon: '📱', section: 'Network' },
]

const COLOR_PRESETS = [
  '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#6b7280',
]

/** Icon overlay for network shapes */
function networkIcon(shape: NodeShape): string | null {
  switch (shape) {
    case 'server':   return '🖥'
    case 'cloud':    return '☁'
    case 'router':   return '⬡'
    case 'firewall': return '🛡'
    case 'laptop':   return '💻'
    case 'phone':    return '📱'
    default:         return null
  }
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────

const NETWORK_SHAPES = new Set<NodeShape>(['server','cloud','router','firewall','laptop','phone'])
function isNetworkShape(shape: NodeShape) { return NETWORK_SHAPES.has(shape) }

function uid() { return Math.random().toString(36).slice(2, 9) }

function getNodeCenter(n: DiagramNode): [number, number] {
  return [n.x + n.w / 2, n.y + n.h / 2]
}

function getBorderPoint(n: DiagramNode, tx: number, ty: number): [number, number] {
  const cx = n.x + n.w / 2
  const cy = n.y + n.h / 2
  // Network shapes have no box — connect from a small radius around icon center
  if (isNetworkShape(n.shape)) {
    const r = 28
    const dx = tx - cx, dy = ty - cy
    if (dx === 0 && dy === 0) return [cx, cy]
    const len = Math.hypot(dx, dy)
    return [cx + (dx / len) * r, cy + (dy / len) * r]
  }
  const dx = tx - cx
  const dy = ty - cy
  if (dx === 0 && dy === 0) return [cx, cy]
  if (n.shape === 'circle') {
    const r = Math.min(n.w, n.h) / 2
    const len = Math.hypot(dx, dy)
    return [cx + (dx / len) * r, cy + (dy / len) * r]
  }
  if (n.shape === 'diamond') {
    const hw = n.w / 2, hh = n.h / 2
    const t1 = Math.min(Math.abs(hw / (dx || 0.001)), Math.abs(hh / (dy || 0.001)))
    return [cx + dx * t1, cy + dy * t1]
  }
  const hw = n.w / 2, hh = n.h / 2
  const tx1 = Math.abs(dx) > 0.001 ? hw / Math.abs(dx) : Infinity
  const ty1 = Math.abs(dy) > 0.001 ? hh / Math.abs(dy) : Infinity
  const t = Math.min(tx1, ty1)
  return [cx + dx * t, cy + dy * t]
}

const ARROW_LEN = 10 // must match markerWidth in <defs>

function edgePath(from: DiagramNode, to: DiagramNode, arrowEnd = false, arrowStart = false): string {
  const [tcx, tcy] = getNodeCenter(to)
  const [fcx, fcy] = getNodeCenter(from)
  let [bfx, bfy] = getBorderPoint(from, tcx, tcy)
  let [btx, bty] = getBorderPoint(to, fcx, fcy)

  // Retract endpoints so the arrowhead tip lands exactly on the border point
  // We use the straight-line direction between border points as the approach angle
  if (arrowEnd || arrowStart) {
    const len = Math.hypot(btx - bfx, bty - bfy)
    if (len > 0.001) {
      const ux = (btx - bfx) / len
      const uy = (bty - bfy) / len
      if (arrowEnd) { btx -= ux * ARROW_LEN; bty -= uy * ARROW_LEN }
      if (arrowStart) { bfx += ux * ARROW_LEN; bfy += uy * ARROW_LEN }
    }
  }

  const dx = btx - bfx
  return `M ${bfx} ${bfy} C ${bfx + dx * 0.5} ${bfy} ${btx - dx * 0.5} ${bty} ${btx} ${bty}`
}

// ─── Storage ──────────────────────────────────────────────────────────────────

function loadDiagrams(): Diagram[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const diagrams = JSON.parse(raw) as Diagram[]
      // Ensure all diagrams have mindmap fields
      return diagrams.map(d => ({
        ...d,
        mindmapMode: d.mindmapMode ?? false,
        mindmapTheme: d.mindmapTheme ?? 'Rainbow',
      }))
    }
  } catch {}
  return [{ id: uid(), name: 'Untitled Diagram', nodes: [], edges: [], transparentBg: false, mindmapMode: false, mindmapTheme: 'Rainbow' }]
}

function saveDiagrams(diagrams: Diagram[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(diagrams)) } catch {}
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DiagramEditor() {
  const { darkMode } = useUiStore()
  const { index, saveNote, readNote } = useVaultStore()

  // ── Diagram state ──
  const [diagrams, setDiagrams] = useState<Diagram[]>(loadDiagrams)
  const [activeDiagramId, setActiveDiagramId] = useState<string>(() => loadDiagrams()[0].id)

  const diagram = useMemo(
    () => diagrams.find(d => d.id === activeDiagramId) ?? diagrams[0],
    [diagrams, activeDiagramId]
  )

  const updateDiagram = useCallback((patch: Partial<Omit<Diagram, 'id'>>) => {
    setDiagrams(ds => {
      const next = ds.map(d => d.id === activeDiagramId ? { ...d, ...patch } : d)
      saveDiagrams(next)
      return next
    })
  }, [activeDiagramId])

  // ── Selection ──
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

  // ── Viewport ──
  const [viewport, setViewport] = useState({ x: 40, y: 40, scale: 1 })

  // ── Canvas drag state for cursor feedback ──
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false)

  // ── Note popup ──
  const [notePopup, setNotePopup] = useState<{ nodeId: string; screenX: number; screenY: number } | null>(null)
  const notePopupHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleHidePopup = useCallback(() => {
    notePopupHideTimer.current = setTimeout(() => setNotePopup(null), 120)
  }, [])
  const cancelHidePopup = useCallback(() => {
    if (notePopupHideTimer.current) clearTimeout(notePopupHideTimer.current)
  }, [])

  // ── Drag ──
  const dragRef = useRef<{
    type: 'node' | 'canvas' | 'select'
    nodeIds?: string[]
    startClient: [number, number]
    startNodePos?: [number, number][]
    startVp?: { x: number; y: number }
    startCanvas?: [number, number]
  } | null>(null)

  // ── Rubber-band selection rect (in canvas coords) ──
  const [selectionRect, setSelectionRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  // ── Connect mode ──
  // connectMode: whether connect tool is active
  // connectFromId: the source node id (null = waiting to click source)
  const [connectMode, setConnectMode] = useState(false)
  const [connectFromId, setConnectFromId] = useState<string | null>(null)
  // Default edge style for new connections
  const [defaultEdgeStyle, setDefaultEdgeStyle] = useState<DiagramEdge['style']>('solid')
  const [defaultEdgeArrow, setDefaultEdgeArrow] = useState<DiagramEdge['arrow']>('end')

  // ── Inline label edit ──
  const [editingLabel, setEditingLabel] = useState<{ type: 'node' | 'edge'; id: string; value: string } | null>(null)

  // ── Props panel always visible ──
  const [showProps, setShowProps] = useState(true)

  // ── Resizable panel widths ──
  const [paletteWidth, setPaletteWidth] = useState(76)
  const [propsWidth, setPropsWidth] = useState(208) // w-52 = 208px
  const paletteResizeRef = useRef<{ startX: number; startW: number } | null>(null)
  const propsResizeRef   = useRef<{ startX: number; startW: number } | null>(null)

  const startPaletteResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    paletteResizeRef.current = { startX: e.clientX, startW: paletteWidth }
    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - paletteResizeRef.current!.startX
      setPaletteWidth(Math.max(60, Math.min(200, paletteResizeRef.current!.startW + delta)))
    }
    const onUp = () => {
      paletteResizeRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [paletteWidth])

  const startPropsResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    propsResizeRef.current = { startX: e.clientX, startW: propsWidth }
    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - propsResizeRef.current!.startX
      setPropsWidth(Math.max(160, Math.min(400, propsResizeRef.current!.startW - delta)))
    }
    const onUp = () => {
      propsResizeRef.current = null
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [propsWidth])

  // ── Embed modal ──
  const [showEmbed, setShowEmbed] = useState(false)
  const [embedNote, setEmbedNote] = useState('')
  const [embedMsg, setEmbedMsg] = useState('')

  // ── Mermaid import modal ──
  const [showMermaidModal, setShowMermaidModal] = useState(false)
  const [mermaidInput, setMermaidInput] = useState('')

  // ── SVG / container refs ──
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Webview URL editing ──
  const [editingWebviewUrl, setEditingWebviewUrl] = useState<{ id: string; value: string } | null>(null)

  // ── Palette drag ──
  const paletteDragRef = useRef<{ shape: NodeShape } | null>(null)

  // ── Mermaid overlay refs (node.id → scroll div) for autofit ──
  const mermaidNodeRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const handleAutofitMermaid = useCallback((nodeId: string) => {
    const scrollDiv = mermaidNodeRefs.current.get(nodeId)
    if (!scrollDiv) return
    const w = scrollDiv.scrollWidth
    const h = scrollDiv.scrollHeight
    if (!w || !h) return
    updateDiagram({
      nodes: diagram.nodes.map(n =>
        n.id === nodeId ? { ...n, w, h } : n
      ),
    })
  }, [diagram, updateDiagram])

  // ── Notes panel state ──
  const [notesExpanded, setNotesExpanded] = useState(true)
  const [notesFilter, setNotesFilter] = useState('')

  // ── Colors ──
  const colors = useMemo(() => ({
    bg: darkMode ? '#111111' : '#f8f8f8',
    gridLine: darkMode ? '#1e1e1e' : '#e5e7eb',
    nodeStroke: darkMode ? '#3d3d3d' : '#d1d5db',
    nodeStrokeSel: '#8b5cf6',
    edgeStroke: darkMode ? '#6b7280' : '#9ca3af',
    edgeStrokeSel: '#8b5cf6',
  }), [darkMode])

  // ── Client → canvas coords ──
  const clientToCanvas = useCallback((cx: number, cy: number): [number, number] => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return [0, 0]
    return [
      (cx - rect.left - viewport.x) / viewport.scale,
      (cy - rect.top - viewport.y) / viewport.scale,
    ]
  }, [viewport])

  // ── Label commit ──
  const commitLabel = useCallback(() => {
    if (!editingLabel) return
    if (editingLabel.type === 'node') {
      updateDiagram({ nodes: diagram.nodes.map(n => n.id === editingLabel.id ? { ...n, label: editingLabel.value } : n) })
    } else {
      updateDiagram({ edges: diagram.edges.map(e => e.id === editingLabel.id ? { ...e, label: editingLabel.value } : e) })
    }
    setEditingLabel(null)
  }, [editingLabel, diagram, updateDiagram])

  // ── Node click / drag ──
  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()

    // Middle mouse button: pan even when hovering over a node
    if (e.button === 1) {
      e.preventDefault()
      setIsDraggingCanvas(true)
      dragRef.current = {
        type: 'canvas',
        startClient: [e.clientX, e.clientY],
        startVp: { x: viewport.x, y: viewport.y },
      }
      return
    }

    // Left mouse button
    if (e.button !== 0) return

    // In connect mode: first click = source, second click = destination
    if (connectMode) {
      if (connectFromId === null) {
        // Select source
        setConnectFromId(nodeId)
      } else if (connectFromId !== nodeId) {
        // Create edge
        const newEdge: DiagramEdge = {
          id: uid(), fromId: connectFromId, toId: nodeId,
          label: '', style: defaultEdgeStyle, arrow: defaultEdgeArrow, strokeWidth: 1.5,
        }
        updateDiagram({ edges: [...diagram.edges, newEdge] })
        setSelectedEdgeId(newEdge.id)
        setSelectedNodeIds(new Set())
        setConnectFromId(null)
        // Stay in connect mode for chaining — user can press Escape to exit
      }
      return
    }

    if (editingLabel) { commitLabel(); return }

    // Open props panel when clicking a mermaid node so code is immediately editable
    const clickedNode = diagram.nodes.find(n => n.id === nodeId)
    if (clickedNode?.shape === 'mermaid') setShowProps(true)

    const isSelected = selectedNodeIds.has(nodeId)
    let ids: string[]
    if (e.shiftKey) {
      const next = new Set(selectedNodeIds)
      if (next.has(nodeId)) { next.delete(nodeId) } else { next.add(nodeId) }
      setSelectedNodeIds(next)
      ids = [...next]
    } else {
      if (!isSelected) setSelectedNodeIds(new Set([nodeId]))
      ids = isSelected && selectedNodeIds.size > 1 ? [...selectedNodeIds] : [nodeId]
    }
    setSelectedEdgeId(null)

    dragRef.current = {
      type: 'node',
      nodeIds: ids,
      startClient: [e.clientX, e.clientY],
      startNodePos: ids.map(id => {
        const n = diagram.nodes.find(n => n.id === id)!
        return [n.x, n.y] as [number, number]
      }),
    }
  }, [connectMode, connectFromId, defaultEdgeStyle, defaultEdgeArrow, editingLabel, selectedNodeIds, diagram, updateDiagram, commitLabel])

  const handleNodeDblClick = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    if (connectMode) return
    const node = diagram.nodes.find(n => n.id === nodeId)
    if (!node) return
    if (node.shape === 'webview') {
      setEditingWebviewUrl({ id: nodeId, value: node.webviewUrl ?? '' })
      return
    }
    if (node.shape === 'mermaid') {
      setShowProps(true)
      return
    }
    setEditingLabel({ type: 'node', id: nodeId, value: node.label })
  }, [connectMode, diagram])

  // ── Canvas mousedown ──
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle mouse button: always pan (don't select/deselect)
    if (e.button === 1) {
      e.preventDefault()
      setIsDraggingCanvas(true)
      dragRef.current = {
        type: 'canvas',
        startClient: [e.clientX, e.clientY],
        startVp: { x: viewport.x, y: viewport.y },
      }
      return
    }

    // Left mouse button
    if (e.button !== 0) return

    // In connect mode: clicking blank canvas cancels source selection
    if (connectMode) {
      setConnectFromId(null)
      return
    }
    if (editingLabel) { commitLabel(); return }
    setNotePopup(null)
    setSelectedEdgeId(null)

    // Start rubber-band selection
    const canvasPos = clientToCanvas(e.clientX, e.clientY)
    setSelectedNodeIds(new Set())
    dragRef.current = {
      type: 'select',
      startClient: [e.clientX, e.clientY],
      startCanvas: canvasPos,
    }
    setSelectionRect({ x: canvasPos[0], y: canvasPos[1], w: 0, h: 0 })
  }, [connectMode, editingLabel, commitLabel, viewport, clientToCanvas])

  // ── Global mouse move/up ──
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const dr = dragRef.current
    if (!dr) return
    if (dr.type === 'canvas' && dr.startVp) {
      setViewport(v => ({ ...v, x: dr.startVp!.x + (e.clientX - dr.startClient[0]), y: dr.startVp!.y + (e.clientY - dr.startClient[1]) }))
    }
    if (dr.type === 'node' && dr.nodeIds && dr.startNodePos) {
      const dx = (e.clientX - dr.startClient[0]) / viewport.scale
      const dy = (e.clientY - dr.startClient[1]) / viewport.scale
      updateDiagram({
        nodes: diagram.nodes.map(n => {
          const idx = dr.nodeIds!.indexOf(n.id)
          if (idx === -1) return n
          return { ...n, x: snap(dr.startNodePos![idx][0] + dx), y: snap(dr.startNodePos![idx][1] + dy) }
        }),
      })
    }
    if (dr.type === 'select' && dr.startCanvas) {
      const [cx, cy] = clientToCanvas(e.clientX, e.clientY)
      const [sx, sy] = dr.startCanvas
      setSelectionRect({
        x: Math.min(cx, sx), y: Math.min(cy, sy),
        w: Math.abs(cx - sx), h: Math.abs(cy - sy),
      })
    }
  }, [viewport.scale, diagram.nodes, updateDiagram, clientToCanvas])

  const handleMouseUp = useCallback(() => {
    const dr = dragRef.current
    if (dr?.type === 'select' && dr.startCanvas) {
      // Finalise rubber-band: select all nodes intersecting the rect
      setSelectionRect(rect => {
        if (rect && (rect.w > 4 || rect.h > 4)) {
          const hits = diagram.nodes.filter(n =>
            n.x < rect.x + rect.w && n.x + n.w > rect.x &&
            n.y < rect.y + rect.h && n.y + n.h > rect.y
          )
          if (hits.length > 0) setSelectedNodeIds(new Set(hits.map(n => n.id)))
        }
        return null
      })
    } else {
      setSelectionRect(null)
    }
    dragRef.current = null
    setIsDraggingCanvas(false)
  }, [diagram.nodes])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp) }
  }, [handleMouseMove, handleMouseUp])

  // ── Wheel zoom ──
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const factor = e.deltaY < 0 ? 1.1 : 0.9
      const mx = e.clientX - rect.left, my = e.clientY - rect.top
      setViewport(v => {
        const ns = Math.max(0.1, Math.min(4, v.scale * factor))
        const r = ns / v.scale
        return { scale: ns, x: mx - r * (mx - v.x), y: my - r * (my - v.y) }
      })
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // ── Keyboard ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editingLabel) return
      if (e.key === 'Escape') { setConnectMode(false); setConnectFromId(null) }
      const tgt = e.target as HTMLElement
      if (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA') return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeIds.size > 0) {
          const ids = [...selectedNodeIds]
          updateDiagram({
            nodes: diagram.nodes.filter(n => !ids.includes(n.id)),
            edges: diagram.edges.filter(ed => !ids.includes(ed.fromId) && !ids.includes(ed.toId)),
          })
          setSelectedNodeIds(new Set())
        }
        if (selectedEdgeId) {
          updateDiagram({ edges: diagram.edges.filter(ed => ed.id !== selectedEdgeId) })
          setSelectedEdgeId(null)
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        e.preventDefault()
        setSelectedNodeIds(new Set(diagram.nodes.map(n => n.id)))
      }
      // Mindmap keyboard shortcuts
      if (diagram.mindmapMode && selectedNodeIds.size === 1) {
        const selId = [...selectedNodeIds][0]
        const selNode = diagram.nodes.find(n => n.id === selId)
        if (!selNode) return

        if (e.key === 'Tab') {
          e.preventDefault()
          // Add child
          const activeTheme = getActiveTheme(diagram.mindmapTheme)
          const newNode: DiagramNode = {
            id: uid(),
            x: selNode.x + 200, y: selNode.y,
            w: 140, h: 40,
            shape: 'rect', label: 'Topic',
            color: activeTheme.level1Colors[0],
            textColor: '#1f2937',
            strokeWidth: 1,
          }
          const newEdge: DiagramEdge = {
            id: uid(), fromId: selId, toId: newNode.id,
            label: '', style: 'solid', arrow: 'none', strokeWidth: 1.5,
          }
          const nextNodes = [...diagram.nodes, newNode]
          const nextEdges = [...diagram.edges, newEdge]
          const laid = computeMindmapLayout(nextNodes, nextEdges)
          updateDiagram({ nodes: laid, edges: nextEdges })
          setSelectedNodeIds(new Set([newNode.id]))
          setEditingLabel({ type: 'node', id: newNode.id, value: 'Topic' })
          return
        }

        if (e.key === 'Enter' && !selNode.isRoot) {
          e.preventDefault()
          // Add sibling
          const parentEdge = diagram.edges.find(ed => ed.toId === selId)
          const parentId = parentEdge?.fromId
          if (!parentId) return
          const newNode: DiagramNode = {
            id: uid(),
            x: selNode.x, y: selNode.y + selNode.h + 24,
            w: 140, h: 40,
            shape: 'rect', label: 'Topic',
            color: selNode.color,
            textColor: selNode.textColor,
            strokeWidth: 1,
          }
          const newEdge: DiagramEdge = {
            id: uid(), fromId: parentId, toId: newNode.id,
            label: '', style: 'solid', arrow: 'none', strokeWidth: 1.5,
          }
          const nextNodes = [...diagram.nodes, newNode]
          const nextEdges = [...diagram.edges, newEdge]
          const laid = computeMindmapLayout(nextNodes, nextEdges)
          updateDiagram({ nodes: laid, edges: nextEdges })
          setSelectedNodeIds(new Set([newNode.id]))
          setEditingLabel({ type: 'node', id: newNode.id, value: 'Topic' })
          return
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editingLabel, selectedNodeIds, selectedEdgeId, diagram, updateDiagram, setEditingLabel, setSelectedNodeIds])

  // ── Palette drop & note drop ──
  const handleSvgDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()

    // Branch 1: palette shape drop
    const shape = paletteDragRef.current?.shape
    if (shape) {
      paletteDragRef.current = null
      const [cx, cy] = clientToCanvas(e.clientX, e.clientY)
      const isNetwork = ['server','cloud','router','firewall','laptop','phone'].includes(shape)
      const isWebview = shape === 'webview'
      const nodeW = isWebview ? 480 : DEFAULT_NODE_W
      const nodeH = isWebview ? 320 : isNetwork ? 80 : DEFAULT_NODE_H
      const newNode: DiagramNode = {
        id: uid(),
        x: snap(cx - nodeW / 2), y: snap(cy - nodeH / 2),
        w: nodeW, h: nodeH,
        shape, label: PALETTE_SHAPES.find(p => p.shape === shape)?.label ?? shape,
        color: COLOR_PRESETS[diagram.nodes.length % COLOR_PRESETS.length],
        textColor: darkMode ? '#e5e7eb' : '#1f2937',
        strokeWidth: 1.5,
        webviewUrl: isWebview ? '' : undefined,
      }
      updateDiagram({ nodes: [...diagram.nodes, newNode] })
      setSelectedNodeIds(new Set([newNode.id]))
      return
    }

    // Branch 2: note file drop
    const notePath = e.dataTransfer.getData('text/x-note-path')
    if (notePath) {
      const noteEntry = index.get(notePath)
      if (!noteEntry) return
      const [cx, cy] = clientToCanvas(e.clientX, e.clientY)
      const NOTE_W = 160
      const NOTE_H = 90
      const newNode: DiagramNode = {
        id: uid(),
        x: snap(cx - NOTE_W / 2), y: snap(cy - NOTE_H / 2),
        w: NOTE_W, h: NOTE_H,
        shape: 'note',
        label: noteEntry.name,
        color: '#fef9c3',  // sticky note yellow
        textColor: '#713f12',  // warm brown
        strokeWidth: 1,
        notePath,
      }
      updateDiagram({ nodes: [...diagram.nodes, newNode] })
      setSelectedNodeIds(new Set([newNode.id]))
      return
    }
  }, [clientToCanvas, diagram.nodes, darkMode, updateDiagram, index])

  // ── Fit view ──
  const fitView = useCallback(() => {
    if (diagram.nodes.length === 0) { setViewport({ x: 40, y: 40, scale: 1 }); return }
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const xs = diagram.nodes.map(n => n.x), ys = diagram.nodes.map(n => n.y)
    const x2 = diagram.nodes.map(n => n.x + n.w), y2 = diagram.nodes.map(n => n.y + n.h)
    const minX = Math.min(...xs) - 40, minY = Math.min(...ys) - 40
    const maxX = Math.max(...x2) + 40, maxY = Math.max(...y2) + 40
    const scale = Math.min(rect.width / (maxX - minX), rect.height / (maxY - minY), 2)
    setViewport({
      scale,
      x: rect.width / 2 - ((minX + maxX) / 2) * scale,
      y: rect.height / 2 - ((minY + maxY) / 2) * scale,
    })
  }, [diagram.nodes])

  // ── Mindmap layout ──
  const triggerMindmapLayout = useCallback(() => {
    const laid = computeMindmapLayout(diagram.nodes, diagram.edges)
    updateDiagram({ nodes: laid })
    setTimeout(fitView, 50)
  }, [diagram.nodes, diagram.edges, updateDiagram, fitView])

  // ── Export helpers ──
  const buildExportSvg = useCallback((): string => {
    const el = svgRef.current
    if (!el || diagram.nodes.length === 0) return ''
    const xs = diagram.nodes.map(n => n.x), ys = diagram.nodes.map(n => n.y)
    const x2 = diagram.nodes.map(n => n.x + n.w), y2 = diagram.nodes.map(n => n.y + n.h)
    const minX = Math.min(...xs) - 20, minY = Math.min(...ys) - 20
    const vw = Math.max(...x2) + 20 - minX, vh = Math.max(...y2) + 20 - minY
    const clone = el.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('viewBox', `${minX} ${minY} ${vw} ${vh}`)
    clone.setAttribute('width', String(vw))
    clone.setAttribute('height', String(vh))
    const gVp = clone.querySelector('g[data-viewport]') as SVGGElement | null
    gVp?.setAttribute('transform', '')
    return new XMLSerializer().serializeToString(clone)
  }, [diagram.nodes])

  const exportSvg = () => {
    const str = buildExportSvg()
    if (!str) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([str], { type: 'image/svg+xml' }))
    a.download = `${diagram.name.replace(/\s+/g, '-').toLowerCase()}.svg`
    a.click()
  }

  const exportPng = () => {
    const str = buildExportSvg()
    if (!str) return
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth * 2; canvas.height = img.naturalHeight * 2
      const ctx = canvas.getContext('2d')!
      ctx.scale(2, 2); ctx.drawImage(img, 0, 0)
      const a = document.createElement('a')
      a.href = canvas.toDataURL('image/png')
      a.download = `${diagram.name.replace(/\s+/g, '-').toLowerCase()}.png`
      a.click()
    }
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str)
  }

  // ── Embed into note ──
  const handleEmbed = async () => {
    if (!embedNote) return
    setEmbedMsg('')
    try {
      const raw = await readNote(embedNote)
      const tag = `\n\n![[diagram:${activeDiagramId}]]\n`
      await saveNote(embedNote, raw + tag)
      setEmbedMsg('✓ Diagram reference inserted into note.')
    } catch {
      setEmbedMsg('✗ Could not open that note.')
    }
  }

  // ── Diagram management ──
  const newDiagram = () => {
    const d: Diagram = { id: uid(), name: 'Untitled Diagram', nodes: [], edges: [], transparentBg: false, mindmapMode: false, mindmapTheme: 'Rainbow' }
    const next = [...diagrams, d]
    setDiagrams(next); saveDiagrams(next)
    setActiveDiagramId(d.id)
    setSelectedNodeIds(new Set()); setSelectedEdgeId(null)
  }

  const deleteDiagram = (id: string) => {
    if (diagrams.length <= 1) return
    const next = diagrams.filter(d => d.id !== id)
    setDiagrams(next); saveDiagrams(next)
    if (activeDiagramId === id) setActiveDiagramId(next[0].id)
  }

  const renameDiagram = (id: string, name: string) => {
    const next = diagrams.map(d => d.id === id ? { ...d, name } : d)
    setDiagrams(next); saveDiagrams(next)
  }

  // ── Derived selection ──
  const selectedNode = useMemo(() => {
    const sel = diagram.nodes.filter(n => selectedNodeIds.has(n.id))
    return sel.length === 1 ? sel[0] : null
  }, [diagram.nodes, selectedNodeIds])

  const updateSelectedNodes = (patch: Partial<DiagramNode>) =>
    updateDiagram({ nodes: diagram.nodes.map(n => selectedNodeIds.has(n.id) ? { ...n, ...patch } : n) })

  // ── Align / distribute ──
  const alignNodes = useCallback((type: 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom' | 'distributeH' | 'distributeV') => {
    const sel = diagram.nodes.filter(n => selectedNodeIds.has(n.id))
    if (sel.length < 2) return
    const sorted = (axis: 'x' | 'y') => [...sel].sort((a, b) => a[axis] - b[axis])
    let moved: Record<string, Partial<DiagramNode>> = {}
    if (type === 'left') {
      const ref = Math.min(...sel.map(n => n.x))
      sel.forEach(n => { moved[n.id] = { x: ref } })
    } else if (type === 'right') {
      const ref = Math.max(...sel.map(n => n.x + n.w))
      sel.forEach(n => { moved[n.id] = { x: ref - n.w } })
    } else if (type === 'centerH') {
      const ref = (Math.min(...sel.map(n => n.x)) + Math.max(...sel.map(n => n.x + n.w))) / 2
      sel.forEach(n => { moved[n.id] = { x: snap(ref - n.w / 2) } })
    } else if (type === 'top') {
      const ref = Math.min(...sel.map(n => n.y))
      sel.forEach(n => { moved[n.id] = { y: ref } })
    } else if (type === 'bottom') {
      const ref = Math.max(...sel.map(n => n.y + n.h))
      sel.forEach(n => { moved[n.id] = { y: ref - n.h } })
    } else if (type === 'centerV') {
      const ref = (Math.min(...sel.map(n => n.y)) + Math.max(...sel.map(n => n.y + n.h))) / 2
      sel.forEach(n => { moved[n.id] = { y: snap(ref - n.h / 2) } })
    } else if (type === 'distributeH') {
      const s = sorted('x')
      const totalW = s.reduce((a, n) => a + n.w, 0)
      const span = s[s.length - 1].x + s[s.length - 1].w - s[0].x
      const gap = (span - totalW) / (s.length - 1)
      let cursor = s[0].x + s[0].w
      s.slice(1, -1).forEach(n => { moved[n.id] = { x: snap(cursor + gap) }; cursor += gap + n.w })
    } else if (type === 'distributeV') {
      const s = sorted('y')
      const totalH = s.reduce((a, n) => a + n.h, 0)
      const span = s[s.length - 1].y + s[s.length - 1].h - s[0].y
      const gap = (span - totalH) / (s.length - 1)
      let cursor = s[0].y + s[0].h
      s.slice(1, -1).forEach(n => { moved[n.id] = { y: snap(cursor + gap) }; cursor += gap + n.h })
    }
    updateDiagram({ nodes: diagram.nodes.map(n => moved[n.id] ? { ...n, ...moved[n.id] } : n) })
  }, [diagram.nodes, selectedNodeIds, updateDiagram])

  const selectedEdge = selectedEdgeId ? diagram.edges.find(e => e.id === selectedEdgeId) ?? null : null
  const updateSelectedEdge = (patch: Partial<DiagramEdge>) => {
    if (!selectedEdgeId) return
    updateDiagram({ edges: diagram.edges.map(e => e.id === selectedEdgeId ? { ...e, ...patch } : e) })
  }

  // ── Notes list for embed ──
  const noteList = useMemo(() => [...index.keys()].filter(k => k.endsWith('.md')).sort(), [index])

  // ── Styles ──
  const inputCls = 'w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500'
  const labelCls = 'text-xs text-gray-500 dark:text-gray-400 block mb-0.5'
  const sectionCls = 'text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-1'
  const transform = `translate(${viewport.x},${viewport.y}) scale(${viewport.scale})`

  // ── Palette grouped by section ──
  const paletteSections = useMemo(() => {
    const m: Record<string, typeof PALETTE_SHAPES> = {}
    PALETTE_SHAPES.forEach(p => { (m[p.section] ??= []).push(p) })
    return Object.entries(m)
  }, [])

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-surface-900">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gray-50 dark:bg-surface-800">
        {/* Diagram tabs */}
        <div className="flex items-center gap-0.5 overflow-x-auto flex-1 min-w-0">
          {diagrams.map(d => (
            <div key={d.id} className="flex items-center flex-shrink-0">
              <button
                onClick={() => { setActiveDiagramId(d.id); setSelectedNodeIds(new Set()); setSelectedEdgeId(null) }}
                className={`px-3 py-1.5 text-xs border-b-2 transition-colors ${
                  d.id === activeDiagramId
                    ? 'border-accent-500 text-accent-600 dark:text-accent-400 font-medium'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {d.id === activeDiagramId ? (
                  <input
                    value={d.name}
                    onChange={e => renameDiagram(d.id, e.target.value)}
                    onClick={e => e.stopPropagation()}
                    className="bg-transparent border-none outline-none text-xs w-28"
                  />
                ) : d.name}
              </button>
              {diagrams.length > 1 && (
                <button onClick={() => deleteDiagram(d.id)}
                  className="text-gray-300 hover:text-red-400 text-xs pr-1" title="Delete">×</button>
              )}
            </div>
          ))}
          <button onClick={newDiagram} className="px-2 py-1 text-xs text-gray-400 hover:text-accent-500 flex-shrink-0">
            + New
          </button>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Connect toggle */}
          <button
            onClick={() => { setConnectMode(v => !v); setConnectFromId(null) }}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded border transition-colors ${
              connectMode
                ? 'bg-accent-500 text-white border-accent-600'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title="Connect nodes (Escape to exit)"
          >
            {connectMode
              ? (connectFromId ? `→ Click target…` : '→ Click source…')
              : '⚡ Connect'}
          </button>
          <button
            onClick={() => {
              const newMode = !(diagram.mindmapMode ?? false)
              if (newMode && diagram.nodes.length > 0 && !diagram.nodes.some(n => n.isRoot)) {
                // Auto-assign root to first node
                updateDiagram({
                  mindmapMode: true,
                  nodes: diagram.nodes.map((n, i) => i === 0 ? { ...n, isRoot: true } : n),
                })
                setTimeout(triggerMindmapLayout, 50)
              } else {
                updateDiagram({ mindmapMode: newMode })
                if (newMode) triggerMindmapLayout()
              }
            }}
            className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded border transition-colors ${
              diagram.mindmapMode
                ? 'bg-emerald-500 text-white border-emerald-600'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title="Toggle mindmap layout mode"
          >
            {diagram.mindmapMode ? '🧠 Mindmap' : '○ Mindmap'}
          </button>
          <button onClick={fitView} title="Fit all nodes in view"
            className="px-2.5 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
            ⊡ Fit
          </button>
          <button onClick={exportSvg}
            className="px-2.5 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
            ↓ SVG
          </button>
          <button onClick={exportPng}
            className="px-2.5 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
            ↓ PNG
          </button>
          <button onClick={() => setShowEmbed(v => !v)}
            className={`px-2.5 py-1 text-xs rounded border transition-colors ${
              showEmbed
                ? 'bg-accent-500 text-white border-accent-600'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title="Embed diagram in a note">
            ↗ Embed
          </button>
          <button onClick={() => setShowProps(v => !v)}
            className={`px-2.5 py-1 text-xs rounded border transition-colors ${
              showProps
                ? 'bg-accent-500 text-white border-accent-600'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}>
            ⚙ Props
          </button>
          <button onClick={() => setShowMermaidModal(true)}
            className="px-2.5 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Import Mermaid diagram">
            ⬡ Mermaid
          </button>
        </div>
      </div>

      {/* ── Align / distribute toolbar — visible when 2+ nodes selected ── */}
      {selectedNodeIds.size >= 2 && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800 flex-shrink-0 flex-wrap">
          <span className="text-[10px] text-gray-400 mr-1 font-medium uppercase tracking-wide">{selectedNodeIds.size} selected</span>
          <span className="text-[10px] text-gray-300 dark:text-gray-600 mr-1">Align:</span>
          {([
            { type: 'left',    title: 'Align left edges',          label: '| Left'   },
            { type: 'centerH', title: 'Center horizontally',       label: '| Mid H'  },
            { type: 'right',   title: 'Align right edges',         label: 'Right |'  },
            { type: 'top',     title: 'Align top edges',           label: '— Top'    },
            { type: 'centerV', title: 'Center vertically',         label: '— Mid V'  },
            { type: 'bottom',  title: 'Align bottom edges',        label: 'Bot —'    },
          ] as const).map(({ type, title, label }) => (
            <button key={type} onClick={() => alignNodes(type)} title={title}
              className="px-1.5 py-0.5 text-[10px] font-medium rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors whitespace-nowrap">
              {label}
            </button>
          ))}
          <span className="text-[10px] text-gray-300 dark:text-gray-600 ml-2 mr-1">Distribute:</span>
          <button onClick={() => alignNodes('distributeH')} title="Distribute horizontally with equal spacing"
            className="px-2 py-0.5 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            ↔
          </button>
          <button onClick={() => alignNodes('distributeV')} title="Distribute vertically with equal spacing"
            className="px-2 py-0.5 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            ↕
          </button>
        </div>
      )}

      {/* ── Embed panel ── */}
      {showEmbed && (
        <div className="px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-accent-50 dark:bg-accent-900/10 flex items-center gap-3 flex-shrink-0">
          <span className="text-xs font-medium text-accent-700 dark:text-accent-300 whitespace-nowrap">Embed in note:</span>
          <select
            value={embedNote}
            onChange={e => { setEmbedNote(e.target.value); setEmbedMsg('') }}
            className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none"
          >
            <option value="">— select a note —</option>
            {noteList.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <button
            onClick={handleEmbed}
            disabled={!embedNote}
            className="px-3 py-1 text-xs bg-accent-500 text-white rounded hover:bg-accent-600 disabled:opacity-50"
          >
            Insert
          </button>
          {embedMsg && <span className="text-xs text-accent-600 dark:text-accent-400">{embedMsg}</span>}
          <p className="text-xs text-gray-400 dark:text-gray-500 ml-2 hidden sm:block">
            Inserts <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">![[diagram:{activeDiagramId}]]</code> at end of note
          </p>
        </div>
      )}

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Shape palette or mindmap hint panel ── */}
        {!diagram.mindmapMode ? (
          <div className="flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800 flex flex-col py-2 overflow-y-auto relative" style={{ width: paletteWidth }}>
            {/* Resize handle */}
            <div
              className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-10 hover:bg-accent-500/30 active:bg-accent-500/50 transition-colors"
              onMouseDown={startPaletteResize}
            />

            {/* Notes import section */}
            <div className="mb-2 px-1">
              <button
                onClick={() => setNotesExpanded(v => !v)}
                className="w-full flex items-center justify-center gap-0.5 mb-1 group"
                title="Search and drag notes onto canvas"
              >
                <span className="text-base leading-none">📝</span>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 group-hover:text-accent-500 transition-colors">Notes</p>
                <span className="text-[9px] text-gray-300 ml-0.5">{notesExpanded ? '▾' : '▸'}</span>
              </button>
              {notesExpanded && (
                <div className="flex flex-col gap-0.5">
                  <input
                    value={notesFilter}
                    onChange={e => setNotesFilter(e.target.value)}
                    placeholder="Search notes…"
                    className="w-full text-[9px] px-1 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 outline-none"
                  />
                  {notesFilter.trim() === '' ? (
                    <p className="text-[8px] text-gray-400 text-center leading-tight mt-0.5 px-0.5">Type to search notes</p>
                  ) : (() => {
                    const filtered = noteList.filter(k => k.toLowerCase().includes(notesFilter.toLowerCase()))
                    if (filtered.length === 0) return (
                      <p className="text-[8px] text-gray-400 text-center leading-tight mt-0.5">No matches</p>
                    )
                    return filtered.map(notePath => {
                      const label = notePath.replace(/\.md$/, '').split('/').pop() ?? notePath
                      const entry = index.get(notePath)
                      return (
                        <div
                          key={notePath}
                          draggable
                          onDragStart={e => {
                            paletteDragRef.current = null
                            e.dataTransfer.setData('text/x-note-path', notePath)
                          }}
                          className="w-full px-1 py-1 flex flex-col items-center justify-center rounded border border-dashed border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 cursor-grab hover:border-accent-400 hover:bg-accent-50 dark:hover:bg-accent-900/20 select-none transition-colors"
                          title={entry?.excerpt ? `${label}\n\n${entry.excerpt}` : `Drag "${label}" onto canvas`}
                        >
                          <span className="text-[8px] text-gray-600 dark:text-gray-300 leading-tight text-center break-all line-clamp-2">{label}</span>
                        </div>
                      )
                    })
                  })()}
                </div>
              )}
            </div>
            <div className="mx-1 mb-2 border-t border-gray-200 dark:border-gray-700" />

            {paletteSections.map(([section, shapes]) => (
              <div key={section} className="mb-2 px-1">
                <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400 text-center mb-1">{section}</p>
                {shapes.map(ps => (
                  <div
                    key={ps.shape}
                    draggable
                    onDragStart={() => { paletteDragRef.current = { shape: ps.shape } }}
                    onDragEnd={() => { paletteDragRef.current = null }}
                    className="w-full h-12 flex flex-col items-center justify-center gap-0.5 rounded border border-dashed border-gray-300 dark:border-gray-600 cursor-grab hover:border-accent-400 hover:bg-accent-50 dark:hover:bg-accent-900/20 mb-1 select-none transition-colors"
                    title={`Drag to add ${ps.label}`}
                  >
                    <span className="text-lg leading-none">{ps.icon}</span>
                    <span className="text-[9px] text-gray-400 leading-none">{ps.label}</span>
                  </div>
                ))}
              </div>
            ))}

            {/* Quick color palette */}
            <div className="mt-auto px-1 pt-2 border-t border-gray-200 dark:border-gray-700">
              <p className="text-[9px] text-gray-400 text-center mb-1">Color</p>
              <div className="flex flex-wrap gap-0.5 justify-center">
                {COLOR_PRESETS.map(c => (
                  <button key={c}
                    onClick={() => updateSelectedNodes({ color: c })}
                    className="w-5 h-5 rounded-full border-2 border-transparent hover:scale-110 transition-transform"
                    style={{ background: c }} title={c} />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="w-[76px] flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800 flex flex-col items-center justify-start py-4 px-2 gap-2 text-center">
            <span className="text-lg">🧠</span>
            <p className="text-[9px] text-gray-400 leading-tight">Select a node</p>
            <p className="text-[9px] text-gray-400 font-semibold">Tab</p>
            <p className="text-[9px] text-gray-400 leading-tight">Add child</p>
            <p className="text-[9px] text-gray-400 font-semibold mt-1">Enter</p>
            <p className="text-[9px] text-gray-400 leading-tight">Add sibling</p>
          </div>
        )}

        {/* ── Canvas ── */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden relative"
          style={{
            background: diagram.mindmapMode
              ? getActiveTheme(diagram.mindmapTheme).bgColor
              : diagram.transparentBg
                ? (darkMode ? 'repeating-conic-gradient(#1a1a1a 0% 25%, #222 0% 50%) 0 0 / 16px 16px'
                           : 'repeating-conic-gradient(#d1d5db 0% 25%, #fff 0% 50%) 0 0 / 16px 16px')
                : colors.bg,
            cursor: connectMode ? 'crosshair' : isDraggingCanvas ? 'grabbing' : 'grab',
          }}
        >
          <svg
            ref={svgRef}
            className="w-full h-full"
            onMouseDown={handleCanvasMouseDown}
            onContextMenu={e => e.preventDefault()}
            onDragOver={e => e.preventDefault()}
            onDrop={handleSvgDrop}
          >
            <defs>
              <pattern id="dg-grid"
                width={GRID * viewport.scale} height={GRID * viewport.scale}
                x={viewport.x % (GRID * viewport.scale)} y={viewport.y % (GRID * viewport.scale)}
                patternUnits="userSpaceOnUse">
                <path d={`M ${GRID * viewport.scale} 0 L 0 0 0 ${GRID * viewport.scale}`}
                  fill="none" stroke={colors.gridLine} strokeWidth={0.5} />
              </pattern>
              {/* Per-color arrow markers — one end + one start marker per unique edge color */}
              {(() => {
                const edgeColors = new Set<string>()
                edgeColors.add(colors.edgeStroke)
                edgeColors.add(colors.edgeStrokeSel)
                diagram.edges.forEach(e => { if (e.color) edgeColors.add(e.color) })
                return [...edgeColors].flatMap(c => {
                  const id = `dg-arr-${c.replace('#', '')}`
                  return [
                    <marker key={`${id}-end`} id={`${id}-end`} markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
                      <path d="M0,0 L10,3.5 L0,7 Z" fill={c} />
                    </marker>,
                    <marker key={`${id}-start`} id={`${id}-start`} markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
                      <path d="M0,0 L10,3.5 L0,7 Z" fill={c} />
                    </marker>,
                  ]
                })
              })()}
            </defs>

            {!diagram.transparentBg && <rect width="100%" height="100%" fill="url(#dg-grid)" />}

            <g data-viewport transform={transform}>
              {/* Edges — mindmap S-curves or standard arrows */}
              {diagram.mindmapMode ? (
                /* ── Mindmap S-curve branches ── */
                diagram.edges.map(edge => {
                  const from = diagram.nodes.find(n => n.id === edge.fromId)
                  const to = diagram.nodes.find(n => n.id === edge.toId)
                  if (!from || !to) return null

                  const isRight = (to.x + to.w / 2) >= (from.x + from.w / 2)
                  const sx = isRight ? from.x + from.w : from.x
                  const sy = from.y + from.h / 2
                  const tx = isRight ? to.x : to.x + to.w
                  const ty = to.y + to.h / 2
                  const cpDist = Math.abs(tx - sx) * 0.45
                  const d = `M ${sx},${sy} C ${sx + (isRight ? cpDist : -cpDist)},${sy} ${tx + (isRight ? -cpDist : cpDist)},${ty} ${tx},${ty}`

                  const activeTheme = getActiveTheme(diagram.mindmapTheme)
                  const branchColor = getMindmapBranchColor(edge, diagram.nodes, diagram.edges, activeTheme)

                  return (
                    <path key={edge.id} d={d} fill="none"
                      stroke={branchColor} strokeWidth={2.5}
                      strokeLinecap="round"
                      style={{ pointerEvents: 'none' }}
                    />
                  )
                })
              ) : (
                /* ── Standard arrow edges ── */
                diagram.edges.map(edge => {
                  const from = diagram.nodes.find(n => n.id === edge.fromId)
                  const to = diagram.nodes.find(n => n.id === edge.toId)
                  if (!from || !to) return null
                  const isSel = edge.id === selectedEdgeId
                  const arrowEnd = edge.arrow !== 'none'
                  const arrowStart = edge.arrow === 'both'
                  const d = edgePath(from, to, arrowEnd, arrowStart)
                  const baseColor = edge.color ?? colors.edgeStroke
                  const stroke = isSel ? colors.edgeStrokeSel : baseColor
                  const [fx, fy] = getBorderPoint(from, to.x + to.w / 2, to.y + to.h / 2)
                  const [tx, ty] = getBorderPoint(to, from.x + from.w / 2, from.y + from.h / 2)
                  const mid: [number, number] = [(fx + tx) / 2, (fy + ty) / 2]
                  return (
                    <g key={edge.id} style={{ cursor: 'pointer' }}>
                      <path d={d} fill="none" stroke="transparent" strokeWidth={14}
                        onClick={e => { e.stopPropagation(); setSelectedEdgeId(edge.id); setSelectedNodeIds(new Set()) }} />
                      <path d={d} fill="none" stroke={stroke}
                        strokeWidth={isSel ? (edge.strokeWidth ?? 1.5) + 1 : (edge.strokeWidth ?? 1.5)}
                        strokeDasharray={edge.style === 'dashed' ? '6 4' : edge.style === 'dotted' ? '2 4' : undefined}
                        markerEnd={edge.arrow !== 'none' ? `url(#dg-arr-${stroke.replace('#', '')}-end)` : undefined}
                        markerStart={edge.arrow === 'both' ? `url(#dg-arr-${stroke.replace('#', '')}-start)` : undefined}
                        strokeLinecap="round"
                      />
                      {edge.label && (
                        <text x={mid[0]} y={mid[1] - 7} textAnchor="middle" fontSize={10}
                          fill={stroke}
                          style={{ userSelect: 'none' }}
                          onDoubleClick={(e: React.MouseEvent) => { e.stopPropagation(); setEditingLabel({ type: 'edge', id: edge.id, value: edge.label }) }}>
                          {edge.label}
                        </text>
                      )}
                    </g>
                  )
                })
              )}

              {/* Nodes */}
              {diagram.nodes.map(node => {
                const isSel = selectedNodeIds.has(node.id)
                const isConnSrc = connectMode && connectFromId === node.id
                const isConnTarget = connectMode && connectFromId !== null && connectFromId !== node.id
                const icon = networkIcon(node.shape)
                const isNetwork = isNetworkShape(node.shape)
                const cx = node.x + node.w / 2
                const cy = node.y + node.h / 2
                const sw = node.strokeWidth ?? 1.5
                // Mindmap color override
                const activeTheme = diagram.mindmapMode ? getActiveTheme(diagram.mindmapTheme) : null
                const nodeFill = diagram.mindmapMode && node.shape !== 'note'
                  ? getMindmapNodeColor(node, diagram.nodes, diagram.edges, activeTheme!)
                  : node.color
                return (
                  <g
                    key={node.id}
                    style={{ cursor: connectMode ? 'crosshair' : 'grab' }}
                    onMouseDown={e => handleNodeMouseDown(e, node.id)}
                    onDoubleClick={e => handleNodeDblClick(e, node.id)}
                  >
                    {node.shape === 'mermaid' ? (
                      /* ── Mermaid diagram node (rendered as overlay) ── */
                      <>
                        <rect x={node.x} y={node.y} width={node.w} height={node.h}
                          fill={darkMode ? '#1e1e2e' : '#f8f8ff'}
                          stroke={isConnSrc ? '#22d3ee' : isSel ? colors.nodeStrokeSel : colors.nodeStroke}
                          strokeWidth={isConnSrc ? sw + 1.5 : isSel ? sw + 1 : sw}
                          strokeDasharray={isConnSrc ? '5 3' : undefined}
                          rx={6} />
                        {isConnTarget && (
                          <rect x={node.x} y={node.y} width={node.w} height={node.h}
                            fill="none" stroke="#22d3ee" strokeWidth={2.5} opacity={0.7} rx={6}
                            style={{ pointerEvents: 'none' }} />
                        )}
                        {isSel && [
                          [node.x, node.y], [node.x + node.w, node.y],
                          [node.x, node.y + node.h], [node.x + node.w, node.y + node.h],
                        ].map(([hx, hy], i) => (
                          <rect key={i} x={hx - 4} y={hy - 4} width={8} height={8}
                            rx={2} fill="white" stroke={colors.nodeStrokeSel} strokeWidth={1.5}
                            style={{ pointerEvents: 'none' }} />
                        ))}
                      </>
                    ) : node.shape === 'note' ? (
                      /* ── Sticky note ── */
                      <>
                        {/* Note body */}
                        <path d={nodeShapePath(node)} fill={node.color}
                          stroke={isConnSrc ? '#22d3ee' : isSel ? colors.nodeStrokeSel : colors.nodeStroke}
                          strokeWidth={isConnSrc ? sw + 1.5 : isSel ? sw + 1 : sw} />
                        {/* Fold flap */}
                        {(() => {
                          const fold = 14
                          const foldPath = `M ${node.x + node.w - fold} ${node.y} l ${fold} ${fold} h ${-fold} Z`
                          const foldColor = (() => {
                            const hex = node.color
                            const num = parseInt(hex.slice(1), 16)
                            const r = Math.max(0, (num >> 16) - 30)
                            const g = Math.max(0, ((num >> 8) & 255) - 30)
                            const b = Math.max(0, (num & 255) - 30)
                            return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
                          })()
                          return (
                            <path d={foldPath} fill={foldColor}
                              stroke={isConnSrc ? '#22d3ee' : isSel ? colors.nodeStrokeSel : colors.nodeStroke}
                              strokeWidth={isConnSrc ? sw + 1.5 : isSel ? sw + 1 : sw} />
                          )
                        })()}
                        {/* Note icon */}
                        <text x={node.x + 10} y={node.y + 18} fontSize={14} fill={node.textColor}
                          style={{ pointerEvents: 'none', userSelect: 'none' }}>📄</text>
                        {/* Label */}
                        {editingLabel?.type === 'node' && editingLabel.id === node.id ? (
                          <foreignObject x={node.x + 4} y={cy - 12} width={node.w - 8} height={24}>
                            <input
                              // @ts-ignore
                              xmlns="http://www.w3.org/1999/xhtml"
                              autoFocus
                              value={editingLabel.value}
                              onChange={e => setEditingLabel(s => s ? { ...s, value: e.target.value } : s)}
                              onBlur={commitLabel}
                              onKeyDown={e => { if (e.key === 'Enter') commitLabel(); if (e.key === 'Escape') setEditingLabel(null) }}
                              style={{
                                width: '100%', background: 'transparent', border: 'none', outline: 'none',
                                textAlign: 'center', fontSize: 11, color: node.textColor, fontFamily: 'inherit',
                              }}
                            />
                          </foreignObject>
                        ) : (
                          <text x={cx} y={cy}
                            textAnchor="middle" dominantBaseline="middle"
                            fontSize={10} fontWeight="500" fill={node.textColor}
                            style={{ pointerEvents: 'none', userSelect: 'none' }}>
                            {node.label.length > 20 ? node.label.slice(0, 19) + '…' : node.label}
                          </text>
                        )}
                        {/* Invisible hover area for popup */}
                        <rect x={node.x} y={node.y} width={node.w} height={node.h}
                          fill="transparent" stroke="none"
                          onMouseEnter={() => {
                            cancelHidePopup()
                            const rect = svgRef.current?.getBoundingClientRect()
                            if (!rect) return
                            const screenX = (node.x + node.w / 2) * viewport.scale + viewport.x + rect.left
                            const screenY = (node.y + node.h) * viewport.scale + viewport.y + rect.top
                            setNotePopup({ nodeId: node.id, screenX, screenY })
                          }}
                          onMouseLeave={scheduleHidePopup}
                        />
                      </>
                    ) : isNetwork ? (
                      /* ── Standalone network device — icon + label, no box ── */
                      <>
                        {/* Invisible hit area */}
                        <rect x={node.x} y={node.y} width={node.w} height={node.h}
                          fill="transparent" stroke="none" />
                        {/* Selection/connect ring */}
                        {(isSel || isConnSrc) && (
                          <circle cx={cx} cy={cy - 10} r={32}
                            fill="none"
                            stroke={isConnSrc ? '#22d3ee' : colors.nodeStrokeSel}
                            strokeWidth={isConnSrc ? 2.5 : 2}
                            strokeDasharray={isConnSrc ? '5 3' : undefined}
                            style={{ pointerEvents: 'none' }} />
                        )}
                        {isConnTarget && (
                          <circle cx={cx} cy={cy - 10} r={32}
                            fill="none" stroke="#22d3ee" strokeWidth={2} opacity={0.6}
                            style={{ pointerEvents: 'none' }} />
                        )}
                        {/* Icon */}
                        <text x={cx} y={cy - 4}
                          textAnchor="middle" dominantBaseline="middle"
                          fontSize={36} style={{ pointerEvents: 'none', userSelect: 'none' }}
                        >{icon}</text>
                        {/* Label */}
                        {editingLabel?.type === 'node' && editingLabel.id === node.id ? (
                          <foreignObject x={node.x} y={node.y + node.h - 22} width={node.w} height={22}>
                            <input
                              // @ts-ignore
                              xmlns="http://www.w3.org/1999/xhtml"
                              autoFocus
                              value={editingLabel.value}
                              onChange={e => setEditingLabel(s => s ? { ...s, value: e.target.value } : s)}
                              onBlur={commitLabel}
                              onKeyDown={e => { if (e.key === 'Enter') commitLabel(); if (e.key === 'Escape') setEditingLabel(null) }}
                              style={{
                                width: '100%', background: 'transparent', border: 'none', outline: 'none',
                                textAlign: 'center', fontSize: 11, color: node.textColor, fontFamily: 'inherit',
                              }}
                            />
                          </foreignObject>
                        ) : (
                          <text x={cx} y={node.y + node.h - 6}
                            textAnchor="middle" dominantBaseline="middle"
                            fontSize={11} fontWeight="500" fill={node.textColor}
                            style={{ pointerEvents: 'none', userSelect: 'none' }}>
                            {node.label.length > 18 ? node.label.slice(0, 17) + '…' : node.label}
                          </text>
                        )}
                      </>
                    ) : node.shape === 'webview' ? (
                      /* ── Web view placeholder (iframe rendered as overlay outside SVG) ── */
                      <>
                        {/* Border rect */}
                        <rect
                          x={node.x} y={node.y} width={node.w} height={node.h}
                          fill={darkMode ? '#1e1e2e' : '#f0f4ff'}
                          stroke={isSel ? colors.nodeStrokeSel : isConnSrc ? '#22d3ee' : '#6366f1'}
                          strokeWidth={isSel ? sw + 1 : sw}
                          strokeDasharray={isConnSrc ? '5 3' : undefined}
                          rx={6}
                        />
                        {/* Connect target ring */}
                        {isConnTarget && (
                          <rect x={node.x} y={node.y} width={node.w} height={node.h}
                            fill="none" stroke="#22d3ee" strokeWidth={2.5} opacity={0.7} rx={6}
                            style={{ pointerEvents: 'none' }} />
                        )}
                        {/* Title bar */}
                        <rect x={node.x} y={node.y} width={node.w} height={28}
                          fill={isSel ? '#6366f1' : darkMode ? '#2d2d44' : '#e0e7ff'}
                          rx={6} style={{ pointerEvents: 'none' }} />
                        <rect x={node.x} y={node.y + 16} width={node.w} height={12}
                          fill={isSel ? '#6366f1' : darkMode ? '#2d2d44' : '#e0e7ff'}
                          style={{ pointerEvents: 'none' }} />
                        {/* Globe icon */}
                        <text x={node.x + 10} y={node.y + 18}
                          fontSize={13} style={{ pointerEvents: 'none', userSelect: 'none' }}>🌐</text>
                        {/* URL label in title bar */}
                        <text x={node.x + 26} y={node.y + 18}
                          textAnchor="start" dominantBaseline="middle"
                          fontSize={10} fill={isSel ? 'white' : darkMode ? '#a5b4fc' : '#4338ca'}
                          style={{ pointerEvents: 'none', userSelect: 'none' }}>
                          {node.webviewUrl
                            ? (node.webviewUrl.length > Math.floor(node.w / 7) - 4
                                ? node.webviewUrl.slice(0, Math.floor(node.w / 7) - 4) + '…'
                                : node.webviewUrl)
                            : 'Double-click to enter URL'}
                        </text>
                        {/* Selection corner handles */}
                        {isSel && [
                          [node.x, node.y], [node.x + node.w, node.y],
                          [node.x, node.y + node.h], [node.x + node.w, node.y + node.h],
                        ].map(([hx, hy], i) => (
                          <rect key={i} x={hx - 4} y={hy - 4} width={8} height={8}
                            rx={2} fill="white" stroke={colors.nodeStrokeSel} strokeWidth={1.5}
                            style={{ pointerEvents: 'none' }} />
                        ))}
                      </>
                    ) : (
                      /* ── Flow / standard shape ── */
                      <>
                        {/* Drop shadow (skip when fill is transparent) */}
                        {nodeFill !== 'transparent' && (
                          <path d={nodeShapePath(node)} fill="rgba(0,0,0,0.12)"
                            transform="translate(2,3)" style={{ pointerEvents: 'none' }} />
                        )}
                        {/* Shape fill */}
                        <path d={nodeShapePath(node)} fill={nodeFill}
                          stroke={isConnSrc ? '#22d3ee' : isSel ? colors.nodeStrokeSel : colors.nodeStroke}
                          strokeWidth={isConnSrc ? sw + 1.5 : isSel ? sw + 1 : sw}
                          strokeDasharray={isConnSrc ? '5 3' : undefined}
                        />
                        {/* Connect target ring */}
                        {isConnTarget && (
                          <path d={nodeShapePath(node)} fill="none"
                            stroke="#22d3ee" strokeWidth={2.5} opacity={0.7}
                            style={{ pointerEvents: 'none' }} />
                        )}
                        {/* Inline label editor */}
                        {editingLabel?.type === 'node' && editingLabel.id === node.id ? (
                          <foreignObject x={node.x + 4} y={cy - 12} width={node.w - 8} height={24}>
                            <input
                              // @ts-ignore
                              xmlns="http://www.w3.org/1999/xhtml"
                              autoFocus
                              value={editingLabel.value}
                              onChange={e => setEditingLabel(s => s ? { ...s, value: e.target.value } : s)}
                              onBlur={commitLabel}
                              onKeyDown={e => { if (e.key === 'Enter') commitLabel(); if (e.key === 'Escape') setEditingLabel(null) }}
                              style={{
                                width: '100%', background: 'transparent', border: 'none', outline: 'none',
                                textAlign: 'center', fontSize: 12, color: node.textColor, fontFamily: 'inherit',
                              }}
                            />
                          </foreignObject>
                        ) : (
                          <text x={cx} y={cy}
                            textAnchor="middle" dominantBaseline="middle"
                            fontSize={11} fontWeight="500" fill={node.textColor}
                            style={{ pointerEvents: 'none', userSelect: 'none' }}
                          >
                            {node.label.length > 18 ? node.label.slice(0, 17) + '…' : node.label}
                          </text>
                        )}
                        {/* Selection corner handles */}
                        {isSel && [
                          [node.x, node.y], [node.x + node.w, node.y],
                          [node.x, node.y + node.h], [node.x + node.w, node.y + node.h],
                        ].map(([hx, hy], i) => (
                          <rect key={i} x={hx - 4} y={hy - 4} width={8} height={8}
                            rx={2} fill="white" stroke={colors.nodeStrokeSel} strokeWidth={1.5}
                            style={{ pointerEvents: 'none' }} />
                        ))}
                      </>
                    )}
                  </g>
                )
              })}

              {/* Rubber-band selection rect */}
              {selectionRect && (
                <rect
                  x={selectionRect.x} y={selectionRect.y}
                  width={selectionRect.w} height={selectionRect.h}
                  fill="rgba(99,102,241,0.08)" stroke="#6366f1" strokeWidth={1 / viewport.scale}
                  strokeDasharray={`${4 / viewport.scale} ${3 / viewport.scale}`}
                  style={{ pointerEvents: 'none' }}
                />
              )}
            </g>
          </svg>

          {/* ── Webview iframe overlays ── */}
          {diagram.nodes.filter(n => n.shape === 'webview').map(node => {
            const isSel = selectedNodeIds.has(node.id)
            const isEditing = editingWebviewUrl?.id === node.id
            const commitUrl = (raw: string) => {
              let url = raw.trim()
              if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url
              updateDiagram({ nodes: diagram.nodes.map(n => n.id === node.id ? { ...n, webviewUrl: url } : n) })
              setEditingWebviewUrl(null)
            }
            return (
              <WebviewNode
                key={node.id}
                node={node}
                viewport={viewport}
                isSel={isSel}
                darkMode={darkMode}
                isEditing={!!isEditing}
                editingValue={editingWebviewUrl?.value ?? node.webviewUrl ?? ''}
                onFocusUrl={() => { if (!editingWebviewUrl) setEditingWebviewUrl({ id: node.id, value: node.webviewUrl ?? '' }) }}
                onChangeUrl={v => setEditingWebviewUrl({ id: node.id, value: v })}
                onCommitUrl={commitUrl}
                onCancelEdit={() => setEditingWebviewUrl(null)}
                onReload={() => {
                  const url = node.webviewUrl!
                  updateDiagram({ nodes: diagram.nodes.map(n => n.id === node.id ? { ...n, webviewUrl: '' } : n) })
                  setTimeout(() => updateDiagram({ nodes: diagram.nodes.map(n => n.id === node.id ? { ...n, webviewUrl: url } : n) }), 50)
                }}
              />
            )
          })}

          {/* ── Mermaid diagram overlays ── */}
          {diagram.nodes.filter(n => n.shape === 'mermaid').map(node => (
            <MermaidCanvasNode key={node.id} node={node} viewport={viewport}
              onMouseDown={e => handleNodeMouseDown(e, node.id)}
              scrollDivRef={el => {
                if (el) mermaidNodeRefs.current.set(node.id, el)
                else mermaidNodeRefs.current.delete(node.id)
              }} />
          ))}

          {/* Note content hover popup */}
          {notePopup && (() => {
            const popupNode = diagram.nodes.find(n => n.id === notePopup.nodeId)
            const noteEntry = popupNode?.notePath ? index.get(popupNode.notePath) : null
            return (
              <div
                className="absolute z-50 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl flex flex-col"
                style={{ left: notePopup.screenX, top: notePopup.screenY, transform: 'translateX(-50%)', maxHeight: '320px' }}
                onMouseEnter={cancelHidePopup}
                onMouseLeave={scheduleHidePopup}
              >
                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
                  <span className="text-sm">📄</span>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 truncate flex-1">
                    {popupNode?.label}
                  </span>
                </div>
                <div className="overflow-y-auto px-3 py-2 flex-1" style={{ minHeight: 0 }}>
                  {noteEntry?.body ? (
                    <pre className="text-[10px] text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap font-sans">
                      {noteEntry.body}
                    </pre>
                  ) : (
                    <p className="text-[10px] text-gray-400 italic">(No content)</p>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Connect mode overlay hint */}
          {connectMode && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 pointer-events-none">
              <div className="bg-accent-500 text-white text-xs px-3 py-1.5 rounded-full shadow-lg">
                {connectFromId ? '→ Now click the target node' : '→ Click the source node'}
                <span className="ml-2 opacity-70">· Esc to cancel</span>
              </div>
            </div>
          )}

          {/* Zoom % */}
          <div className="absolute bottom-3 right-3 text-xs text-gray-400 dark:text-gray-500 bg-white/80 dark:bg-gray-900/80 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 select-none">
            {Math.round(viewport.scale * 100)}%
          </div>

          {/* Empty state */}
          {diagram.nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-gray-400 dark:text-gray-600">
                <p className="text-base font-medium mb-1">Drag shapes onto the canvas</p>
                <p className="text-sm">Use ⚡ Connect to draw arrows between nodes</p>
                <p className="text-xs mt-2 opacity-70">Scroll to zoom · Drag canvas to pan · Dbl-click to rename</p>
              </div>
            </div>
          )}
        </div>

        {/* ── Properties panel ── */}
        {showProps && (
          <div className="flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800 overflow-y-auto p-3 space-y-4 text-xs relative" style={{ width: propsWidth }}>
            {/* Resize handle */}
            <div
              className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize z-10 hover:bg-accent-500/30 active:bg-accent-500/50 transition-colors"
              onMouseDown={startPropsResize}
            />

            {/* Connect defaults */}
            <div>
              <p className={sectionCls}>New Connection</p>
              <div className="space-y-1.5">
                <div>
                  <label className={labelCls}>Style</label>
                  <select value={defaultEdgeStyle} onChange={e => setDefaultEdgeStyle(e.target.value as DiagramEdge['style'])} className={inputCls}>
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Arrow</label>
                  <select value={defaultEdgeArrow} onChange={e => setDefaultEdgeArrow(e.target.value as DiagramEdge['arrow'])} className={inputCls}>
                    <option value="end">→ End only</option>
                    <option value="both">↔ Both ends</option>
                    <option value="none">— None</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Selected node */}
            {selectedNode && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <p className={sectionCls}>Node</p>
                <div className="space-y-1.5">
                  <div>
                    <label className={labelCls}>Label</label>
                    <input value={selectedNode.label} onChange={e => updateSelectedNodes({ label: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Shape</label>
                    <select value={selectedNode.shape} onChange={e => updateSelectedNodes({ shape: e.target.value as NodeShape })} className={inputCls}>
                      {paletteSections.map(([sec, shapes]) => (
                        <optgroup key={sec} label={sec}>
                          {shapes.map(ps => <option key={ps.shape} value={ps.shape}>{ps.label}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Fill</label>
                    <div className="flex flex-wrap gap-0.5 mb-1">
                      {/* Transparent swatch */}
                      <button
                        onClick={() => updateSelectedNodes({ color: 'transparent' })}
                        title="Transparent"
                        className={`w-5 h-5 rounded-full border-2 transition-transform overflow-hidden ${selectedNode.color === 'transparent' ? 'border-accent-500 scale-110' : 'border-gray-300 dark:border-gray-600'}`}
                        style={{
                          background: 'repeating-conic-gradient(#d1d5db 0% 25%, #fff 0% 50%) 0 0 / 8px 8px',
                        }}
                      />
                      {COLOR_PRESETS.map(c => (
                        <button key={c} onClick={() => updateSelectedNodes({ color: c })}
                          className={`w-5 h-5 rounded-full border-2 transition-transform ${selectedNode.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                          style={{ background: c }} />
                      ))}
                    </div>
                    {selectedNode.color !== 'transparent' && (
                      <input type="color" value={selectedNode.color.startsWith('#') ? selectedNode.color : '#8b5cf6'}
                        onChange={e => updateSelectedNodes({ color: e.target.value })}
                        className="w-full h-7 rounded cursor-pointer border border-gray-300 dark:border-gray-600" />
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Text color</label>
                    <input type="color" value={selectedNode.textColor}
                      onChange={e => updateSelectedNodes({ textColor: e.target.value })}
                      className="w-full h-7 rounded cursor-pointer border border-gray-300 dark:border-gray-600" />
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <div>
                      <label className={labelCls}>W</label>
                      <input type="number" value={selectedNode.w} min={40}
                        onChange={e => updateSelectedNodes({ w: Math.max(40, Number(e.target.value)) })}
                        className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>H</label>
                      <input type="number" value={selectedNode.h} min={30}
                        onChange={e => updateSelectedNodes({ h: Math.max(30, Number(e.target.value)) })}
                        className={inputCls} />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Border thickness</label>
                    <div className="flex items-center gap-2">
                      <input type="range" min={0.5} max={8} step={0.5}
                        value={selectedNode.strokeWidth ?? 1.5}
                        onChange={e => updateSelectedNodes({ strokeWidth: Number(e.target.value) })}
                        className="flex-1 accent-accent-500" />
                      <span className="w-6 text-right text-gray-500">{selectedNode.strokeWidth ?? 1.5}</span>
                    </div>
                  </div>
                  {selectedNode.shape === 'mermaid' && (
                    <div className="space-y-1.5">
                      <div>
                        <label className={labelCls}>Diagram code</label>
                        <textarea
                          value={selectedNode.mermaidCode ?? ''}
                          onChange={e => updateSelectedNodes({ mermaidCode: e.target.value })}
                          rows={8}
                          className="w-full text-[11px] font-mono border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 resize-none focus:outline-none focus:ring-1 focus:ring-accent-500"
                        />
                      </div>
                      <button
                        onClick={() => handleAutofitMermaid(selectedNode.id)}
                        className="w-full px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="Resize node to fit the rendered diagram"
                      >⊡ Autofit to diagram</button>
                    </div>
                  )}
                  <button
                    onClick={() => {
                      const id = selectedNode.id
                      updateDiagram({
                        nodes: diagram.nodes.filter(n => n.id !== id),
                        edges: diagram.edges.filter(e => e.fromId !== id && e.toId !== id),
                      })
                      setSelectedNodeIds(new Set())
                    }}
                    className="w-full px-2 py-1 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded border border-red-200 dark:border-red-800 hover:bg-red-100"
                  >Delete node</button>
                </div>
              </div>
            )}

            {/* Selected edge */}
            {selectedEdge && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <p className={sectionCls}>Edge</p>
                <div className="space-y-1.5">
                  <div>
                    <label className={labelCls}>Label</label>
                    <input value={selectedEdge.label}
                      onChange={e => updateSelectedEdge({ label: e.target.value })} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Style</label>
                    <select value={selectedEdge.style}
                      onChange={e => updateSelectedEdge({ style: e.target.value as DiagramEdge['style'] })} className={inputCls}>
                      <option value="solid">Solid</option>
                      <option value="dashed">Dashed</option>
                      <option value="dotted">Dotted</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Arrow</label>
                    <select value={selectedEdge.arrow}
                      onChange={e => updateSelectedEdge({ arrow: e.target.value as DiagramEdge['arrow'] })} className={inputCls}>
                      <option value="end">→ End only</option>
                      <option value="both">↔ Both ends</option>
                      <option value="none">— None</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Line thickness</label>
                    <div className="flex items-center gap-2">
                      <input type="range" min={0.5} max={8} step={0.5}
                        value={selectedEdge.strokeWidth ?? 1.5}
                        onChange={e => updateSelectedEdge({ strokeWidth: Number(e.target.value) })}
                        className="flex-1 accent-accent-500" />
                      <span className="w-6 text-right text-gray-500">{selectedEdge.strokeWidth ?? 1.5}</span>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Color</label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {COLOR_PRESETS.map(c => (
                        <button key={c}
                          onClick={() => updateSelectedEdge({ color: c })}
                          className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${(selectedEdge.color ?? colors.edgeStroke) === c ? 'border-gray-600 dark:border-gray-200 scale-110' : 'border-transparent'}`}
                          style={{ background: c }} title={c} />
                      ))}
                      <input type="color"
                        value={selectedEdge.color ?? colors.edgeStroke}
                        onChange={e => updateSelectedEdge({ color: e.target.value })}
                        className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
                        title="Custom color" />
                      {selectedEdge.color && (
                        <button onClick={() => updateSelectedEdge({ color: undefined })}
                          className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          title="Reset to default">↺</button>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => { updateDiagram({ edges: diagram.edges.filter(e => e.id !== selectedEdgeId) }); setSelectedEdgeId(null) }}
                    className="w-full px-2 py-1 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded border border-red-200 dark:border-red-800 hover:bg-red-100"
                  >Delete edge</button>
                </div>
              </div>
            )}

            {!selectedNode && !selectedEdge && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 text-gray-400 dark:text-gray-500 text-center py-4">
                Select a node or edge<br />to edit its properties
              </div>
            )}

            {/* Mindmap theme settings */}
            {diagram.mindmapMode && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                <p className={sectionCls}>Mindmap Theme</p>
                <div className="grid grid-cols-3 gap-1 mb-2">
                  {MINDMAP_THEMES.map(t => (
                    <button
                      key={t.key}
                      onClick={() => updateDiagram({ mindmapTheme: t.key })}
                      title={t.name}
                      className={`h-10 rounded text-[9px] font-medium border-2 transition-all ${
                        (diagram.mindmapTheme ?? 'Rainbow') === t.key
                          ? 'border-accent-500 scale-105'
                          : 'border-transparent hover:border-gray-300'
                      }`}
                      style={{ background: t.bgColor, color: t.rootFill }}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
                <button
                  onClick={triggerMindmapLayout}
                  className="w-full px-2 py-1 text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100"
                >
                  Re-layout
                </button>
              </div>
            )}

            {/* Canvas settings */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
              <p className={sectionCls}>Canvas</p>
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={diagram.transparentBg ?? false}
                  onChange={e => updateDiagram({ transparentBg: e.target.checked })}
                  className="accent-accent-500"
                />
                <span className="text-gray-600 dark:text-gray-300">Transparent background</span>
              </label>
              <p className="text-gray-400 mb-1">{diagram.nodes.length} nodes · {diagram.edges.length} edges</p>
              <button
                onClick={() => {
                  if (!confirm('Clear all nodes and edges?')) return
                  updateDiagram({ nodes: [], edges: [] })
                  setSelectedNodeIds(new Set()); setSelectedEdgeId(null)
                }}
                className="w-full px-2 py-1 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded border border-red-200 dark:border-red-800 hover:bg-red-100"
              >Clear canvas</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Mermaid import modal ── */}
      {showMermaidModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={e => { if (e.target === e.currentTarget) setShowMermaidModal(false) }}
        >
          <div className="bg-white dark:bg-surface-800 rounded-xl shadow-2xl w-[700px] max-w-[95vw] max-h-[90vh] flex flex-col gap-3 p-5 overflow-hidden">
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-base">⬡</span>
              <span className="font-semibold text-sm text-gray-800 dark:text-gray-100 flex-1">Import Mermaid Diagram</span>
              <button
                onClick={() => setShowMermaidModal(false)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-gray-600 text-lg leading-none"
              >×</button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
              Paste your Mermaid code below to preview it as a rendered diagram.
            </p>
            <div className="flex gap-3 flex-1 min-h-0">
              <div className="flex flex-col flex-1 min-w-0">
                <label className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Mermaid code</label>
                <textarea
                  autoFocus
                  value={mermaidInput}
                  onChange={e => setMermaidInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') setShowMermaidModal(false) }}
                  placeholder={'graph TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[End]\n  B -->|No| A'}
                  className="flex-1 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-gray-50 dark:bg-surface-700 text-gray-800 dark:text-gray-200 resize-none focus:outline-none focus:ring-2 focus:ring-accent-500 placeholder-gray-300 dark:placeholder-gray-600"
                />
              </div>
              <div className="flex flex-col flex-1 min-w-0">
                <label className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Preview</label>
                <div className="flex-1 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-surface-900 p-2">
                  {mermaidInput.trim()
                    ? <MermaidDiagram code={mermaidInput.trim()} />
                    : <div className="h-full flex items-center justify-center text-xs text-gray-300 dark:text-gray-600">Preview will appear here</div>
                  }
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 flex-shrink-0">
              <button
                onClick={() => setShowMermaidModal(false)}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                disabled={!mermaidInput.trim()}
                onClick={() => {
                  const code = mermaidInput.trim()
                  if (!code) return
                  const W = 400
                  const H = 300
                  // Place near centre of current viewport
                  const cx = (-viewport.x + (containerRef.current?.clientWidth  ?? 600) / 2) / viewport.scale
                  const cy = (-viewport.y + (containerRef.current?.clientHeight ?? 400) / 2) / viewport.scale
                  const newNode: DiagramNode = {
                    id: uid(),
                    x: snap(cx - W / 2), y: snap(cy - H / 2),
                    w: W, h: H,
                    shape: 'mermaid',
                    label: 'Mermaid Diagram',
                    color: darkMode ? '#1e1e2e' : '#f8f8ff',
                    textColor: darkMode ? '#e5e7eb' : '#1f2937',
                    strokeWidth: 1.5,
                    mermaidCode: code,
                  }
                  updateDiagram({ nodes: [...diagram.nodes, newNode] })
                  setSelectedNodeIds(new Set([newNode.id]))
                  setMermaidInput('')
                  setShowMermaidModal(false)
                }}
                className="px-3 py-1.5 text-xs rounded-lg bg-accent-500 hover:bg-accent-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Insert into Canvas
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
