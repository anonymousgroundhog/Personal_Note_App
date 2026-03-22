export interface NoteFrontmatter {
  tags?: string[]
  type?: string
  date?: string
  start?: string
  end?: string
  modified?: string
  title?: string
  project?: string
  project_id?: string
  task_id?: string
  depends_on?: string[]
  progress?: number
  assignee?: string
  priority?: 'low' | 'medium' | 'high'
  status?: string
  deadline?: string
  rrule?: string
  location?: string
  attendees?: string[]
  calendar_id?: string
  [key: string]: unknown
}

export interface NoteIndex {
  path: string
  name: string
  frontmatter: NoteFrontmatter
  excerpt: string
  body: string       // full markdown body (after frontmatter), used for wikilink extraction
}

export interface Note {
  path: string
  name: string
  content: string
  frontmatter: NoteFrontmatter
  body: string
}

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileTreeNode[]
  handle?: FileSystemFileHandle | FileSystemDirectoryHandle
}
