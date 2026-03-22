import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { Network, Search, X, Tag } from 'lucide-react'
import { useVaultStore } from '../../stores/vaultStore'
import { useUiStore } from '../../stores/uiStore'
import type { NoteIndex } from '../../types/note'

// ─── Types ───────────────────────────────────────────────────────────────────

interface GraphNode {
  id: string
  label: string
  x: number
  y: number
  vx: number
  vy: number
  tags: string[]
  links: number
}

interface GraphEdge {
  source: string
  target: string
}

// ─── Wikilink extractor (runs on full body) ───────────────────────────────────

function extractWikilinks(body: string): string[] {
  const matches = [...body.matchAll(/\[\[([^\]|#]+)(?:[|#][^\]]+)?\]\]/g)]
  return matches.map(m => m[1].trim())
}

// ─── Force simulation ─────────────────────────────────────────────────────────

const REPULSION = 4000
const ATTRACTION = 0.05
const CENTERING = 0.01
const DAMPING = 0.80
const MIN_DIST = 45

function runTick(nodes: GraphNode[], edges: GraphEdge[], cx: number, cy: number) {
  // Repulsion between all pairs
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
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  edges.forEach(e => {
    const src = nodeMap.get(e.source)
    const tgt = nodeMap.get(e.target)
    if (!src || !tgt) return
    const dx = tgt.x - src.x
    const dy = tgt.y - src.y
    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy))
    const ideal = 130
    const force = (dist - ideal) * ATTRACTION
    const fx = (dx / dist) * force
    const fy = (dy / dist) * force
    src.vx += fx; src.vy += fy
    tgt.vx -= fx; tgt.vy -= fy
  })

  // Centering
  nodes.forEach(n => {
    n.vx += (cx - n.x) * CENTERING
    n.vy += (cy - n.y) * CENTERING
    n.vx *= DAMPING
    n.vy *= DAMPING
    n.x += n.vx
    n.y += n.vy
  })
}

// ─── Tag colors ───────────────────────────────────────────────────────────────

const TAG_PALETTE = [
  '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#06b6d4', '#84cc16',
  '#f97316', '#a855f7', '#14b8a6', '#eab308',
]

function tagColor(tag: string, allTags: string[]): string {
  const idx = allTags.indexOf(tag)
  return idx >= 0 ? TAG_PALETTE[idx % TAG_PALETTE.length] : '#6b7280'
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
  const simRunning = useRef(true)

  const [dims, setDims] = useState({ w: 800, h: 600 })
  const [renderTick, setRenderTick] = useState(0)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filterTag, setFilterTag] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [dragging, setDragging] = useState<string | null>(null)
  const [panning, setPanning] = useState<{ sx: number; sy: number; px: number; py: number } | null>(null)

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

  // All unique tags (from full index — never filtered)
  const allTags = useMemo(() => {
    const set = new Set<string>()
    for (const n of index.values()) {
      ;(n.frontmatter.tags as string[] | undefined)?.forEach(t => set.add(t))
    }
    return [...set].sort()
  }, [index])

  // Build nodes + edges from full note bodies
  useEffect(() => {
    const notes = [...index.values()]
    const cx = dims.w / 2, cy = dims.h / 2
    const existing = new Map(nodesRef.current.map(n => [n.id, { x: n.x, y: n.y }]))

    // name (lowercase, no .md) → path
    const nameToPath = new Map<string, string>()
    notes.forEach(n => nameToPath.set(n.name.toLowerCase(), n.path))

    const edgeSet = new Set<string>()
    const edges: GraphEdge[] = []
    const linkCount = new Map<string, number>()

    notes.forEach(n => {
      // Use full body (not excerpt) for accurate wikilink extraction
      const links = extractWikilinks(n.body)
      links.forEach(linkName => {
        const target = nameToPath.get(linkName.toLowerCase())
        if (!target || target === n.path) return
        const key = [n.path, target].sort().join('||')
        if (edgeSet.has(key)) return
        edgeSet.add(key)
        edges.push({ source: n.path, target })
        linkCount.set(n.path, (linkCount.get(n.path) ?? 0) + 1)
        linkCount.set(target, (linkCount.get(target) ?? 0) + 1)
      })
    })

    const nodes: GraphNode[] = notes.map(n => {
      const pos = existing.get(n.path)
      const angle = Math.random() * Math.PI * 2
      const r = 60 + Math.random() * Math.min(cx, cy) * 0.75
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
    edgesRef.current = edges
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
        if (ticks > 250) simRunning.current = false
      }
      setRenderTick(t => t + 1)
      animRef.current = requestAnimationFrame(loop)
    }
    animRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animRef.current)
  }, [dims])

  // Visible node IDs — nodes that DON'T pass are completely hidden (not rendered)
  const visibleNodeIds = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return new Set(
      nodesRef.current
        .filter(n => {
          if (filterTag && !n.tags.includes(filterTag)) return false
          if (q && !n.label.toLowerCase().includes(q)) return false
          return true
        })
        .map(n => n.id)
    )
  // renderTick keeps this reactive to simulation updates
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterTag, searchQuery, renderTick])

  // Only edges where BOTH endpoints are visible
  const visibleEdges = useMemo(
    () => edgesRef.current.filter(e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleNodeIds, renderTick]
  )

  const colors = useMemo(() => ({
    bg: darkMode ? '#141414' : '#f8f8f8',
    edge: darkMode ? '#374151' : '#d1d5db',
    edgeHighlight: '#8b5cf6',
    nodeBorder: darkMode ? '#4b5563' : '#e5e7eb',
    label: darkMode ? '#e5e7eb' : '#1f2937',
    selectedRing: '#f59e0b',
  }), [darkMode])

  const handleNodeClick = useCallback((id: string) => {
    setSelectedId(id)
    setActiveNote(id)
    setActiveView('notes')
  }, [setActiveNote, setActiveView])

  const onNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    simRunning.current = true
    setDragging(id)
    setSelectedId(id)
  }

  const onSvgMouseDown = (e: React.MouseEvent) => {
    if ((e.target as Element).closest('.gnode')) return
    setPanning({ sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y })
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      const svg = svgRef.current
      if (svg) {
        const rect = svg.getBoundingClientRect()
        const node = nodesRef.current.find(n => n.id === dragging)
        if (node) {
          node.x = (e.clientX - rect.left - pan.x) / zoom
          node.y = (e.clientY - rect.top - pan.y) / zoom
          node.vx = 0; node.vy = 0
        }
      }
    }
    if (panning) {
      setPan({ x: panning.px + (e.clientX - panning.sx), y: panning.py + (e.clientY - panning.sy) })
    }
  }

  const onMouseUp = () => { setDragging(null); setPanning(null) }

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    setZoom(z => Math.max(0.15, Math.min(5, z * (e.deltaY > 0 ? 0.9 : 1.11))))
  }

  const selectedNote = selectedId ? index.get(selectedId) : null

  const isFiltering = !!(filterTag || searchQuery.trim())

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-surface-900">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-200 dark:border-gray-700 flex-shrink-0 flex-wrap">
        <Network size={18} className="text-accent-500 flex-shrink-0" />
        <h1 className="text-base font-semibold text-gray-800 dark:text-gray-100">Graph View</h1>

        <div className="relative ml-1">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search notes…"
            className="pl-6 pr-6 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-accent-500 w-40"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={11} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Tag size={12} className="text-gray-400" />
          <select
            value={filterTag}
            onChange={e => setFilterTag(e.target.value)}
            className="text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-surface-700 text-gray-700 dark:text-gray-300"
          >
            <option value="">All tags</option>
            {/* Always show ALL tags regardless of current filter */}
            {allTags.map(t => (
              <option key={t} value={t}>#{t}</option>
            ))}
          </select>
          {filterTag && (
            <button onClick={() => setFilterTag('')} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X size={11} />
            </button>
          )}
        </div>

        {isFiltering && (
          <span className="text-xs text-accent-500 font-medium">
            {visibleNodeIds.size} / {nodesRef.current.length} notes
          </span>
        )}
        {!isFiltering && (
          <span className="text-xs text-gray-400">{nodesRef.current.length} notes · {edgesRef.current.length} links</span>
        )}

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setZoom(z => Math.min(5, z * 1.2))}
            className="px-2 py-0.5 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300">+</button>
          <span className="text-xs text-gray-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.max(0.15, z * 0.8))}
            className="px-2 py-0.5 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300">−</button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
            className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-500">Reset</button>
        </div>
      </div>

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

              {/* ── Edges: only between visible nodes ── */}
              {visibleEdges.map((e, i) => {
                const src = nodesRef.current.find(n => n.id === e.source)
                const tgt = nodesRef.current.find(n => n.id === e.target)
                if (!src || !tgt) return null
                const highlighted =
                  hoveredId === src.id || hoveredId === tgt.id ||
                  selectedId === src.id || selectedId === tgt.id
                return (
                  <line
                    key={i}
                    x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
                    stroke={highlighted ? colors.edgeHighlight : colors.edge}
                    strokeWidth={highlighted ? 2 : 1}
                    strokeOpacity={highlighted ? 0.9 : 0.5}
                  />
                )
              })}

              {/* ── Nodes: only visible ones rendered ── */}
              {nodesRef.current
                .filter(node => visibleNodeIds.has(node.id))
                .map(node => {
                  const isHovered = hoveredId === node.id
                  const isSelected = selectedId === node.id
                  const r = Math.max(7, Math.min(20, 8 + node.links * 2.5))
                  const nodeColor = node.tags.length > 0
                    ? tagColor(node.tags[0], allTags)
                    : (darkMode ? '#4b5563' : '#9ca3af')
                  const showLabel = isHovered || isSelected || zoom > 1.3 || node.links > 0

                  return (
                    <g
                      key={node.id}
                      className="gnode"
                      transform={`translate(${node.x},${node.y})`}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={() => setHoveredId(node.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onMouseDown={e => onNodeMouseDown(e, node.id)}
                      onClick={() => handleNodeClick(node.id)}
                    >
                      {isSelected && <circle r={r + 6} fill="none" stroke={colors.selectedRing} strokeWidth={2.5} />}
                      {isHovered && <circle r={r + 5} fill={nodeColor} fillOpacity={0.18} />}
                      <circle
                        r={r}
                        fill={nodeColor}
                        stroke={isSelected ? colors.selectedRing : isHovered ? nodeColor : colors.nodeBorder}
                        strokeWidth={isSelected ? 2 : 1}
                      />
                      {showLabel && (
                        <text
                          y={r + 13}
                          textAnchor="middle"
                          fontSize={Math.max(9, 11 / zoom)}
                          fill={colors.label}
                          paintOrder="stroke"
                          stroke={colors.bg}
                          strokeWidth={Math.max(2, 3 / zoom)}
                          style={{ pointerEvents: 'none', userSelect: 'none' }}
                        >
                          {node.label.length > 24 ? node.label.slice(0, 23) + '…' : node.label}
                        </text>
                      )}
                    </g>
                  )
                })}
            </g>
          </svg>

          {/* Tag legend — always shows all tags, click to filter */}
          {allTags.length > 0 && (
            <div className="absolute bottom-3 left-3 bg-white/92 dark:bg-surface-800/92 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-gray-700 p-2.5 text-xs max-w-52 shadow-sm">
              <div className="flex items-center justify-between mb-1.5">
                <p className="font-semibold text-gray-600 dark:text-gray-400">Filter by tag</p>
                {filterTag && (
                  <button onClick={() => setFilterTag('')} className="text-xs text-accent-500 hover:underline">clear</button>
                )}
              </div>
              <div className="space-y-0.5 max-h-44 overflow-y-auto scrollbar-thin">
                {allTags.map(t => {
                  const count = [...index.values()].filter(n =>
                    (n.frontmatter.tags as string[] | undefined)?.includes(t)
                  ).length
                  const active = filterTag === t
                  return (
                    <button
                      key={t}
                      onClick={() => setFilterTag(active ? '' : t)}
                      className={`flex items-center gap-1.5 w-full rounded px-1.5 py-0.5 transition-colors text-left ${
                        active
                          ? 'bg-accent-500/10 ring-1 ring-accent-500/30'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700/60'
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: tagColor(t, allTags) }} />
                      <span className={`truncate ${active ? 'text-accent-500 font-medium' : 'text-gray-600 dark:text-gray-400'}`}>
                        #{t}
                      </span>
                      <span className="ml-auto text-gray-400">{count}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Empty state when filter shows 0 nodes */}
          {isFiltering && visibleNodeIds.size === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-gray-400">
                <Network size={36} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No notes match this filter</p>
                <p className="text-xs mt-1">Try a different tag or clear the search</p>
              </div>
            </div>
          )}

          <div className="absolute bottom-3 right-3 text-xs text-gray-400 pointer-events-none text-right leading-relaxed">
            Drag nodes · Scroll to zoom<br />Click to open note
          </div>
        </div>

        {/* Note detail panel */}
        {selectedNote && (
          <div className="w-64 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-surface-800">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">{selectedNote.name}</span>
              <button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 ml-2 flex-shrink-0">
                <X size={14} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3">
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
                      <button
                        key={t}
                        onClick={() => setFilterTag(filterTag === t ? '' : t)}
                        className="px-1.5 py-0.5 rounded text-xs font-medium transition-opacity hover:opacity-80"
                        style={{ background: tagColor(t, allTags) + '28', color: tagColor(t, allTags) }}
                        title="Click to filter by this tag"
                      >
                        #{t}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              {selectedNote.excerpt && (
                <div>
                  <p className="text-xs text-gray-400 mb-1">Excerpt</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-5 leading-relaxed">{selectedNote.excerpt}</p>
                </div>
              )}
              {/* Linked notes */}
              {(() => {
                const connected = edgesRef.current
                  .filter(e => e.source === selectedId || e.target === selectedId)
                  .map(e => e.source === selectedId ? e.target : e.source)
                  .map(id => index.get(id))
                  .filter((n): n is NoteIndex => !!n)
                if (!connected.length) return null
                return (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Linked notes ({connected.length})</p>
                    <div className="space-y-0.5">
                      {connected.slice(0, 10).map(n => (
                        <button key={n.path}
                          onClick={() => { setSelectedId(n.path); setActiveNote(n.path); setActiveView('notes') }}
                          className="w-full text-left text-xs text-accent-500 hover:underline truncate block py-0.5">
                          {n.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })()}
            </div>
            <div className="p-3 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => { setActiveNote(selectedId!); setActiveView('notes') }}
                className="w-full px-3 py-2 bg-accent-500 text-white rounded text-sm hover:bg-accent-600"
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
