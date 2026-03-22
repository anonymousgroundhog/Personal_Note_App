import React, {
  useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo,
} from 'react'
import { useUiStore } from '../../stores/uiStore'

// ─── Types ────────────────────────────────────────────────────────────────────

export type NodeShape = 'rect' | 'diamond' | 'circle' | 'parallelogram' | 'cylinder' | 'hexagon'

export interface DiagramNode {
  id: string
  x: number
  y: number
  w: number
  h: number
  shape: NodeShape
  label: string
  color: string   // fill hex
  textColor: string
}

export interface DiagramEdge {
  id: string
  fromId: string
  toId: string
  label: string
  style: 'solid' | 'dashed' | 'dotted'
  arrow: 'end' | 'both' | 'none'
}

export interface Diagram {
  id: string
  name: string
  nodes: DiagramNode[]
  edges: DiagramEdge[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'diagramEditor_diagrams'
const DEFAULT_NODE_W = 140
const DEFAULT_NODE_H = 60
const GRID = 10
const snap = (v: number) => Math.round(v / GRID) * GRID

const PALETTE_SHAPES: { shape: NodeShape; label: string; icon: string }[] = [
  { shape: 'rect',          label: 'Process',   icon: '▭' },
  { shape: 'diamond',       label: 'Decision',  icon: '◇' },
  { shape: 'circle',        label: 'Start/End', icon: '○' },
  { shape: 'parallelogram', label: 'I/O',       icon: '▱' },
  { shape: 'cylinder',      label: 'Database',  icon: '⬭' },
  { shape: 'hexagon',       label: 'Prep',      icon: '⬡' },
]

const COLOR_PRESETS = [
  '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#6b7280',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

function getNodeCenter(n: DiagramNode): [number, number] {
  return [n.x + n.w / 2, n.y + n.h / 2]
}

/** Returns the point on the border of the node closest to (tx, ty) */
function getBorderPoint(n: DiagramNode, tx: number, ty: number): [number, number] {
  const cx = n.x + n.w / 2
  const cy = n.y + n.h / 2
  const dx = tx - cx
  const dy = ty - cy
  if (dx === 0 && dy === 0) return [cx, cy]

  if (n.shape === 'circle') {
    const r = Math.min(n.w, n.h) / 2
    const len = Math.hypot(dx, dy)
    return [cx + (dx / len) * r, cy + (dy / len) * r]
  }

  if (n.shape === 'diamond') {
    const hw = n.w / 2
    const hh = n.h / 2
    // parametric intersection with diamond edges
    const t1 = Math.min(Math.abs(hw / (dx || 0.001)), Math.abs(hh / (dy || 0.001)))
    return [cx + dx * t1, cy + dy * t1]
  }

  // rect / parallelogram / cylinder / hexagon — use bounding rect
  const hw = n.w / 2
  const hh = n.h / 2
  const tx1 = Math.abs(dx) > 0.001 ? hw / Math.abs(dx) : Infinity
  const ty1 = Math.abs(dy) > 0.001 ? hh / Math.abs(dy) : Infinity
  const t = Math.min(tx1, ty1)
  return [cx + dx * t, cy + dy * t]
}

function nodeShapePath(n: DiagramNode): string {
  const { x, y, w, h, shape } = n
  switch (shape) {
    case 'rect':
      return `M ${x} ${y} h ${w} v ${h} h ${-w} Z`
    case 'diamond': {
      const cx = x + w / 2, cy = y + h / 2
      return `M ${cx} ${y} L ${x + w} ${cy} L ${cx} ${y + h} L ${x} ${cy} Z`
    }
    case 'circle': {
      const rx = w / 2, ry = h / 2, cx = x + rx, cy = y + ry
      return `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${w} 0 a ${rx} ${ry} 0 1 0 ${-w} 0`
    }
    case 'parallelogram': {
      const off = 16
      return `M ${x + off} ${y} L ${x + w} ${y} L ${x + w - off} ${y + h} L ${x} ${y + h} Z`
    }
    case 'cylinder': {
      const rx = w / 2, ry = 10, cx = x + rx, cy = y
      return [
        `M ${x} ${cy + ry}`,
        `a ${rx} ${ry} 0 1 1 ${w} 0`,
        `v ${h - ry * 2}`,
        `a ${rx} ${ry} 0 1 1 ${-w} 0`,
        `Z`,
        // top ellipse outline
        `M ${x} ${cy + ry} a ${rx} ${ry} 0 1 0 ${w} 0`,
      ].join(' ')
    }
    case 'hexagon': {
      const off = w * 0.2
      return [
        `M ${x + off} ${y}`,
        `L ${x + w - off} ${y}`,
        `L ${x + w} ${y + h / 2}`,
        `L ${x + w - off} ${y + h}`,
        `L ${x + off} ${y + h}`,
        `L ${x} ${y + h / 2}`,
        `Z`,
      ].join(' ')
    }
  }
}

/** Build a smooth cubic bezier path between two node border points */
function edgePath(
  from: DiagramNode,
  to: DiagramNode,
  dxOff = 0, dyOff = 0,
): string {
  const [tx, ty] = getNodeCenter(to)
  const [fx, fy] = getNodeCenter(from)
  const [bfx, bfy] = getBorderPoint(from, tx + dxOff, ty + dyOff)
  const [btx, bty] = getBorderPoint(to, fx, fy)
  const dx = btx - bfx
  const dy = bty - bfy
  const c = Math.min(Math.abs(dx), Math.abs(dy), 80)
  return `M ${bfx} ${bfy} C ${bfx + dx * 0.5} ${bfy} ${btx - dx * 0.5} ${bty} ${btx} ${bty}`
}

// ─── Load / Save ──────────────────────────────────────────────────────────────

function loadDiagrams(): Diagram[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Diagram[]
  } catch {}
  return [{ id: uid(), name: 'Untitled Diagram', nodes: [], edges: [] }]
}

function saveDiagrams(diagrams: Diagram[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(diagrams)) } catch {}
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DiagramEditor() {
  const { darkMode } = useUiStore()

  // ── Diagram state ──
  const [diagrams, setDiagrams] = useState<Diagram[]>(loadDiagrams)
  const [activeDiagramId, setActiveDiagramId] = useState<string>(diagrams[0].id)

  const diagram = diagrams.find(d => d.id === activeDiagramId) ?? diagrams[0]

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
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 })

