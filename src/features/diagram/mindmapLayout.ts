import type { DiagramNode, DiagramEdge } from './DiagramEditor'
import type { MindmapTheme } from './mindmapThemes'

// Layout constants
const LEVEL_W = 200  // horizontal pixels per depth level
const V_GAP = 24     // vertical padding between sibling subtrees
const ROOT_NODE_W = 160
const ROOT_NODE_H = 50
const CHILD_NODE_W = 140
const CHILD_NODE_H = 40

/**
 * Computes mindmap layout using a recursive top-down algorithm.
 * Positions nodes in a tree hierarchy with left/right branches from root.
 */
export function computeMindmapLayout(
  nodes: DiagramNode[],
  edges: DiagramEdge[]
): DiagramNode[] {
  if (nodes.length === 0) return nodes

  // Find root node
  const root = nodes.find(n => n.isRoot) ?? nodes[0]

  // Build adjacency map: nodeId -> array of child node IDs
  const childrenOf = new Map<string, string[]>()
  nodes.forEach(n => childrenOf.set(n.id, []))
  edges.forEach(e => {
    const arr = childrenOf.get(e.fromId)
    if (arr) arr.push(e.toId)
  })

  // Compute subtree height recursively
  // Returns the total vertical space (px) this subtree and all descendants need
  function subtreeH(id: string): number {
    const ch = childrenOf.get(id) ?? []
    const node = nodes.find(n => n.id === id)
    if (!node) return CHILD_NODE_H + V_GAP
    if (ch.length === 0) return (node.h ?? CHILD_NODE_H) + V_GAP
    return Math.max(
      (node.h ?? CHILD_NODE_H) + V_GAP,
      ch.reduce((sum, cid) => sum + subtreeH(cid), 0)
    )
  }

  // Position nodes recursively
  // side: +1 = right branch, -1 = left branch
  // depth: nesting level from root
  const positions = new Map<string, { x: number; y: number }>()

  function place(id: string, cx: number, cy: number, side: number, depth: number) {
    positions.set(id, { x: cx, y: cy })
    const ch = childrenOf.get(id) ?? []
    if (ch.length === 0) return

    // Calculate total height needed for all children
    const totalH = ch.reduce((sum, cid) => sum + subtreeH(cid), 0)
    let curY = cy - totalH / 2

    // X position for children
    const childX = cx + side * LEVEL_W

    // Place each child
    for (const cid of ch) {
      const chH = subtreeH(cid)
      const childCenterY = curY + chH / 2
      place(cid, childX, childCenterY, side, depth + 1)
      curY += chH
    }
  }

  // Split root's children: first ceil(n/2) go right, rest go left
  const rootChildren = childrenOf.get(root.id) ?? []
  const splitIdx = Math.ceil(rootChildren.length / 2)
  const rightGroup = rootChildren.slice(0, splitIdx)
  const leftGroup = rootChildren.slice(splitIdx)

  // Place root at center (0, 0)
  positions.set(root.id, { x: 0, y: 0 })

  // Place right subtrees
  const rightTotalH = rightGroup.reduce((s, id) => s + subtreeH(id), 0)
  let ry = 0 - rightTotalH / 2
  for (const cid of rightGroup) {
    const h = subtreeH(cid)
    place(cid, 0 + LEVEL_W, ry + h / 2, +1, 1)
    ry += h
  }

  // Place left subtrees
  const leftTotalH = leftGroup.reduce((s, id) => s + subtreeH(id), 0)
  let ly = 0 - leftTotalH / 2
  for (const cid of leftGroup) {
    const h = subtreeH(cid)
    place(cid, 0 - LEVEL_W, ly + h / 2, -1, 1)
    ly += h
  }

  // Apply positions to nodes (convert from center coords to top-left SVG coords)
  return nodes.map(n => {
    const pos = positions.get(n.id)
    if (!pos) return n
    const nw = n.isRoot ? ROOT_NODE_W : CHILD_NODE_W
    const nh = n.isRoot ? ROOT_NODE_H : CHILD_NODE_H
    return { ...n, x: pos.x - nw / 2, y: pos.y - nh / 2, w: nw, h: nh }
  })
}

/**
 * Get the depth level of a node (0 = root, 1 = direct children, etc.)
 */
export function getMindmapDepth(nodeId: string, nodes: DiagramNode[], edges: DiagramEdge[]): number {
  if (nodes.find(n => n.id === nodeId)?.isRoot) return 0

  // Find parent
  const parentEdge = edges.find(e => e.toId === nodeId)
  if (!parentEdge) return 0

  return 1 + getMindmapDepth(parentEdge.fromId, nodes, edges)
}

/**
 * Find the root node's direct child that this node descends from (for branch coloring).
 * Returns the index of that level-1 ancestor in the root's children array.
 */
export function getLevel1AncestorIndex(nodeId: string, nodes: DiagramNode[], edges: DiagramEdge[]): number {
  const root = nodes.find(n => n.isRoot) ?? nodes[0]
  let current = nodeId

  // Trace up to find the level-1 ancestor
  while (true) {
    const parentEdge = edges.find(e => e.toId === current)
    if (!parentEdge) break
    if (parentEdge.fromId === root.id) {
      // Found the level-1 ancestor
      const rootChildren = edges
        .filter(e => e.fromId === root.id)
        .map(e => e.toId)
      return Math.max(0, rootChildren.indexOf(current))
    }
    current = parentEdge.fromId
  }

  return 0
}

/**
 * Get the branch stroke color for an edge based on the theme and the level-1 ancestor.
 */
export function getMindmapBranchColor(
  edge: DiagramEdge,
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  theme: MindmapTheme
): string {
  const idx = getLevel1AncestorIndex(edge.toId, nodes, edges)
  return theme.branchColors[idx % theme.branchColors.length]
}

/**
 * Get the fill color for a node based on its depth and the theme.
 */
export function getMindmapNodeColor(
  node: DiagramNode,
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  theme: MindmapTheme
): string {
  if (node.isRoot) return theme.rootFill

  const depth = getMindmapDepth(node.id, nodes, edges)
  if (depth === 1) {
    // Level-1 child: use the branch color for this child
    const idx = getLevel1AncestorIndex(node.id, nodes, edges)
    return theme.level1Colors[idx % theme.level1Colors.length]
  }

  // Depth 2+: use level2Fill
  return theme.level2Fill
}
