declare module 'frappe-gantt' {
  export interface Task {
    id: string
    name: string
    start: string
    end: string
    progress: number
    dependencies?: string
    custom_class?: string
    [key: string]: unknown
  }

  export interface GanttOptions {
    view_mode?: string
    date_format?: string
    on_click?: (task: Task) => void
    on_date_change?: (task: Task, start: string, end: string) => void
    on_progress_change?: (task: Task, progress: number) => void
    on_view_change?: (mode: string) => void
    popup_trigger?: string
    language?: string
  }

  export default class Gantt {
    constructor(
      element: HTMLElement | SVGElement | string,
      tasks: Task[],
      options?: GanttOptions
    )
    change_view_mode(mode: string): void
    refresh(tasks: Task[]): void
    element: HTMLElement
  }
}
