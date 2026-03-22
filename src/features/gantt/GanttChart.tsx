import React, { useMemo, useState } from 'react'
import type { GanttTask } from '../../types/gantt'
import { useUiStore } from '../../stores/uiStore'

interface Props {
  tasks: GanttTask[]
  viewMode?: 'Day' | 'Week' | 'Month' | 'Quarter Year'
  onEditTask?: (task: GanttTask) => void
  projectColors?: Map<string, string>
}

const ROW_H = 44
const LABEL_W = 200
const HEADER_H = 56
const BAR_H = 22
const BAR_Y_OFFSET = (ROW_H - BAR_H) / 2

function parseDate(s: string): Date {
  const d = new Date(s)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000)
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtDateShort(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

function getColumnDates(start: Date, end: Date, viewMode: string): Date[] {
  const cols: Date[] = []
  let cur = new Date(start)
  cur.setHours(0, 0, 0, 0)

  if (viewMode === 'Day') {
    while (cur <= end) {
      cols.push(new Date(cur))
      cur = addDays(cur, 1)
    }
  } else if (viewMode === 'Week') {
    // Start on Monday of the week containing `start`
    const day = cur.getDay()
    cur = addDays(cur, -(day === 0 ? 6 : day - 1))
    while (cur <= end) {
      cols.push(new Date(cur))
      cur = addDays(cur, 7)
    }
  } else if (viewMode === 'Month') {
    cur = new Date(cur.getFullYear(), cur.getMonth(), 1)
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1)
    while (cur <= endMonth) {
      cols.push(new Date(cur))
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
    }
  } else {
    // Quarter Year — one column per month
    cur = new Date(cur.getFullYear(), cur.getMonth(), 1)
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1)
    while (cur <= endMonth) {
      cols.push(new Date(cur))
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
    }
  }
  return cols
}

function colWidth(viewMode: string): number {
  if (viewMode === 'Day') return 36
  if (viewMode === 'Week') return 80
  if (viewMode === 'Month') return 100
  return 80
}

function dateToX(date: Date, chartStart: Date, viewMode: string, cw: number): number {
  if (viewMode === 'Day') {
    return diffDays(chartStart, date) * cw
  }
  if (viewMode === 'Week') {
    return (diffDays(chartStart, date) / 7) * cw
  }
  // Month / Quarter
  const months = (date.getFullYear() - chartStart.getFullYear()) * 12 + (date.getMonth() - chartStart.getMonth())
  const frac = date.getDate() / new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  return (months + frac) * cw
}

