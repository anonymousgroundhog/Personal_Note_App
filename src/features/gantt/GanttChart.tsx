import React, { useMemo, useState, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'
import type { GanttTask } from '../../types/gantt'
import { useUiStore } from '../../stores/uiStore'

interface Props {
  tasks: GanttTask[]
  viewMode?: 'Day' | 'Week' | 'Month' | 'Quarter Year'
  onEditTask?: (task: GanttTask) => void
  onDragTask?: (task: GanttTask, newStart: string, newEnd: string) => void
  projectColors?: Map<string, string>
  collapsedParents?: Set<string>
  onToggleParent?: (taskId: string) => void
  parentIds?: Set<string>
}

export interface GanttChartHandle {
  getSvgElement: () => SVGSVGElement | null
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

function fmtIso(d: Date): string {
  return d.toISOString().slice(0, 10)
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
  const months = (date.getFullYear() - chartStart.getFullYear()) * 12 + (date.getMonth() - chartStart.getMonth())
  const frac = date.getDate() / new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  return (months + frac) * cw
}

// Convert chart-relative x pixel back to a Date
function xToDate(x: number, chartStart: Date, viewMode: string, cw: number): Date {
  if (viewMode === 'Day') {
    const days = Math.round(x / cw)
    return addDays(chartStart, days)
  }
  if (viewMode === 'Week') {
    const days = Math.round((x / cw) * 7)
    return addDays(chartStart, days)
  }
  // Month / Quarter — approximate via fractional months
  const totalMonths = x / cw
  const wholeMonths = Math.floor(totalMonths)
  const fracMonth = totalMonths - wholeMonths
  const base = new Date(chartStart.getFullYear(), chartStart.getMonth() + wholeMonths, 1)
  const daysInMonth = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate()
  const day = Math.round(fracMonth * daysInMonth) + 1
  return new Date(base.getFullYear(), base.getMonth(), Math.max(1, Math.min(day, daysInMonth)))
}

const GanttChart = forwardRef<GanttChartHandle, Props>(function GanttChart(
  { tasks, viewMode = 'Week', onEditTask, onDragTask, projectColors, collapsedParents, onToggleParent, parentIds }: Props,
  ref
) {
  const { darkMode } = useUiStore()
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // Drag state
  const dragRef = useRef<{
    taskId: string
    startX: number       // mousedown clientX
    origBarX: number     // bar's original left pixel
    durationDays: number // original duration in days
    svgLeft: number      // SVG container left offset
  } | null>(null)
  const [dragging, setDragging] = useState<{ taskId: string; deltaX: number } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useImperativeHandle(ref, () => ({
    getSvgElement: () => svgRef.current,
  }))

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
    depArrow: darkMode ? '#f59e0b' : '#d97706',
    depBlocked: darkMode ? '#ef4444' : '#dc2626',
    depArrowBlocking: darkMode ? '#fbbf24' : '#f59e0b',
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

    const cw = colWidth(viewMode)
    const padDays = viewMode === 'Day' ? 2 : viewMode === 'Week' ? 14 : 30
    const padStart = addDays(minDate, -padDays)
    const padEnd = addDays(maxDate, padDays)

    const cols = getColumnDates(padStart, padEnd, viewMode)
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

  // Build a map of task id -> row index for dependency arrow routing
  const taskRowMap = useMemo(() => {
    const m = new Map<string, number>()
    tasks.forEach((t, i) => m.set(t.id, i))
    return m
  }, [tasks])

  // Compute dependency edges: { fromId (blocker), toId (blocked), fromRow, toRow }
  const depEdges = useMemo(() => {
    const edges: { fromId: string; toId: string; fromRow: number; toRow: number }[] = []
    tasks.forEach(task => {
      if (!task.dependencies) return
      const deps = task.dependencies.split(',').map(s => s.trim()).filter(Boolean)
      deps.forEach(depId => {
        const fromRow = taskRowMap.get(depId)
        const toRow = taskRowMap.get(task.id)
        if (fromRow !== undefined && toRow !== undefined) {
          edges.push({ fromId: depId, toId: task.id, fromRow, toRow })
        }
      })
    })
    return edges
  }, [tasks, taskRowMap])

  // IDs that are blocking something (have a task waiting on them)
  const blockingIds = useMemo(() => new Set(depEdges.map(e => e.fromId)), [depEdges])
  // IDs that are blocked by something
  const blockedIds = useMemo(() => new Set(depEdges.map(e => e.toId)), [depEdges])

  // Drag handlers
  const handleBarMouseDown = useCallback((e: React.MouseEvent, task: GanttTask, barX: number) => {
    if (!onDragTask) return
    e.preventDefault()
    e.stopPropagation()
    const svgRect = svgRef.current?.getBoundingClientRect()
    const taskStart = parseDate(task.start)
    const taskEnd = parseDate(task.end)
    dragRef.current = {
      taskId: task.id,
      startX: e.clientX,
      origBarX: barX,
      durationDays: diffDays(taskStart, taskEnd),
      svgLeft: svgRect?.left ?? 0,
    }
    setDragging({ taskId: task.id, deltaX: 0 })
  }, [onDragTask])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current) return
    const deltaX = e.clientX - dragRef.current.startX
    setDragging({ taskId: dragRef.current.taskId, deltaX })
  }, [])

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current || !onDragTask) { dragRef.current = null; setDragging(null); return }
    const deltaX = e.clientX - dragRef.current.startX
    const { taskId, origBarX, durationDays } = dragRef.current
    const newBarX = origBarX + deltaX - LABEL_W  // relative to chart area
    const newStart = xToDate(newBarX, chartStart, viewMode, cw)
    newStart.setHours(0, 0, 0, 0)
    const newEnd = addDays(newStart, durationDays)
    const task = tasks.find(t => t.id === taskId)
    if (task && Math.abs(deltaX) > 4) {
      onDragTask(task, fmtIso(newStart), fmtIso(newEnd))
    }
    dragRef.current = null
    setDragging(null)
  }, [onDragTask, tasks, chartStart, viewMode, cw])

  const handleMouseLeave = useCallback(() => {
    if (dragRef.current) {
      dragRef.current = null
      setDragging(null)
    }
  }, [])

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
        ref={svgRef}
        width={LABEL_W + totalW}
        height={svgH}
        style={{ display: 'block', minWidth: LABEL_W + totalW, fontFamily: 'inherit', userSelect: 'none' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      >
        {/* ── defs: arrowhead markers ── */}
        <defs>
          <marker id="arrow-dep" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
            <polygon points="0 0, 7 3.5, 0 7" fill={colors.depArrow} />
          </marker>
          <marker id="arrow-blocked" markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
            <polygon points="0 0, 7 3.5, 0 7" fill={colors.depBlocked} />
          </marker>
        </defs>

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
              <line x1={x} y1={0} x2={x} y2={svgH} stroke={colors.border} strokeWidth={0.5} />
              <rect x={x} y={0} width={cw} height={HEADER_H} fill={colors.headerBg} />
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

        <rect x={0} y={0} width={LABEL_W} height={HEADER_H} fill={colors.headerBg} />
        <line x1={LABEL_W} y1={0} x2={LABEL_W} y2={svgH} stroke={colors.border} strokeWidth={1} />
        <line x1={0} y1={HEADER_H} x2={LABEL_W + totalW} y2={HEADER_H} stroke={colors.border} strokeWidth={1} />

        {/* ── Rows ── */}
        {tasks.map((task, i) => {
          const y = HEADER_H + i * ROW_H
          const isDraggingThis = dragging?.taskId === task.id
          const isHovered = hoveredId === task.id
          const isBlocked = blockedIds.has(task.id)
          const isBlocking = blockingIds.has(task.id)

          const taskStart = parseDate(task.start)
          const taskEnd = parseDate(task.end)
          const duration = Math.max(1, diffDays(taskStart, taskEnd))

          // Apply drag delta
          let barX = LABEL_W + dateToX(taskStart, chartStart, viewMode, cw)
          let barW = Math.max(4, dateToX(taskEnd, chartStart, viewMode, cw) - dateToX(taskStart, chartStart, viewMode, cw))
          if (isDraggingThis && dragging) {
            barX += dragging.deltaX
          }

          const progW = barW * Math.min(100, Math.max(0, task.progress ?? 0)) / 100
          const projectKey = task.project ?? task.name.match(/^\[(.+?)\]/)?.[1] ?? ''
          const projectColor = projectColors?.get(projectKey)
          const barFill = isDraggingThis
            ? (projectColor ? projectColor + 'bb' : colors.barHover)
            : isHovered
              ? (projectColor ? projectColor + 'cc' : colors.barHover)
              : (projectColor ?? colors.barBg)
          const progFill = projectColor ? projectColor + '88' : colors.barProg

          return (
            <g key={task.id}
              onMouseEnter={() => !dragging && setHoveredId(task.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Row bg */}
              <rect x={0} y={y} width={LABEL_W + totalW} height={ROW_H}
                fill={i % 2 === 0 ? colors.bg : colors.rowAlt}
              />
              <line x1={0} y1={y + ROW_H} x2={LABEL_W + totalW} y2={y + ROW_H} stroke={colors.border} strokeWidth={0.5} />

              {/* Label area */}
              {/* Collapse toggle for parent tasks */}
              {parentIds?.has(task.id) && onToggleParent && (
                <text
                  x={6} y={y + ROW_H / 2}
                  fontSize={10} fill={colors.labelSub}
                  style={{ dominantBaseline: 'middle', cursor: 'pointer', userSelect: 'none' }}
                  onClick={() => onToggleParent(task.id)}
                >
                  {collapsedParents?.has(task.id) ? '▶' : '▼'}
                </text>
              )}
              {projectColor && (
                <circle cx={parentIds?.has(task.id) ? 22 : 10} cy={y + ROW_H / 2 - 5} r={4} fill={projectColor} />
              )}
              {/* Indent subtasks */}
              {task.parentTaskId && (
                <line x1={14} y1={y} x2={14} y2={y + ROW_H / 2} stroke={colors.border} strokeWidth={1} />
              )}
              {/* Blocked indicator */}
              {isBlocked && (
                <text x={LABEL_W - 36} y={y + ROW_H / 2 - 4} fontSize={10} fill={colors.depBlocked}
                  style={{ dominantBaseline: 'middle' }}>
                  <title>Waiting on dependency</title>
                  ⏳
                </text>
              )}
              {/* Blocking indicator */}
              {isBlocking && (
                <text x={LABEL_W - 20} y={y + ROW_H / 2 - 4} fontSize={10} fill={colors.depArrowBlocking}
                  style={{ dominantBaseline: 'middle' }}>
                  <title>Blocking other tasks</title>
                  🔒
                </text>
              )}
              {(() => {
                const isParent = parentIds?.has(task.id)
                const isChild = !!task.parentTaskId
                const textX = isParent ? (projectColor ? 34 : 22) : isChild ? (projectColor ? 26 : 22) : (projectColor ? 20 : 10)
                const maxLen = isChild ? 20 : 22
                return (
                  <>
                    <text x={textX} y={y + ROW_H / 2 - 5} fontSize={isChild ? 11 : 12} fill={colors.labelText}
                      fontWeight={isParent ? '700' : '500'}
                      style={{ dominantBaseline: 'middle' }}>
                      {task.name.length > maxLen ? task.name.slice(0, maxLen - 1) + '…' : task.name}
                    </text>
                    <text x={textX} y={y + ROW_H / 2 + 9} fontSize={10} fill={colors.labelSub}>
                      {fmtDate(taskStart)} → {fmtDate(taskEnd)}
                      {' '}({duration}d)
                    </text>
                  </>
                )
              })()}

              {/* Bar shadow */}
              <rect x={barX + 1} y={y + BAR_Y_OFFSET + 2} width={barW} height={BAR_H}
                rx={4} fill="rgba(0,0,0,0.18)" />
              {/* Bar body */}
              <rect
                x={barX} y={y + BAR_Y_OFFSET} width={barW} height={BAR_H}
                rx={4} fill={barFill}
                style={{ cursor: onDragTask ? (isDraggingThis ? 'grabbing' : 'grab') : (onEditTask ? 'pointer' : 'default') }}
                onMouseDown={e => {
                  if (onDragTask) {
                    handleBarMouseDown(e, task, barX)
                  }
                }}
                onClick={e => {
                  // Only fire edit if not a drag
                  if (!dragRef.current && Math.abs((dragging?.deltaX ?? 0)) <= 4) {
                    onEditTask?.(task)
                  }
                }}
              />
              {/* Progress fill */}
              {progW > 0 && (
                <rect x={barX} y={y + BAR_Y_OFFSET} width={progW} height={BAR_H}
                  rx={4} fill={progFill} style={{ pointerEvents: 'none' }} />
              )}
              {/* Blocked/blocking border */}
              {isBlocked && (
                <rect x={barX} y={y + BAR_Y_OFFSET} width={barW} height={BAR_H}
                  rx={4} fill="none" stroke={colors.depBlocked} strokeWidth={2} strokeDasharray="4 2"
                  style={{ pointerEvents: 'none' }} />
              )}
              {/* Bar label */}
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
              {/* Progress % */}
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
              {/* Edit pencil on hover (when not draggable) */}
              {isHovered && onEditTask && !onDragTask && (
                <g transform={`translate(${LABEL_W - 22}, ${y + ROW_H / 2 - 7})`}>
                  <rect width={18} height={14} rx={3} fill={colors.barBg} />
                  <text x={9} y={7} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill="#fff">✎</text>
                </g>
              )}
              {/* Drag hint on hover */}
              {isHovered && onDragTask && !isDraggingThis && (
                <text x={barX + barW / 2} y={y + BAR_Y_OFFSET - 6}
                  textAnchor="middle" fontSize={9} fill={colors.labelSub}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  drag to reschedule
                </text>
              )}
            </g>
          )
        })}

        {/* ── Dependency arrows ── */}
        {depEdges.map((edge, idx) => {
          const fromTask = tasks.find(t => t.id === edge.fromId)
          const toTask = tasks.find(t => t.id === edge.toId)
          if (!fromTask || !toTask) return null

          const fromDrag = dragging?.taskId === edge.fromId ? dragging.deltaX : 0
          const toDrag = dragging?.taskId === edge.toId ? dragging.deltaX : 0

          const fromEnd = LABEL_W + dateToX(parseDate(fromTask.end), chartStart, viewMode, cw) + fromDrag
          const toStart = LABEL_W + dateToX(parseDate(toTask.start), chartStart, viewMode, cw) + toDrag

          const fromY = HEADER_H + edge.fromRow * ROW_H + ROW_H / 2
          const toY = HEADER_H + edge.toRow * ROW_H + ROW_H / 2

          // Is the dependency violated? (toTask starts before fromTask ends)
          const isViolated = parseDate(toTask.start) < parseDate(fromTask.end)
          const strokeColor = isViolated ? colors.depBlocked : colors.depArrow
          const markerId = isViolated ? 'arrow-blocked' : 'arrow-dep'

          // Route: right from fromTask end -> elbow down/up -> left to toTask start
          const midX = fromEnd + 10

          return (
            <g key={idx} style={{ pointerEvents: 'none' }}>
              <path
                d={`M ${fromEnd} ${fromY} L ${midX} ${fromY} L ${midX} ${toY} L ${toStart - 4} ${toY}`}
                fill="none"
                stroke={strokeColor}
                strokeWidth={1.5}
                strokeDasharray={isViolated ? '4 2' : undefined}
                markerEnd={`url(#${markerId})`}
                opacity={0.8}
              />
              {/* Violation label */}
              {isViolated && (
                <text
                  x={(fromEnd + toStart) / 2} y={Math.min(fromY, toY) - 4}
                  textAnchor="middle" fontSize={9} fill={colors.depBlocked}
                  fontWeight="600"
                >
                  ⚠ overlap
                </text>
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
})

export default GanttChart
