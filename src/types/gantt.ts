export interface GanttTask {
  id: string
  name: string
  start: string
  end: string
  progress: number
  dependencies?: string
  custom_class?: string
  notePath?: string
  project?: string
}

export interface GanttProject {
  id: string
  name: string
  tasks: GanttTask[]
  start?: string
  end?: string
}
