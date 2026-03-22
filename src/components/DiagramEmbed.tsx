import React, { useMemo } from 'react'
import { useUiStore } from '../stores/uiStore'
import type { Diagram } from '../features/diagram/DiagramEditor'
import { nodeShapePath } from '../features/diagram/diagramUtils'

const STORAGE_KEY = 'diagramEditor_diagrams'

function loadDiagrams(): Diagram[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Diagram[]
  } catch {}
  return []
}

function getBorderPoint(n: { x: number; y: number; w: number; h: number; shape: string }, tx: number, ty: number): [number, number] {
  const cx = n.x + n.w / 2, cy = n.y + n.h / 2
  const dx = tx - cx, dy = ty - cy
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

interface Props {
  diagramId: string
}

export default function DiagramEmbed({ diagramId }: Props) {
  const { darkMode } = useUiStore()

  const diagram = useMemo(() => {
    const all = loadDiagrams()
    return all.find(d => d.id === diagramId) ?? null
  }, [diagramId])

  if (!diagram) {
    return (
      <div className="my-3 px-4 py-3 rounded border border-dashed border-gray-300 dark:border-gray-600 text-xs text-gray-400 text-center">
        Diagram not found: <code>{diagramId}</code>
      </div>
    )
  }

  if (diagram.nodes.length === 0) {
    return (
      <div className="my-3 px-4 py-3 rounded border border-dashed border-gray-300 dark:border-gray-600 text-xs text-gray-400 text-center">
        {diagram.name} (empty)
      </div>
    )
  }

  const xs = diagram.nodes.map(n => n.x)
  const ys = diagram.nodes.map(n => n.y)
  const x2 = diagram.nodes.map(n => n.x + n.w)
  const y2 = diagram.nodes.map(n => n.y + n.h)
  const minX = Math.min(...xs) - 16, minY = Math.min(...ys) - 16
  const maxX = Math.max(...x2) + 16, maxY = Math.max(...y2) + 16
  const vw = maxX - minX, vh = maxY - minY

  const edgeColor = darkMode ? '#6b7280' : '#9ca3af'
  const nodeStroke = darkMode ? '#3d3d3d' : '#d1d5db'
  const bg = darkMode ? '#111' : '#fff'

  return (
    <div className="my-4 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 dark:bg-surface-800 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{diagram.name}</span>
        <span className="text-xs text-gray-400">{diagram.nodes.length} nodes</span>
      </div>
      <svg
        viewBox={`${minX} ${minY} ${vw} ${vh}`}
        width="100%"
        style={{ maxHeight: 400, background: bg, display: 'block' }}
      >
        <defs>
          <marker id={`embed-arrow-${diagramId}`} markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L7,3 Z" fill={edgeColor} />
          </marker>
          <marker id={`embed-arrow-start-${diagramId}`} markerWidth="7" markerHeight="7" refX="2" refY="3" orient="auto-start-reverse">
            <path d="M0,0 L0,6 L7,3 Z" fill={edgeColor} />
          </marker>
        </defs>

        {/* Edges */}
        {diagram.edges.map(edge => {
          const from = diagram.nodes.find(n => n.id === edge.fromId)
          const to = diagram.nodes.find(n => n.id === edge.toId)
          if (!from || !to) return null
          const [bfx, bfy] = getBorderPoint(from, to.x + to.w / 2, to.y + to.h / 2)
          const [btx, bty] = getBorderPoint(to, from.x + from.w / 2, from.y + from.h / 2)
          const dx = btx - bfx
          const d = `M ${bfx} ${bfy} C ${bfx + dx * 0.5} ${bfy} ${btx - dx * 0.5} ${bty} ${btx} ${bty}`
          return (
            <g key={edge.id}>
              <path d={d} fill="none" stroke={edgeColor} strokeWidth={1.5}
                strokeDasharray={edge.style === 'dashed' ? '6 4' : edge.style === 'dotted' ? '2 4' : undefined}
                markerEnd={edge.arrow !== 'none' ? `url(#embed-arrow-${diagramId})` : undefined}
                markerStart={edge.arrow === 'both' ? `url(#embed-arrow-start-${diagramId})` : undefined}
              />
              {edge.label && (
                <text x={(bfx + btx) / 2} y={(bfy + bty) / 2 - 6}
                  textAnchor="middle" fontSize={10} fill={edgeColor} style={{ userSelect: 'none' }}>
                  {edge.label}
                </text>
              )}
            </g>
          )
        })}

        {/* Nodes */}
        {diagram.nodes.map(node => (
          <g key={node.id}>
            <path d={nodeShapePath(node)} fill={node.color} stroke={nodeStroke} strokeWidth={1.5} />
            <text
              x={node.x + node.w / 2} y={node.y + node.h / 2}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={11} fontWeight="500" fill={node.textColor}
              style={{ userSelect: 'none' }}
            >
              {node.label.length > 18 ? node.label.slice(0, 17) + '…' : node.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
