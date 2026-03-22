import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Network, Search, X, Tag } from 'lucide-react'
import { useVaultStore } from '../../stores/vaultStore'
import { useUiStore } from '../../stores/uiStore'
import type { NoteIndex } from '../../types/note'

// ─── Types ───────────────────────────────────────────────────────────────────

interface GraphNode {
  id: string        // note path
  label: string     // note name
  x: number
  y: number
  vx: number
  vy: number
  tags: string[]
  links: number     // degree (for sizing)
}

interface GraphEdge {
  source: string
  target: string
}

// ─── Wiki-link extractor ──────────────────────────────────────────────────────

function extractWikilinks(body: string): string[] {
  const matches = [...body.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)]
  return matches.map(m => m[1].trim())
}

// ─── Force simulation (runs in a ref, mutates node positions) ─────────────────

const REPULSION = 3500
const ATTRACTION = 0.06
const CENTERING = 0.012
const DAMPING = 0.82
const MIN_DIST = 40

function runTick(nodes: GraphNode[], edges: GraphEdge[], cx: number, cy: number) {
  // Build adjacency for fast lookup
  const adj = new Map<string, Set<string>>()
  nodes.forEach(n => adj.set(n.id, new Set()))
  edges.forEach(e => {
    adj.get(e.source)?.add(e.target)
    adj.get(e.target)?.add(e.source)
  })

  // Repulsion between all node pairs
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.max(MIN_DIST, Math.sqrt(dx * dx + dy * dy))
      const force = REPULSION / (dist * dist)
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force
      a.vx -= fx; a.vy -= fy
      b.vx += fx; b.vy += fy
    }
  }

  // Attraction along edges
  edges.forEach(e => {
    const src = nodes.find(n => n.id === e.source)
    const tgt = nodes.find(n => n.id === e.target)
    if (!src || !tgt) return
    const dx = tgt.x - src.x
    const dy = tgt.y - src.y
    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy))
    const ideal = 120
    const force = (dist - ideal) * ATTRACTION
    const fx = (dx / dist) * force
    const fy = (dy / dist) * force
    src.vx += fx; src.vy += fy
    tgt.vx -= fx; tgt.vy -= fy
  })

  // Centering pull
  nodes.forEach(n => {
    n.vx += (cx - n.x) * CENTERING
    n.vy += (cy - n.y) * CENTERING
  })

  // Apply velocity with damping
  nodes.forEach(n => {
    n.vx *= DAMPING
    n.vy *= DAMPING
    n.x += n.vx
    n.y += n.vy
  })
}

// ─── Tag color palette ────────────────────────────────────────────────────────

const TAG_COLORS = [
  '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#84cc16',
  '#f97316', '#a855f7',
]

