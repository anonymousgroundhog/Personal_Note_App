// Mindmap themes inspired by XMind

export interface MindmapTheme {
  key: string
  name: string
  bgColor: string
  rootFill: string
  rootText: string
  level1Colors: string[]  // 6 colors for root's direct children
  level2Fill: string      // all deeper nodes
  level2Text: string
  branchColors: string[]  // 6 stroke colors, matches level1Colors
}

export const MINDMAP_THEMES: MindmapTheme[] = [
  {
    key: 'Rainbow',
    name: 'Rainbow',
    bgColor: '#fafafa',
    rootFill: '#312e81',
    rootText: '#ffffff',
    level1Colors: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'],
    level2Fill: '#f3f4f6',
    level2Text: '#1f2937',
    branchColors: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'],
  },
  {
    key: 'Minimal',
    name: 'Minimal',
    bgColor: '#ffffff',
    rootFill: '#111827',
    rootText: '#ffffff',
    level1Colors: ['#6b7280', '#9ca3af', '#d1d5db', '#6b7280', '#9ca3af', '#d1d5db'],
    level2Fill: '#f9fafb',
    level2Text: '#374151',
    branchColors: ['#9ca3af', '#9ca3af', '#9ca3af', '#9ca3af', '#9ca3af', '#9ca3af'],
  },
  {
    key: 'DarkGold',
    name: 'Dark Gold',
    bgColor: '#18181b',
    rootFill: '#d97706',
    rootText: '#ffffff',
    level1Colors: ['#fbbf24', '#d97706', '#92400e', '#f59e0b', '#b45309', '#78350f'],
    level2Fill: '#27272a',
    level2Text: '#e4e4e7',
    branchColors: ['#fbbf24', '#d97706', '#92400e', '#f59e0b', '#b45309', '#78350f'],
  },
  {
    key: 'Coral',
    name: 'Coral',
    bgColor: '#fff7f5',
    rootFill: '#e11d48',
    rootText: '#ffffff',
    level1Colors: ['#fb7185', '#f43f5e', '#e11d48', '#fda4af', '#fecdd3', '#ff6b8a'],
    level2Fill: '#fff1f2',
    level2Text: '#881337',
    branchColors: ['#fb7185', '#f43f5e', '#e11d48', '#fda4af', '#fecdd3', '#ff6b8a'],
  },
  {
    key: 'Forest',
    name: 'Forest',
    bgColor: '#f0fdf4',
    rootFill: '#166534',
    rootText: '#ffffff',
    level1Colors: ['#16a34a', '#22c55e', '#4ade80', '#15803d', '#86efac', '#bbf7d0'],
    level2Fill: '#dcfce7',
    level2Text: '#14532d',
    branchColors: ['#16a34a', '#22c55e', '#4ade80', '#15803d', '#86efac', '#bbf7d0'],
  },
  {
    key: 'Ocean',
    name: 'Ocean',
    bgColor: '#eff6ff',
    rootFill: '#1e3a8a',
    rootText: '#ffffff',
    level1Colors: ['#3b82f6', '#2563eb', '#1d4ed8', '#60a5fa', '#93c5fd', '#bfdbfe'],
    level2Fill: '#dbeafe',
    level2Text: '#1e3a8a',
    branchColors: ['#3b82f6', '#2563eb', '#1d4ed8', '#60a5fa', '#93c5fd', '#bfdbfe'],
  },
]

export function getActiveTheme(key?: string): MindmapTheme {
  return MINDMAP_THEMES.find(t => t.key === key) ?? MINDMAP_THEMES[0]
}
