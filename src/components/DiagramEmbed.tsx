import React, { useMemo } from 'react'
import { useUiStore } from '../stores/uiStore'
import type { Diagram, NodeShape } from '../features/diagram/DiagramEditor'
import { nodeShapePath } from '../features/diagram/diagramUtils'

const STORAGE_KEY = 'diagramEditor_diagrams'
const NETWORK_SHAPES = new Set<NodeShape>(['server','cloud','router','firewall','laptop','phone'])

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

function loadDiagrams(): Diagram[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Diagram[]
  } catch {}
  return []
}

function getBorderPoint(
  n: { x: number; y: number; w: number; h: number; shape: string },
  tx: number, ty: number
): [number, number] {
  const cx = n.x + n.w / 2, cy = n.y + n.h / 2
  const dx = tx - cx, dy = ty - cy
  if (dx === 0 && dy === 0) return [cx, cy]
  if (NETWORK_SHAPES.has(n.shape as NodeShape)) {
    const r = 28, len = Math.hypot(dx, dy)
    return [cx + (dx / len) * r, cy + (dy / len) * r]
  }
  if (n.shape === 'circle') {
    const r = Math.min(n.w, n.h) / 2, len = Math.hypot(dx, dy)
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
  return [cx + dx * Math.min(tx1, ty1), cy + dy * Math.min(tx1, ty1)]
}

interface Props { diagramId: string }

export default function DiagramEmbed({ diagramId }: Props) {
  const { darkMode } = useUiStore()

  const diagram = useMemo(() => {
    return loadDiagrams().find(d => d.id === diagramId) ?? null
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

  const xs = diagram.nodes.map(n => n.x), ys = diagram.nodes.map(n => n.y)
  const x2 = diagram.nodes.map(n => n.x + n.w), y2 = diagram.nodes.map(n => n.y + n.h)
  const minX = Math.min(...xs) - 20, minY = Math.min(...ys) - 20
  const vw = Math.max(...x2) + 20 - minX, vh = Math.max(...y2) + 20 - minY

  const edgeColor = darkMode ? '#6b7280' : '#9ca3af'
  const nodeStroke = darkMode ? '#3d3d3d' : '#d1d5db'
  const bg = diagram.transparentBg ? 'transparent' : (darkMode ? '#111' : '#fff')

  return (
    <div className="my-4 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 dark:bg-surface-800 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">{diagram.name}</span>
        <span className="text-xs text-gray-400">{diagram.nodes.length} nodes · {diagram.edges.length} edges</span>
      </div>
      <svg
        viewBox={`${minX} ${minY} ${vw} ${vh}`}
        width="100%"
        style={{ maxHeight: 400, background: bg, display: 'block' }}
      >
        <defs>
          <marker id={`ea-${diagramId}`} markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L7,3 Z" fill={edgeColor} />
          </marker>
          <marker id={`es-${diagramId}`} markerWidth="7" markerHeight="7" refX="2" refY="3" orient="auto-start-reverse">
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
              <path d={d} fill="none" stroke={edgeColor}
                strokeWidth={edge.strokeWidth ?? 1.5}
                strokeDasharray={edge.style === 'dashed' ? '6 4' : edge.style === 'dotted' ? '2 4' : undefined}
                markerEnd={edge.arrow !== 'none' ? `url(#ea-${diagramId})` : undefined}
                markerStart={edge.arrow === 'both' ? `url(#es-${diagramId})` : undefined}
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
        {diagram.nodes.map(node => {
          const cx = node.x + node.w / 2, cy = node.y + node.h / 2
          const icon = networkIcon(node.shape)
          const isNetwork = NETWORK_SHAPES.has(node.shape)
          const shapePath = nodeShapePath(node)
          return (
            <g key={node.id}>
              {isNetwork ? (
                <>
                  <text x={cx} y={cy - 4}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={34} style={{ userSelect: 'none' }}>{icon}</text>
                  <text x={cx} y={node.y + node.h - 6}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={11} fontWeight="500" fill={node.textColor}
                    style={{ userSelect: 'none' }}>
                    {node.label.length > 18 ? node.label.slice(0, 17) + '…' : node.label}
                  </text>
                </>
              ) : shapePath ? (
                <>
                  <path d={shapePath} fill={node.color}
                    stroke={nodeStroke} strokeWidth={node.strokeWidth ?? 1.5} />
                  <text x={cx} y={cy}
                    textAnchor="middle" dominantBaseline="middle"
                    fontSize={11} fontWeight="500" fill={node.textColor}
                    style={{ userSelect: 'none' }}>
                    {node.label.length > 18 ? node.label.slice(0, 17) + '…' : node.label}
                  </text>
                </>
              ) : null}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