function tagColor(tag: string, allTags: string[]): string {
  const idx = allTags.indexOf(tag)
  return idx >= 0 ? TAG_COLORS[idx % TAG_COLORS.length] : '#6b7280'
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function GraphView() {
  const { index } = useVaultStore()
  const { setActiveNote, setActiveView, darkMode } = useUiStore()

  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const animRef = useRef<number>(0)
  const nodesRef = useRef<GraphNode[]>([])
  const edgesRef = useRef<GraphEdge[]>([])

  const [dims, setDims] = useState({ w: 800, h: 600 })
  const [renderTick, setRenderTick] = useState(0)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filterTag, setFilterTag] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [dragging, setDragging] = useState<{ id: string; ox: number; oy: number } | null>(null)
  const [panning, setPanning] = useState<{ sx: number; sy: number; px: number; py: number } | null>(null)
  const simRunning = useRef(true)

  // Measure container
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      setDims({ w: Math.max(400, width), h: Math.max(300, height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // All unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const n of index.values()) {
      ;(n.frontmatter.tags as string[] | undefined)?.forEach(t => set.add(t))
    }
    return [...set].sort()
  }, [index])

  // Build nodes + edges whenever index changes
  useEffect(() => {
    const notes = [...index.values()]
    const cx = dims.w / 2, cy = dims.h / 2

    // Re-use existing positions if node already exists
    const existing = new Map(nodesRef.current.map(n => [n.id, { x: n.x, y: n.y }]))

    // Build name->path lookup for wiki-link resolution
    const nameToPath = new Map<string, string>()
    notes.forEach(n => nameToPath.set(n.name.toLowerCase(), n.path))

    const edges: GraphEdge[] = []
    const linkCount = new Map<string, number>()

    notes.forEach(n => {
      // We need full body — use the excerpt as best-effort; wikilinks are usually in body
      // The index stores an excerpt; for full link extraction we'd need to read each file.
      // Use frontmatter tags as implicit links between same-tagged notes instead.
    })

    // Build edges: notes sharing a tag get connected; also parse wikilinks from excerpt
    const tagBuckets = new Map<string, string[]>()
    notes.forEach(n => {
      ;(n.frontmatter.tags as string[] | undefined)?.forEach(tag => {
        if (!tagBuckets.has(tag)) tagBuckets.set(tag, [])
        tagBuckets.get(tag)!.push(n.path)
      })
    })

    // Wikilink edges from excerpt (best effort)
    notes.forEach(n => {
      extractWikilinks(n.excerpt).forEach(name => {
        const target = nameToPath.get(name.toLowerCase())
        if (target && target !== n.path) {
          edges.push({ source: n.path, target })
          linkCount.set(n.path, (linkCount.get(n.path) ?? 0) + 1)
          linkCount.set(target, (linkCount.get(target) ?? 0) + 1)
        }
      })
    })

    // De-duplicate edges
    const edgeSet = new Set<string>()
    const dedupedEdges = edges.filter(e => {
      const key = [e.source, e.target].sort().join('||')
      if (edgeSet.has(key)) return false
      edgeSet.add(key)
      return true
    })

    const nodes: GraphNode[] = notes.map(n => {
      const pos = existing.get(n.path)
      const angle = Math.random() * Math.PI * 2
      const r = 80 + Math.random() * Math.min(cx, cy) * 0.8
      return {
        id: n.path,
        label: n.name,
        x: pos?.x ?? cx + Math.cos(angle) * r,
        y: pos?.y ?? cy + Math.sin(angle) * r,
        vx: 0, vy: 0,
        tags: (n.frontmatter.tags as string[] | undefined) ?? [],
        links: linkCount.get(n.path) ?? 0,
      }
    })

    nodesRef.current = nodes
    edgesRef.current = dedupedEdges
    simRunning.current = true
  }, [index, dims])

  // Animation loop
  useEffect(() => {
    let ticks = 0
    const loop = () => {
      if (simRunning.current) {
        for (let i = 0; i < 3; i++) {
          runTick(nodesRef.current, edgesRef.current, dims.w / 2, dims.h / 2)
        }
        ticks++
        if (ticks > 200) simRunning.current = false
      }
      setRenderTick(t => t + 1)
      animRef.current = requestAnimationFrame(loop)
    }
    animRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animRef.current)
  }, [dims])

  // Filtered nodes
  const visibleNodeIds = useMemo(() => {
    const q = searchQuery.toLowerCase()
    return new Set(
      nodesRef.current
        .filter(n => {
          if (filterTag && !n.tags.includes(filterTag)) return false
          if (q && !n.label.toLowerCase().includes(q)) return false
          return true
        })
        .map(n => n.id)
    )
  }, [filterTag, searchQuery, renderTick])

  const colors = useMemo(() => ({
    bg: darkMode ? '#141414' : '#f8f8f8',
    edge: darkMode ? '#2d2d2d' : '#d1d5db',
    edgeHighlight: darkMode ? '#6d28d9' : '#8b5cf6',
    nodeBorder: darkMode ? '#374151' : '#e5e7eb',
    label: darkMode ? '#e5e7eb' : '#1f2937',
    labelSub: darkMode ? '#6b7280' : '#9ca3af',
    selectedRing: '#f59e0b',
  }), [darkMode])

  const handleNodeClick = useCallback((id: string) => {
    setSelectedId(id)
    setActiveNote(id)
    setActiveView('notes')
  }, [setActiveNote, setActiveView])

  // Mouse drag for nodes
  const onNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    simRunning.current = true
    setDragging({ id, ox: e.clientX, oy: e.clientY })
    setSelectedId(id)
  }

  const onSvgMouseDown = (e: React.MouseEvent) => {
    if ((e.target as Element).closest('.graph-node')) return
    setPanning({ sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y })
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      const node = nodesRef.current.find(n => n.id === dragging.id)
      if (node) {
        node.x = (e.clientX - pan.x) / zoom - (dims.w / 2 / zoom) + dims.w / 2
        node.y = (e.clientY - pan.y) / zoom - (dims.h / 2 / zoom) + dims.h / 2
        // Recalc properly using inverse transform
        const svg = svgRef.current
        if (svg) {
          const rect = svg.getBoundingClientRect()
          const svgX = (e.clientX - rect.left - pan.x) / zoom
          const svgY = (e.clientY - rect.top - pan.y) / zoom
          node.x = svgX
          node.y = svgY
        }
        node.vx = 0; node.vy = 0
      }
    }
    if (panning) {
      setPan({ x: panning.px + (e.clientX - panning.sx), y: panning.py + (e.clientY - panning.sy) })
    }
  }

  const onMouseUp = () => { setDragging(null); setPanning(null) }

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(z => Math.max(0.2, Math.min(4, z * delta)))
  }

  const selectedNote = selectedId ? index.get(selectedId) : null

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-surface-900">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 flex-wrap gap-y-2">
        <Network size={20} className="text-accent-500 flex-shrink-0" />
        <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Graph View</h1>

        {/* Search */}
        <div className="relative ml-2">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search nodes…"
            className="pl-7 pr-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-accent-500 w-44"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={12} />
            </button>
          )}
        </div>

        {/* Tag filter */}
        <div className="flex items-center gap-1.5">
          <Tag size={13} className="text-gray-400" />
          <select
            value={filterTag}
            onChange={e => setFilterTag(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300"
          >
            <option value="">All tags</option>
            {allTags.map(t => <option key={t} value={t}>#{t}</option>)}
          </select>
          {filterTag && (
            <button onClick={() => setFilterTag('')} className="text-gray-400 hover:text-gray-600">
              <X size={12} />
            </button>
          )}
        </div>

        <span className="text-xs text-gray-400 ml-1">{visibleNodeIds.size} notes</span>

        {/* Zoom controls */}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setZoom(z => Math.min(4, z * 1.2))}
            className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300">+</button>
          <span className="text-xs text-gray-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.max(0.2, z * 0.8))}
            className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300">−</button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
            className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500">Reset</button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Graph canvas */}
        <div
          ref={containerRef}
          className="flex-1 overflow-hidden relative"
          style={{ background: colors.bg, cursor: panning ? 'grabbing' : 'grab' }}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          <svg
            ref={svgRef}
            width={dims.w}
            height={dims.h}
            onMouseDown={onSvgMouseDown}
            onWheel={onWheel}
            style={{ display: 'block', userSelect: 'none' }}
          >
            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {/* Edges */}
              {edgesRef.current.map((e, i) => {
                const src = nodesRef.current.find(n => n.id === e.source)
                const tgt = nodesRef.current.find(n => n.id === e.target)
                if (!src || !tgt) return null
                const srcVisible = visibleNodeIds.has(src.id)
                const tgtVisible = visibleNodeIds.has(tgt.id)
                if (!srcVisible && !tgtVisible) return null
                const isHighlighted = hoveredId === src.id || hoveredId === tgt.id ||
                  selectedId === src.id || selectedId === tgt.id
                return (
                  <line
                    key={i}
                    x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                    stroke={isHighlighted ? colors.edgeHighlight : colors.edge}
                    strokeWidth={isHighlighted ? 1.5 : 0.8}
                    strokeOpacity={srcVisible && tgtVisible ? 1 : 0.2}
                  />
                )
              })}

              {/* Nodes */}
              {nodesRef.current.map(node => {
                const visible = visibleNodeIds.has(node.id)
                const isHovered = hoveredId === node.id
                const isSelected = selectedId === node.id
                const r = Math.max(7, Math.min(18, 8 + node.links * 2))
                // Color: first tag color, or default
                const nodeColor = node.tags.length > 0
                  ? tagColor(node.tags[0], allTags)
                  : (darkMode ? '#4b5563' : '#9ca3af')

                return (
                  <g
                    key={node.id}
                    className="graph-node"
                    transform={`translate(${node.x},${node.y})`}
                    style={{ cursor: 'pointer', opacity: visible ? 1 : 0.15 }}
                    onMouseEnter={() => setHoveredId(node.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onMouseDown={e => onNodeMouseDown(e, node.id)}
                    onClick={() => handleNodeClick(node.id)}
                  >
                    {/* Selection ring */}
                    {isSelected && (
                      <circle r={r + 5} fill="none" stroke={colors.selectedRing} strokeWidth={2} />
                    )}
                    {/* Hover glow */}
                    {isHovered && (
                      <circle r={r + 4} fill={nodeColor} fillOpacity={0.2} />
                    )}
                    {/* Node body */}
                    <circle r={r} fill={nodeColor} stroke={isSelected ? colors.selectedRing : colors.nodeBorder} strokeWidth={isSelected ? 2 : 1} />

                    {/* Label */}
                    {(isHovered || isSelected || zoom > 1.2 || node.links > 1) && (
                      <text
                        y={r + 12}
                        textAnchor="middle"
                        fontSize={11 / zoom}
                        fill={colors.label}
                        style={{ pointerEvents: 'none', userSelect: 'none' }}
                        paintOrder="stroke"
                        stroke={colors.bg}
                        strokeWidth={3 / zoom}
                      >
                        {node.label.length > 22 ? node.label.slice(0, 21) + '…' : node.label}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          </svg>

          {/* Tag color legend */}
          {allTags.length > 0 && (
            <div className="absolute bottom-3 left-3 bg-white/90 dark:bg-surface-800/90 rounded-lg border border-gray-200 dark:border-gray-700 p-2 text-xs max-w-48">
              <p className="font-medium text-gray-600 dark:text-gray-400 mb-1.5">Tags</p>
              <div className="space-y-1 max-h-40 overflow-y-auto scrollbar-thin">
                {allTags.slice(0, 12).map(t => (
                  <button
                    key={t}
                    onClick={() => setFilterTag(filterTag === t ? '' : t)}
                    className={`flex items-center gap-1.5 w-full rounded px-1 py-0.5 transition-colors ${filterTag === t ? 'bg-gray-100 dark:bg-gray-700' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                  >
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: tagColor(t, allTags) }} />
                    <span className="text-gray-600 dark:text-gray-400 truncate">#{t}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Hint */}
          <div className="absolute bottom-3 right-3 text-xs text-gray-400 text-right pointer-events-none">
            Drag nodes · Scroll to zoom · Click to open
          </div>
        </div>

        {/* Note detail panel */}
        {selectedNote && (
          <div className="w-64 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-surface-800 overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{selectedNote.name}</span>
              <button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-2">
                <X size={14} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              {selectedNote.frontmatter.date && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Date</p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{String(selectedNote.frontmatter.date)}</p>
                </div>
              )}
              {(selectedNote.frontmatter.tags as string[] | undefined)?.length ? (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {(selectedNote.frontmatter.tags as string[]).map(t => (
                      <span key={t} className="px-1.5 py-0.5 rounded text-xs font-medium"
                        style={{ background: tagColor(t, allTags) + '22', color: tagColor(t, allTags) }}>
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
              {selectedNote.excerpt && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Excerpt</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-6 leading-relaxed">{selectedNote.excerpt}</p>
                </div>
              )}
              {/* Connected notes */}
              {(() => {
                const connected = edgesRef.current
                  .filter(e => e.source === selectedId || e.target === selectedId)
                  .map(e => e.source === selectedId ? e.target : e.source)
                  .map(id => index.get(id))
                  .filter(Boolean) as NoteIndex[]
                if (connected.length === 0) return null
                return (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Linked notes ({connected.length})</p>
                    <div className="space-y-1">
                      {connected.slice(0, 8).map(n => (
                        <button key={n.path}
                          onClick={() => { setSelectedId(n.path); setActiveNote(n.path); setActiveView('notes') }}
                          className="w-full text-left text-xs text-accent-500 hover:underline truncate block">
                          {n.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })()}
              <button
                onClick={() => { setActiveNote(selectedId!); setActiveView('notes') }}
                className="w-full px-3 py-2 bg-accent-500 text-white rounded text-sm hover:bg-accent-600 mt-2"
              >
                Open Note
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
