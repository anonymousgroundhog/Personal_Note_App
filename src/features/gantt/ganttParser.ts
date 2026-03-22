import type { NoteIndex } from '../../types/note'
import type { GanttTask, GanttProject } from '../../types/gantt'

function formatDate(d: string): string {
  // frappe-gantt expects YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10)
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return d
  return dt.toISOString().slice(0, 10)
}

export function parseGanttTasks(index: Map<string, NoteIndex>): GanttProject[] {
  const projectMap = new Map<string, GanttProject>()
  const taskNotes = Array.from(index.values()).filter(
    n => n.frontmatter.type === 'gantt-task' || n.frontmatter.tags?.includes('gantt-task')
  )

  for (const note of taskNotes) {
    const fm = note.frontmatter
    const projectName = String(fm.project || 'Uncategorized')
    const projectId = projectName.toLowerCase().replace(/\s+/g, '-')

    if (!projectMap.has(projectId)) {
      // Find the project note for this project
      const projectNote = Array.from(index.values()).find(
        n => n.frontmatter.type === 'project' && n.frontmatter.title === projectName
      )
      projectMap.set(projectId, {
        id: projectId,
        name: projectName,
        tasks: [],
        start: projectNote?.frontmatter.start ? formatDate(String(projectNote.frontmatter.start)) : undefined,
        end: projectNote?.frontmatter.deadline ? formatDate(String(projectNote.frontmatter.deadline)) : undefined,
      })
    }

    const project = projectMap.get(projectId)!
    const taskId = String(fm.task_id || note.path)
    const start = fm.start ? formatDate(String(fm.start)) : new Date().toISOString().slice(0, 10)
    const end = fm.end ? formatDate(String(fm.end)) : new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

    const task: GanttTask = {
      id: taskId,
      name: String(fm.title || note.name),
      start,
      end,
      progress: Number(fm.progress ?? 0),
      dependencies: Array.isArray(fm.depends_on) ? fm.depends_on.join(',') : fm.depends_on ? String(fm.depends_on) : '',
      notePath: note.path,
      project: projectName,
    }
    project.tasks.push(task)
  }

  return Array.from(projectMap.values()).filter(p => p.tasks.length > 0)
}

export function parseProjectNotes(index: Map<string, NoteIndex>): GanttProject[] {
  const projects = Array.from(index.values()).filter(
    n => n.frontmatter.type === 'project'
  )
  return projects.map(n => {
    const fm = n.frontmatter
    const projectId = String(fm.project_id || n.name.toLowerCase().replace(/\s+/g, '-'))
    const projectName = String(fm.title || n.name)
    const allTasks = parseGanttTasks(index)
    const found = allTasks.find(p => p.name === projectName)
    return {
      id: projectId,
      name: projectName,
      tasks: found?.tasks || [],
      start: fm.start ? String(fm.start) : undefined,
      end: fm.deadline ? String(fm.deadline) : undefined,
    }
  })
}