  // ── Drag ──
  const dragRef = useRef<{
    type: 'node' | 'canvas' | 'palette'
    nodeIds?: string[]
    startClient: [number, number]
    startNodePos?: [number, number][]  // original positions for multi-drag
    startVp?: { x: number; y: number }
  } | null>(null)

  // ── Connect mode ──
  const [connectFrom, setConnectFrom] = useState<string | null>(null)

  // ── Inline label edit ──
  const [editingLabel, setEditingLabel] = useState<{ type: 'node' | 'edge'; id: string; value: string } | null>(null)

  // ── Property panel ──
  const [showProps, setShowProps] = useState(false)

  // ── SVG ref ──
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // ── Colors ──
  const colors = useMemo(() => ({
    bg: darkMode ? '#111111' : '#f8f8f8',
    gridLine: darkMode ? '#1e1e1e' : '#e5e7eb',
    nodeFill: darkMode ? '#1e1e1e' : '#ffffff',
    nodeStroke: darkMode ? '#3d3d3d' : '#d1d5db',
    nodeStrokeSel: '#8b5cf6',
    nodeText: darkMode ? '#e5e7eb' : '#1f2937',
    edgeStroke: darkMode ? '#6b7280' : '#9ca3af',
    edgeStrokeSel: '#8b5cf6',
    shadow: darkMode ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.10)',
  }), [darkMode])

  // ── Palette drag pending ──
  const paletteDragRef = useRef<{ shape: NodeShape } | null>(null)

  // ─── Convert client coords to SVG canvas coords ──────────────────────────
  const clientToCanvas = useCallback((cx: number, cy: number): [number, number] => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return [0, 0]
    const sx = (cx - rect.left - viewport.x) / viewport.scale
    const sy = (cy - rect.top - viewport.y) / viewport.scale
    return [sx, sy]
  }, [viewport])

  // ─── Node interactions ────────────────────────────────────────────────────
  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()

    // Connect mode: clicking a node creates an edge
    if (connectFrom !== null) {
      if (connectFrom !== nodeId) {
        const newEdge: DiagramEdge = {
          id: uid(), fromId: connectFrom, toId: nodeId,
          label: '', style: 'solid', arrow: 'end',
        }
        updateDiagram({ edges: [...diagram.edges, newEdge] })
      }
      setConnectFrom(null)
      return
    }

    if (editingLabel) return

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

    const startNodePos = ids.map(id => {
      const n = diagram.nodes.find(n => n.id === id)!
      return [n.x, n.y] as [number, number]
    })

    dragRef.current = {
      type: 'node',
      nodeIds: ids,
      startClient: [e.clientX, e.clientY],
      startNodePos,
    }
  }, [connectFrom, editingLabel, selectedNodeIds, diagram, updateDiagram])

  const handleNodeDblClick = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    const node = diagram.nodes.find(n => n.id === nodeId)
    if (!node) return
    setEditingLabel({ type: 'node', id: nodeId, value: node.label })
  }, [diagram])

  // ─── Canvas interactions ──────────────────────────────────────────────────
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target !== svgRef.current && (e.target as Element).tagName === 'svg') {
      // clicked blank canvas
    }
    if (connectFrom) { setConnectFrom(null); return }
    if (editingLabel) { commitLabel(); return }
    setSelectedNodeIds(new Set())
    setSelectedEdgeId(null)
    dragRef.current = {
      type: 'canvas',
      startClient: [e.clientX, e.clientY],
      startVp: { x: viewport.x, y: viewport.y },
    }
  }, [connectFrom, editingLabel, viewport])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const dr = dragRef.current
    if (!dr) return

    if (dr.type === 'canvas' && dr.startVp) {
      const dx = e.clientX - dr.startClient[0]
      const dy = e.clientY - dr.startClient[1]
      setViewport(v => ({ ...v, x: dr.startVp!.x + dx, y: dr.startVp!.y + dy }))
    }

    if (dr.type === 'node' && dr.nodeIds && dr.startNodePos) {
      const dx = (e.clientX - dr.startClient[0]) / viewport.scale
      const dy = (e.clientY - dr.startClient[1]) / viewport.scale
      const updatedNodes = diagram.nodes.map(n => {
        const idx = dr.nodeIds!.indexOf(n.id)
        if (idx === -1) return n
        return { ...n, x: snap(dr.startNodePos![idx][0] + dx), y: snap(dr.startNodePos![idx][1] + dy) }
      })
      updateDiagram({ nodes: updatedNodes })
    }
  }, [viewport.scale, diagram.nodes, updateDiagram])

  const handleMouseUp = useCallback(() => {
    dragRef.current = null
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  // ─── Wheel zoom ───────────────────────────────────────────────────────────
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    setViewport(v => {
      const newScale = Math.max(0.1, Math.min(4, v.scale * factor))
      const ratio = newScale / v.scale
      return {
        scale: newScale,
        x: mx - ratio * (mx - v.x),
        y: my - ratio * (my - v.y),
      }
    })
  }, [])

  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // ─── Drop from palette ────────────────────────────────────────────────────
  const handleSvgDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const shape = paletteDragRef.current?.shape
    if (!shape) return
    paletteDragRef.current = null
    const [cx, cy] = clientToCanvas(e.clientX, e.clientY)
    const x = snap(cx - DEFAULT_NODE_W / 2)
    const y = snap(cy - DEFAULT_NODE_H / 2)
    const newNode: DiagramNode = {
      id: uid(), x, y, w: DEFAULT_NODE_W, h: DEFAULT_NODE_H,
      shape, label: shape.charAt(0).toUpperCase() + shape.slice(1),
      color: COLOR_PRESETS[diagram.nodes.length % COLOR_PRESETS.length],
      textColor: '#ffffff',
    }
    updateDiagram({ nodes: [...diagram.nodes, newNode] })
    setSelectedNodeIds(new Set([newNode.id]))
  }, [clientToCanvas, diagram.nodes, updateDiagram])

  // ─── Keyboard ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editingLabel) return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const target = e.target as HTMLElement
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
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
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedNodeIds, selectedEdgeId, diagram, updateDiagram, editingLabel])

  // ─── Label commit ─────────────────────────────────────────────────────────
  const commitLabel = useCallback(() => {
    if (!editingLabel) return
    if (editingLabel.type === 'node') {
      updateDiagram({ nodes: diagram.nodes.map(n => n.id === editingLabel.id ? { ...n, label: editingLabel.value } : n) })
    } else {
      updateDiagram({ edges: diagram.edges.map(ed => ed.id === editingLabel.id ? { ...ed, label: editingLabel.value } : ed) })
    }
    setEditingLabel(null)
  }, [editingLabel, diagram, updateDiagram])

  // ─── Export ───────────────────────────────────────────────────────────────
  const exportSvg = () => {
    const el = svgRef.current
    if (!el) return
    // Temporarily remove transform to export at 1:1
    const g = el.querySelector('g[data-viewport]') as SVGGElement | null
    const origTransform = g?.getAttribute('transform') ?? ''
    g?.setAttribute('transform', '')
    const w = el.viewBox.baseVal.width || el.clientWidth
    const h = el.viewBox.baseVal.height || el.clientHeight
    const clone = el.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    g?.setAttribute('transform', origTransform)
    // Fit viewBox to content
    if (diagram.nodes.length > 0) {
      const xs = diagram.nodes.map(n => n.x)
      const ys = diagram.nodes.map(n => n.y)
      const x2 = diagram.nodes.map(n => n.x + n.w)
      const y2 = diagram.nodes.map(n => n.y + n.h)
      const minX = Math.min(...xs) - 20
      const minY = Math.min(...ys) - 20
      const maxX = Math.max(...x2) + 20
      const maxY = Math.max(...y2) + 20
      clone.setAttribute('viewBox', `${minX} ${minY} ${maxX - minX} ${maxY - minY}`)
      clone.setAttribute('width', String(maxX - minX))
      clone.setAttribute('height', String(maxY - minY))
    }
    const ser = new XMLSerializer()
    const svgStr = ser.serializeToString(clone)
    const blob = new Blob([svgStr], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${diagram.name.replace(/\s+/g, '-').toLowerCase()}.svg`
    a.click(); URL.revokeObjectURL(url)
  }

  const exportPng = () => {
    if (diagram.nodes.length === 0) return
    const xs = diagram.nodes.map(n => n.x)
    const ys = diagram.nodes.map(n => n.y)
    const x2 = diagram.nodes.map(n => n.x + n.w)
    const y2 = diagram.nodes.map(n => n.y + n.h)
    const minX = Math.min(...xs) - 20
    const minY = Math.min(...ys) - 20
    const vw = Math.max(...x2) + 20 - minX
    const vh = Math.max(...y2) + 20 - minY

    // Clone SVG
    const el = svgRef.current
    if (!el) return
    const clone = el.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.setAttribute('viewBox', `${minX} ${minY} ${vw} ${vh}`)
    clone.setAttribute('width', String(vw))
    clone.setAttribute('height', String(vh))
    // Remove the viewport transform from the clone
    const gVp = clone.querySelector('g[data-viewport]') as SVGGElement | null
    gVp?.setAttribute('transform', '')
    const ser = new XMLSerializer()
    const svgStr = ser.serializeToString(clone)
    const img = new Image()
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgStr)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const scale = 2
      canvas.width = vw * scale; canvas.height = vh * scale
      const ctx = canvas.getContext('2d')!
      ctx.scale(scale, scale)
      ctx.drawImage(img, 0, 0)
      const pngUrl = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = pngUrl; a.download = `${diagram.name.replace(/\s+/g, '-').toLowerCase()}.png`
      a.click()
    }
    img.src = url
  }

  // ─── Derived selection ────────────────────────────────────────────────────
  const selectedNodes = useMemo(
    () => diagram.nodes.filter(n => selectedNodeIds.has(n.id)),
    [diagram.nodes, selectedNodeIds]
  )
  const selectedNode = selectedNodes.length === 1 ? selectedNodes[0] : null

  const updateSelectedNodes = (patch: Partial<DiagramNode>) => {
    updateDiagram({
      nodes: diagram.nodes.map(n => selectedNodeIds.has(n.id) ? { ...n, ...patch } : n),
    })
  }

  const selectedEdge = selectedEdgeId ? diagram.edges.find(e => e.id === selectedEdgeId) ?? null : null
  const updateSelectedEdge = (patch: Partial<DiagramEdge>) => {
    if (!selectedEdgeId) return
    updateDiagram({ edges: diagram.edges.map(e => e.id === selectedEdgeId ? { ...e, ...patch } : e) })
  }

  // ─── Fit view ─────────────────────────────────────────────────────────────
  const fitView = useCallback(() => {
    if (diagram.nodes.length === 0) { setViewport({ x: 0, y: 0, scale: 1 }); return }
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const xs = diagram.nodes.map(n => n.x)
    const ys = diagram.nodes.map(n => n.y)
    const x2 = diagram.nodes.map(n => n.x + n.w)
    const y2 = diagram.nodes.map(n => n.y + n.h)
    const minX = Math.min(...xs) - 40; const minY = Math.min(...ys) - 40
    const maxX = Math.max(...x2) + 40; const maxY = Math.max(...y2) + 40
    const scale = Math.min(rect.width / (maxX - minX), rect.height / (maxY - minY), 1.5)
    const x = rect.width / 2 - ((minX + maxX) / 2) * scale
    const y = rect.height / 2 - ((minY + maxY) / 2) * scale
    setViewport({ x, y, scale })
  }, [diagram.nodes])

  // ─── Diagram management ───────────────────────────────────────────────────
  const newDiagram = () => {
    const d: Diagram = { id: uid(), name: 'Untitled Diagram', nodes: [], edges: [] }
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

  // ─── Render ───────────────────────────────────────────────────────────────
  const transform = `translate(${viewport.x},${viewport.y}) scale(${viewport.scale})`

  const panelCls = 'text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5'
  const inputCls = 'w-full text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500'

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-surface-900">

      {/* ── Top toolbar ── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-gray-50 dark:bg-surface-800">
        {/* Diagram tabs */}
        <div className="flex items-center gap-1 overflow-x-auto flex-1">
          {diagrams.map(d => (
            <div key={d.id} className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={() => { setActiveDiagramId(d.id); setSelectedNodeIds(new Set()); setSelectedEdgeId(null) }}
                className={`px-3 py-1 text-xs rounded-t border-b-2 transition-colors ${
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
                    className="bg-transparent border-none outline-none text-xs w-28 min-w-0"
                  />
                ) : d.name}
              </button>
              {diagrams.length > 1 && (
                <button
                  onClick={() => deleteDiagram(d.id)}
                  className="text-gray-300 hover:text-red-400 text-xs leading-none pb-0.5"
                  title="Delete diagram"
                >×</button>
              )}
            </div>
          ))}
          <button
            onClick={newDiagram}
            className="px-2 py-1 text-xs text-gray-400 hover:text-accent-500 flex-shrink-0"
            title="New diagram"
          >+ New</button>
        </div>

        {/* Right toolbar actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            title="Connect mode (C)"
            onClick={() => setConnectFrom(v => v === null ? '' : null)}
            className={`px-2 py-1 text-xs rounded border transition-colors ${
              connectFrom !== null
                ? 'bg-accent-500 text-white border-accent-600'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            {connectFrom !== null ? '🔗 Click a node…' : '⚡ Connect'}
          </button>
          <button onClick={fitView} title="Fit view"
            className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
            ⊡ Fit
          </button>
          <button onClick={exportSvg} title="Export SVG"
            className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
            ↓ SVG
          </button>
          <button onClick={exportPng} title="Export PNG"
            className="px-2 py-1 text-xs rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
            ↓ PNG
          </button>
          <button
            onClick={() => setShowProps(v => !v)}
            className={`px-2 py-1 text-xs rounded border transition-colors ${
              showProps
                ? 'bg-accent-500 text-white border-accent-600'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            ⚙ Props
          </button>
        </div>
      </div>

      {/* ── Body: palette | canvas | props ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Palette */}
        <div className="w-20 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800 flex flex-col items-center py-3 gap-1 overflow-y-auto">
          <p className="text-xs text-gray-400 mb-2 font-medium">Shapes</p>
          {PALETTE_SHAPES.map(ps => (
            <div
              key={ps.shape}
              draggable
              onDragStart={() => { paletteDragRef.current = { shape: ps.shape } }}
              onDragEnd={() => { paletteDragRef.current = null }}
              className="w-14 h-14 flex flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-grab hover:border-accent-400 hover:bg-accent-50 dark:hover:bg-accent-900/20 transition-colors select-none"
              title={`Drag to add ${ps.label}`}
            >
              <span className="text-xl leading-none">{ps.icon}</span>
              <span className="text-[9px] text-gray-400 leading-none">{ps.label}</span>
            </div>
          ))}

          <div className="mt-3 w-14 border-t border-gray-200 dark:border-gray-700 pt-2 text-center">
            <p className="text-[9px] text-gray-400 mb-1.5">Colors</p>
            {COLOR_PRESETS.map(c => (
              <button
                key={c}
                onClick={() => updateSelectedNodes({ color: c })}
                className="w-5 h-5 m-0.5 rounded-full border-2 border-transparent hover:border-white"
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>
        </div>

        {/* Canvas */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden relative"
          style={{ background: colors.bg, cursor: connectFrom !== null ? 'crosshair' : 'default' }}
        >
          <svg
            ref={svgRef}
            className="w-full h-full"
            onMouseDown={handleCanvasMouseDown}
            onDragOver={e => e.preventDefault()}
            onDrop={handleSvgDrop}
          >
            <defs>
              <pattern id="dg-grid" width={GRID * viewport.scale} height={GRID * viewport.scale}
                x={viewport.x % (GRID * viewport.scale)} y={viewport.y % (GRID * viewport.scale)}
                patternUnits="userSpaceOnUse">
                <path d={`M ${GRID * viewport.scale} 0 L 0 0 0 ${GRID * viewport.scale}`}
                  fill="none" stroke={colors.gridLine} strokeWidth={0.5} />
              </pattern>
              <filter id="dg-shadow">
                <feDropShadow dx="1" dy="2" stdDeviation="3" floodColor={colors.shadow} />
              </filter>
              <marker id="dg-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 Z" fill={colors.edgeStroke} />
              </marker>
              <marker id="dg-arrow-sel" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L8,3 Z" fill={colors.edgeStrokeSel} />
              </marker>
              <marker id="dg-arrow-start" markerWidth="8" markerHeight="8" refX="2" refY="3" orient="auto-start-reverse">
                <path d="M0,0 L0,6 L8,3 Z" fill={colors.edgeStroke} />
              </marker>
            </defs>

            {/* Grid */}
            <rect width="100%" height="100%" fill="url(#dg-grid)" />

            <g data-viewport transform={transform}>
              {/* Edges */}
              {diagram.edges.map(edge => {
                const from = diagram.nodes.find(n => n.id === edge.fromId)
                const to = diagram.nodes.find(n => n.id === edge.toId)
                if (!from || !to) return null
                const isSel = edge.id === selectedEdgeId
                const d = edgePath(from, to)
                const stroke = isSel ? colors.edgeStrokeSel : colors.edgeStroke
                const markEnd = edge.arrow !== 'none' ? `url(#dg-arrow${isSel ? '-sel' : ''})` : undefined
                const markStart = edge.arrow === 'both' ? `url(#dg-arrow-start)` : undefined
                const midPt = (() => {
                  // approximate midpoint from the bezier
                  const [fx, fy] = getBorderPoint(from, to.x + to.w / 2, to.y + to.h / 2)
                  const [tx, ty] = getBorderPoint(to, from.x + from.w / 2, from.y + from.h / 2)
                  return [(fx + tx) / 2, (fy + ty) / 2] as [number, number]
                })()
                return (
                  <g key={edge.id} style={{ cursor: 'pointer' }}>
                    {/* Invisible wider hit area */}
                    <path d={d} fill="none" stroke="transparent" strokeWidth={12}
                      onClick={e => { e.stopPropagation(); setSelectedEdgeId(edge.id); setSelectedNodeIds(new Set()) }}
                    />
                    <path
                      d={d} fill="none" stroke={stroke}
                      strokeWidth={isSel ? 2 : 1.5}
                      strokeDasharray={edge.style === 'dashed' ? '6 4' : edge.style === 'dotted' ? '2 4' : undefined}
                      markerEnd={markEnd}
                      markerStart={markStart}
                    />
                    {edge.label && (
                      <text
                        x={midPt[0]} y={midPt[1] - 6}
                        textAnchor="middle" fontSize={10}
                        fill={isSel ? colors.edgeStrokeSel : colors.edgeStroke}
                        style={{ userSelect: 'none' }}
                        onDoubleClick={(e: React.MouseEvent) => { e.stopPropagation(); setEditingLabel({ type: 'edge', id: edge.id, value: edge.label }) }}
                      >
                        {edge.label}
                      </text>
                    )}
                  </g>
                )
              })}

              {/* Nodes */}
              {diagram.nodes.map(node => {
                const isSel = selectedNodeIds.has(node.id)
                const isConnSrc = connectFrom === node.id
                return (
                  <g
                    key={node.id}
                    style={{ cursor: connectFrom !== null ? 'crosshair' : 'grab' }}
                    onMouseDown={e => handleNodeMouseDown(e, node.id)}
                    onDoubleClick={e => handleNodeDblClick(e, node.id)}
                  >
                    {/* Shadow */}
                    <path d={nodeShapePath(node)} fill="rgba(0,0,0,0.15)"
                      transform="translate(2,3)" style={{ pointerEvents: 'none' }} />
                    {/* Fill */}
                    <path d={nodeShapePath(node)} fill={node.color}
                      stroke={isConnSrc ? '#22d3ee' : isSel ? colors.nodeStrokeSel : colors.nodeStroke}
                      strokeWidth={isConnSrc ? 3 : isSel ? 2.5 : 1.5}
                      strokeDasharray={isConnSrc ? '5 3' : undefined}
                    />
                    {/* Label */}
                    {editingLabel?.type === 'node' && editingLabel.id === node.id ? (
                      <foreignObject x={node.x + 4} y={node.y + node.h / 2 - 12} width={node.w - 8} height={24}>
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
                      <text
                        x={node.x + node.w / 2}
                        y={node.y + node.h / 2}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={12}
                        fontWeight="500"
                        fill={node.textColor}
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                      >
                        {node.label.length > 18 ? node.label.slice(0, 17) + '…' : node.label}
                      </text>
                    )}
                    {/* Selection handles */}
                    {isSel && (
                      <>
                        {[
                          [node.x, node.y], [node.x + node.w, node.y],
                          [node.x, node.y + node.h], [node.x + node.w, node.y + node.h],
                        ].map(([hx, hy], i) => (
                          <rect key={i} x={hx - 4} y={hy - 4} width={8} height={8}
                            rx={2} fill="white" stroke={colors.nodeStrokeSel} strokeWidth={1.5}
                            style={{ pointerEvents: 'none' }} />
                        ))}
                      </>
                    )}
                    {/* Connect hint ring */}
                    {connectFrom !== null && connectFrom !== node.id && (
                      <path d={nodeShapePath(node)} fill="none"
                        stroke="#22d3ee" strokeWidth={2} opacity={0.5}
                        style={{ pointerEvents: 'none' }} />
                    )}
                    {/* "Click to connect from" badge */}
                    {connectFrom === '' && (
                      <text x={node.x + node.w / 2} y={node.y - 8}
                        textAnchor="middle" fontSize={9} fill="#22d3ee"
                        style={{ pointerEvents: 'none', userSelect: 'none' }}>
                        click to start
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          </svg>

          {/* Zoom indicator */}
          <div className="absolute bottom-3 right-3 text-xs text-gray-400 dark:text-gray-500 bg-white/80 dark:bg-gray-900/80 px-2 py-1 rounded border border-gray-200 dark:border-gray-700 select-none">
            {Math.round(viewport.scale * 100)}%
          </div>

          {/* Empty state hint */}
          {diagram.nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-gray-400 dark:text-gray-600">
                <p className="text-lg font-medium mb-1">Drag shapes onto the canvas</p>
                <p className="text-sm">or use ⚡ Connect to link nodes</p>
                <p className="text-xs mt-2 opacity-70">Scroll to zoom · Drag canvas to pan · Double-click node to rename</p>
              </div>
            </div>
          )}
        </div>

        {/* Properties panel */}
        {showProps && (
          <div className="w-52 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-surface-800 overflow-y-auto p-3 space-y-4">
            {selectedNode && (
              <>
                <div>
                  <p className={panelCls}>Node</p>
                  <div className="space-y-2">
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">Label</label>
                      <input
                        value={selectedNode.label}
                        onChange={e => updateSelectedNodes({ label: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">Shape</label>
                      <select
                        value={selectedNode.shape}
                        onChange={e => updateSelectedNodes({ shape: e.target.value as NodeShape })}
                        className={inputCls}
                      >
                        {PALETTE_SHAPES.map(ps => (
                          <option key={ps.shape} value={ps.shape}>{ps.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">Fill color</label>
                      <div className="flex flex-wrap gap-1 mb-1">
                        {COLOR_PRESETS.map(c => (
                          <button key={c}
                            onClick={() => updateSelectedNodes({ color: c })}
                            className={`w-5 h-5 rounded-full border-2 ${selectedNode.color === c ? 'border-white scale-110' : 'border-transparent'}`}
                            style={{ background: c }} />
                        ))}
                      </div>
                      <input type="color" value={selectedNode.color}
                        onChange={e => updateSelectedNodes({ color: e.target.value })}
                        className="w-full h-7 rounded cursor-pointer border border-gray-300 dark:border-gray-600" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">Text color</label>
                      <input type="color" value={selectedNode.textColor}
                        onChange={e => updateSelectedNodes({ textColor: e.target.value })}
                        className="w-full h-7 rounded cursor-pointer border border-gray-300 dark:border-gray-600" />
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">Width</label>
                        <input type="number" value={selectedNode.w} min={40}
                          onChange={e => updateSelectedNodes({ w: Number(e.target.value) })}
                          className={inputCls} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">Height</label>
                        <input type="number" value={selectedNode.h} min={30}
                          onChange={e => updateSelectedNodes({ h: Number(e.target.value) })}
                          className={inputCls} />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {selectedEdge && (
              <div>
                <p className={panelCls}>Edge</p>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">Label</label>
                    <input
                      value={selectedEdge.label}
                      onChange={e => updateSelectedEdge({ label: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">Style</label>
                    <select value={selectedEdge.style}
                      onChange={e => updateSelectedEdge({ style: e.target.value as DiagramEdge['style'] })}
                      className={inputCls}>
                      <option value="solid">Solid</option>
                      <option value="dashed">Dashed</option>
                      <option value="dotted">Dotted</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-0.5">Arrow</label>
                    <select value={selectedEdge.arrow}
                      onChange={e => updateSelectedEdge({ arrow: e.target.value as DiagramEdge['arrow'] })}
                      className={inputCls}>
                      <option value="end">→ End</option>
                      <option value="both">↔ Both</option>
                      <option value="none">— None</option>
                    </select>
                  </div>
                  <button
                    onClick={() => { updateDiagram({ edges: diagram.edges.filter(e => e.id !== selectedEdgeId) }); setSelectedEdgeId(null) }}
                    className="w-full px-2 py-1 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40"
                  >
                    Delete edge
                  </button>
                </div>
              </div>
            )}

            {!selectedNode && !selectedEdge && (
              <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">
                Select a node or edge<br />to edit properties
              </div>
            )}

            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
              <p className={panelCls}>Canvas</p>
              <p className="text-xs text-gray-400 mb-1">Nodes: {diagram.nodes.length}</p>
              <p className="text-xs text-gray-400 mb-2">Edges: {diagram.edges.length}</p>
              <button
                onClick={() => {
                  if (!confirm('Clear all nodes and edges?')) return
                  updateDiagram({ nodes: [], edges: [] })
                  setSelectedNodeIds(new Set()); setSelectedEdgeId(null)
                }}
                className="w-full px-2 py-1 text-xs bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40"
              >
                Clear canvas
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
