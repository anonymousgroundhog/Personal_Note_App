import React, { useEffect, useRef } from 'react'
import type { GanttTask } from '../../types/gantt'
import { useUiStore } from '../../stores/uiStore'

interface Props {
  tasks: GanttTask[]
  viewMode?: 'Day' | 'Week' | 'Month' | 'Quarter Year'
}

export default function GanttChart({ tasks, viewMode = 'Week' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { setActiveNote, setActiveView } = useUiStore()

  useEffect(() => {
    if (!containerRef.current || tasks.length === 0) return

    // frappe-gantt needs an SVG element as target
    containerRef.current.innerHTML = '<svg id="gantt-svg"></svg>'
    const svgEl = containerRef.current.querySelector('#gantt-svg') as SVGElement

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let Gantt: any
    import('frappe-gantt').then(mod => {
      Gantt = mod.default
      try {
        new Gantt(svgEl, tasks, {
          view_mode: viewMode,
          date_format: 'YYYY-MM-DD',
          on_click: (task: GanttTask) => {
            if (task.notePath) {
              setActiveNote(task.notePath)
              setActiveView('notes')
            }
          },
        })
      } catch (e) {
        console.error('Gantt render error:', e)
      }
    })

    return () => {
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
  }, [tasks, viewMode, setActiveNote, setActiveView])

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No tasks found. Create notes with <code className="mx-1 bg-gray-100 dark:bg-gray-800 px-1 rounded">type: gantt-task</code> in frontmatter.
      </div>
    )
  }

  return <div ref={containerRef} className="gantt-container w-full overflow-x-auto" />
}