function colLabel(d: Date, viewMode: string): string {
  if (viewMode === 'Day') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (viewMode === 'Week') {
    const end = addDays(d, 6)
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  }
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export default function GanttChart({ tasks, viewMode = 'Week', onEditTask, projectColors }: Props) {
  const { darkMode } = useUiStore()
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const colors = useMemo(() => ({
    bg: darkMode ? '#141414' : '#ffffff',
    rowAlt: darkMode ? '#1a1a1a' : '#f9fafb',
    headerBg: darkMode ? '#1e1e1e' : '#f3f4f6',
    headerText: darkMode ? '#9ca3af' : '#6b7280',
    border: darkMode ? '#2d2d2d' : '#e5e7eb',
    labelText: darkMode ? '#e5e7eb' : '#1f2937',
    labelSub: darkMode ? '#6b7280' : '#9ca3af',
    barBg: darkMode ? '#7c3aed' : '#8b5cf6',
    barProg: darkMode ? '#a78bfa' : '#c4b5fd',
    barHover: darkMode ? '#6d28d9' : '#7c3aed',
    today: darkMode ? 'rgba(139,92,246,0.18)' : 'rgba(139,92,246,0.10)',
    todayLine: '#8b5cf6',
    dateLabel: darkMode ? '#e5e7eb' : '#374151',
  }), [darkMode])

  const { chartStart, chartEnd, colDates, cw, totalW, svgH } = useMemo(() => {
    if (tasks.length === 0) return { chartStart: new Date(), chartEnd: new Date(), colDates: [], cw: 80, totalW: 0, svgH: 0 }

    let minDate = parseDate(tasks[0].start)
    let maxDate = parseDate(tasks[0].end)
    tasks.forEach(t => {
      const s = parseDate(t.start), e = parseDate(t.end)
      if (s < minDate) minDate = s
      if (e > maxDate) maxDate = e
    })

    // Pad 1 column on each side
    const cw = colWidth(viewMode)
    const padDays = viewMode === 'Day' ? 2 : viewMode === 'Week' ? 14 : 30
    const padStart = addDays(minDate, -padDays)
    const padEnd = addDays(maxDate, padDays)

    const cols = getColumnDates(padStart, padEnd, viewMode)
    // chartStart is the first column date
    const cs = cols[0] ?? padStart
    const ce = cols[cols.length - 1] ?? padEnd

    return {
      chartStart: cs,
      chartEnd: ce,
      colDates: cols,
      cw,
      totalW: cols.length * cw,
      svgH: HEADER_H + tasks.length * ROW_H + 8,
    }
  }, [tasks, viewMode])

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [])

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No tasks found. Create notes with{' '}
        <code className="mx-1 bg-gray-100 dark:bg-gray-800 px-1 rounded">type: gantt-task</code>{' '}
        in frontmatter.
      </div>
    )
  }

  const todayX = LABEL_W + dateToX(today, chartStart, viewMode, cw)

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <svg
        width={LABEL_W + totalW}
        height={svgH}
        style={{ display: 'block', minWidth: LABEL_W + totalW, fontFamily: 'inherit' }}
      >
        {/* ── Background ── */}
        <rect x={0} y={0} width={LABEL_W + totalW} height={svgH} fill={colors.bg} />

        {/* ── Column stripes + header labels ── */}
        {colDates.map((d, i) => {
          const x = LABEL_W + i * cw
          const isToday = viewMode === 'Day' && d.toDateString() === today.toDateString()
          return (
            <g key={i}>
              <rect
                x={x} y={HEADER_H}
                width={cw} height={tasks.length * ROW_H}
                fill={isToday ? colors.today : 'transparent'}
              />
              {/* vertical grid line */}
              <line x1={x} y1={0} x2={x} y2={svgH} stroke={colors.border} strokeWidth={0.5} />
              {/* header cell bg */}
              <rect x={x} y={0} width={cw} height={HEADER_H} fill={colors.headerBg} />
              {/* header label — two lines: month on top, date range below */}
              {viewMode === 'Week' ? (
                <>
                  <text x={x + cw / 2} y={18} textAnchor="middle" fontSize={10} fill={colors.headerText} fontWeight="600">
                    {d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}
                  </text>
                  <text x={x + cw / 2} y={36} textAnchor="middle" fontSize={10} fill={colors.dateLabel}>
                    {d.getDate()} – {addDays(d, 6).getDate()}
                  </text>
                  <text x={x + cw / 2} y={50} textAnchor="middle" fontSize={9} fill={colors.headerText}>
                    {addDays(d, 6).getMonth() !== d.getMonth()
                      ? addDays(d, 6).toLocaleDateString('en-US', { month: 'short' })
                      : ''}
                  </text>
                </>
              ) : viewMode === 'Day' ? (
                <>
                  <text x={x + cw / 2} y={20} textAnchor="middle" fontSize={9} fill={colors.headerText}>
                    {d.toLocaleDateString('en-US', { month: 'short' })}
                  </text>
                  <text x={x + cw / 2} y={40} textAnchor="middle" fontSize={11} fill={isToday ? colors.todayLine : colors.dateLabel} fontWeight={isToday ? '700' : '400'}>
                    {d.getDate()}
                  </text>
                </>
              ) : (
                <>
                  <text x={x + cw / 2} y={22} textAnchor="middle" fontSize={11} fill={colors.dateLabel} fontWeight="600">
                    {d.toLocaleDateString('en-US', { month: 'short' })}
                  </text>
                  <text x={x + cw / 2} y={42} textAnchor="middle" fontSize={10} fill={colors.headerText}>
                    {d.getFullYear()}
                  </text>
                </>
              )}
            </g>
          )
        })}

        {/* Trailing border for header label area */}
        <rect x={0} y={0} width={LABEL_W} height={HEADER_H} fill={colors.headerBg} />
        <line x1={LABEL_W} y1={0} x2={LABEL_W} y2={svgH} stroke={colors.border} strokeWidth={1} />
        <line x1={0} y1={HEADER_H} x2={LABEL_W + totalW} y2={HEADER_H} stroke={colors.border} strokeWidth={1} />

        {/* ── Rows ── */}
        {tasks.map((task, i) => {
          const y = HEADER_H + i * ROW_H
          const isHovered = hoveredId === task.id
          const taskStart = parseDate(task.start)
          const taskEnd = parseDate(task.end)
          const duration = Math.max(1, diffDays(taskStart, taskEnd))
          const barX = LABEL_W + dateToX(taskStart, chartStart, viewMode, cw)
          const barW = Math.max(4, dateToX(taskEnd, chartStart, viewMode, cw) - dateToX(taskStart, chartStart, viewMode, cw))
          const progW = barW * Math.min(100, Math.max(0, task.progress ?? 0)) / 100
          const projectKey = task.project ?? task.name.match(/^\[(.+?)\]/)?.[1] ?? ''
          const projectColor = projectColors?.get(projectKey)
          const barFill = isHovered
            ? (projectColor ? projectColor + 'cc' : colors.barHover)
            : (projectColor ?? colors.barBg)
          const progFill = projectColor ? projectColor + '88' : colors.barProg

          return (
            <g key={task.id}
              onMouseEnter={() => setHoveredId(task.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{ cursor: onEditTask ? 'pointer' : 'default' }}
              onClick={() => onEditTask?.(task)}
            >
              {/* Row bg */}
              <rect x={0} y={y} width={LABEL_W + totalW} height={ROW_H}
                fill={i % 2 === 0 ? colors.bg : colors.rowAlt}
              />
              <line x1={0} y1={y + ROW_H} x2={LABEL_W + totalW} y2={y + ROW_H} stroke={colors.border} strokeWidth={0.5} />

              {/* Label area */}
              {projectColor && (
                <circle cx={10} cy={y + ROW_H / 2 - 5} r={4} fill={projectColor} />
              )}
              <text x={projectColor ? 20 : 10} y={y + ROW_H / 2 - 5} fontSize={12} fill={colors.labelText} fontWeight="500"
                style={{ dominantBaseline: 'middle' }}>
                {task.name.length > 24 ? task.name.slice(0, 23) + '…' : task.name}
              </text>
              <text x={10} y={y + ROW_H / 2 + 9} fontSize={10} fill={colors.labelSub}>
                {fmtDate(taskStart)} → {fmtDate(taskEnd)}
                {' '}({duration}d)
              </text>

              {/* Bar shadow */}
              <rect x={barX + 1} y={y + BAR_Y_OFFSET + 2} width={barW} height={BAR_H}
                rx={4} fill="rgba(0,0,0,0.18)" />
              {/* Bar body */}
              <rect x={barX} y={y + BAR_Y_OFFSET} width={barW} height={BAR_H}
                rx={4} fill={barFill} />
              {/* Progress fill */}
              {progW > 0 && (
                <rect x={barX} y={y + BAR_Y_OFFSET} width={progW} height={BAR_H}
                  rx={4} fill={progFill} />
              )}
              {/* Bar label: start – end dates inside bar if wide enough */}
              {barW > 90 && (
                <text
                  x={barX + barW / 2} y={y + BAR_Y_OFFSET + BAR_H / 2}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={10} fill="#fff" fontWeight="500"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {fmtDateShort(taskStart)} – {fmtDateShort(taskEnd)}
                </text>
              )}
              {/* Progress % badge */}
              {task.progress != null && task.progress > 0 && barW > 40 && (
                <text
                  x={barX + Math.min(progW - 4, barW - 28)} y={y + BAR_Y_OFFSET + BAR_H / 2}
                  textAnchor="end" dominantBaseline="middle"
                  fontSize={9} fill="rgba(255,255,255,0.85)"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {task.progress}%
                </text>
              )}
              {/* Edit pencil icon on hover */}
              {isHovered && onEditTask && (
                <g transform={`translate(${LABEL_W - 22}, ${y + ROW_H / 2 - 7})`}>
                  <rect width={18} height={14} rx={3} fill={colors.barBg} />
                  <text x={9} y={7} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#fff">✎</text>
                </g>
              )}
            </g>
          )
        })}

        {/* ── Today line ── */}
        {todayX >= LABEL_W && todayX <= LABEL_W + totalW && (
          <line x1={todayX} y1={0} x2={todayX} y2={svgH}
            stroke={colors.todayLine} strokeWidth={1.5} strokeDasharray="4 3" />
        )}

        {/* Header column label */}
        <text x={LABEL_W / 2} y={HEADER_H / 2} textAnchor="middle" dominantBaseline="middle"
          fontSize={11} fill={colors.headerText} fontWeight="600">
          TASK
        </text>
      </svg>
    </div>
  )
}
