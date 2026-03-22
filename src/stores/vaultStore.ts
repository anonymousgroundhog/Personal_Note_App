import { create } from 'zustand'
import type { FileTreeNode, NoteIndex } from '../types/note'
import { buildFileTree, listFiles, readFile, getFileHandle, writeFile } from '../lib/fs/fileSystemApi'
import { parseFrontmatter } from '../lib/markdown/processor'

// In-memory store for the fallback (file input) mode — keyed by relative path
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fallbackFiles = new Map<string, File>()

export function isFsApiSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

interface VaultState {
  rootHandle: FileSystemDirectoryHandle | null
  /** True when using the fallback file-input mode (no FileSystem Access API) */
  fallbackMode: boolean
  /** Root folder name shown in the sidebar when in fallback mode */
  fallbackName: string
  fileTree: FileTreeNode[]
  index: Map<string, NoteIndex>
  isLoading: boolean
  openVault: () => Promise<void>
  /** Called by the hidden file input in fallback mode */
  openVaultFallback: (files: FileList) => Promise<void>
  closeVault: () => void
  refreshIndex: () => Promise<void>
  createNote: (path: string, content?: string) => Promise<void>
  saveNote: (path: string, content: string) => Promise<void>
  deleteNote: (path: string) => Promise<void>
  readNote: (path: string) => Promise<string>
}

async function buildIndex(rootHandle: FileSystemDirectoryHandle): Promise<Map<string, NoteIndex>> {
  const files = await listFiles(rootHandle)
  const index = new Map<string, NoteIndex>()
  for (const { path, handle } of files) {
    try {
      const raw = await readFile(handle)
      const { frontmatter, body } = parseFrontmatter(raw)
      const name = path.split('/').pop()?.replace(/\.md$/, '') || path
      index.set(path, {
        path,
        name,
        frontmatter,
        excerpt: body.slice(0, 200).replace(/#+\s/g, '').trim(),
        body,
      })
    } catch {
      // skip unreadable files
    }
  }
  return index
}

// ── Fallback helpers (file input mode) ──────────────────────────────────────

async function buildIndexFromFiles(files: Map<string, File>): Promise<Map<string, NoteIndex>> {
  const index = new Map<string, NoteIndex>()
  for (const [path, file] of files) {
    try {
      const raw = await file.text()
      const { frontmatter, body } = parseFrontmatter(raw)
      const name = path.split('/').pop()?.replace(/\.md$/, '') || path
      index.set(path, {
        path,
        name,
        frontmatter,
        excerpt: body.slice(0, 200).replace(/#+\s/g, '').trim(),
        body,
      })
    } catch {
      // skip
    }
  }
  return index
}

function buildTreeFromFiles(files: Map<string, File>): import('../types/note').FileTreeNode[] {
  // Build a virtual directory tree from flat path list
  const root: import('../types/note').FileTreeNode[] = []
  const dirs = new Map<string, import('../types/note').FileTreeNode>()

  const getOrMakeDir = (parts: string[]): import('../types/note').FileTreeNode[] => {
    if (parts.length === 0) return root
    const key = parts.join('/')
    if (!dirs.has(key)) {
      const node: import('../types/note').FileTreeNode = {
        name: parts[parts.length - 1],
        path: key,
        type: 'folder',
        children: [],
      }
      dirs.set(key, node)
      const parentList = getOrMakeDir(parts.slice(0, -1))
      parentList.push(node)
    }
    return dirs.get(key)!.children!
  }

  const sorted = Array.from(files.keys()).sort()
  for (const path of sorted) {
    const parts = path.split('/')
    const parentList = getOrMakeDir(parts.slice(0, -1))
    parentList.push({ name: parts[parts.length - 1], path, type: 'file' })
  }
  return root
}

/** Strip the leading folder name segment from webkitRelativePath */
function normalizeWebkitPath(webkitPath: string): string {
  const slash = webkitPath.indexOf('/')
  return slash === -1 ? webkitPath : webkitPath.slice(slash + 1)
}

export const useVaultStore = create<VaultState>((set, get) => ({
  rootHandle: null,
  fallbackMode: false,
  fallbackName: '',
  fileTree: [],
  index: new Map(),
  isLoading: false,

  openVault: async () => {
    if (!isFsApiSupported()) {
      document.getElementById('vault-file-input')?.click()
      return
    }
    try {
      const handle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker()
      set({ isLoading: true, rootHandle: handle, fallbackMode: false })
      const [fileTree, index] = await Promise.all([
        buildFileTree(handle),
        buildIndex(handle),
      ])
      set({ fileTree, index, isLoading: false })
    } catch (err) {
      set({ isLoading: false })
      // Chrome blocks sensitive directories (Desktop, home root, etc.) with SecurityError.
      // Fall back to the file-input picker so the user can still select their vault.
      if (err instanceof Error && (err.name === 'SecurityError' || err.name === 'NotAllowedError')) {
        document.getElementById('vault-file-input')?.click()
      }
    }
  },

  openVaultFallback: async (fileList: FileList) => {
    set({ isLoading: true })
    fallbackFiles.clear()
    let folderName = ''
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i]
      const rel = (file as File & { webkitRelativePath: string }).webkitRelativePath
      if (!rel) continue
      if (!folderName) folderName = rel.split('/')[0]
      const path = normalizeWebkitPath(rel)
      if (path.endsWith('.md') && !path.split('/').some(p => p.startsWith('.'))) {
        fallbackFiles.set(path, file)
      }
    }
    const [fileTree, index] = await Promise.all([
      Promise.resolve(buildTreeFromFiles(fallbackFiles)),
      buildIndexFromFiles(fallbackFiles),
    ])
    set({ fileTree, index, isLoading: false, fallbackMode: true, fallbackName: folderName, rootHandle: null })
  },

  closeVault: () => {
    fallbackFiles.clear()
    set({ rootHandle: null, fallbackMode: false, fallbackName: '', fileTree: [], index: new Map() })
  },

  refreshIndex: async () => {
    const { rootHandle, fallbackMode } = get()
    if (fallbackMode) {
      set({ isLoading: true })
      const [fileTree, index] = await Promise.all([
        Promise.resolve(buildTreeFromFiles(fallbackFiles)),
        buildIndexFromFiles(fallbackFiles),
      ])
      set({ fileTree, index, isLoading: false })
      return
    }
    if (!rootHandle) return
    set({ isLoading: true })
    const [fileTree, index] = await Promise.all([
      buildFileTree(rootHandle),
      buildIndex(rootHandle),
    ])
    set({ fileTree, index, isLoading: false })
  },

  createNote: async (path: string, content = '') => {
    const { rootHandle, fallbackMode } = get()
    if (fallbackMode) {
      // In fallback mode, create an in-memory file and update the index
      const file = new File([content], path.split('/').pop() ?? path, { type: 'text/markdown' })
      fallbackFiles.set(path, file)
      await get().refreshIndex()
      return
    }
    if (!rootHandle) return
    const handle = await getFileHandle(rootHandle, path, true)
    await writeFile(handle, content)
    await get().refreshIndex()
  },

  saveNote: async (path: string, content: string) => {
    const { rootHandle, fallbackMode } = get()
    if (fallbackMode) {
      // Replace the in-memory file
      const file = new File([content], path.split('/').pop() ?? path, { type: 'text/markdown' })
      fallbackFiles.set(path, file)
      const { frontmatter, body } = parseFrontmatter(content)
      const name = path.split('/').pop()?.replace(/\.md$/, '') || path
      const index = new Map(get().index)
      index.set(path, { path, name, frontmatter, excerpt: body.slice(0, 200).replace(/#+\s/g, '').trim(), body })
      set({ index })
      return
    }
    if (!rootHandle) return
    const handle = await getFileHandle(rootHandle, path, true)
    await writeFile(handle, content)
    const { frontmatter, body } = parseFrontmatter(content)
    const name = path.split('/').pop()?.replace(/\.md$/, '') || path
    const index = new Map(get().index)
    index.set(path, { path, name, frontmatter, excerpt: body.slice(0, 200).replace(/#+\s/g, '').trim(), body })
    set({ index })
  },

  deleteNote: async (path: string) => {
    const { rootHandle, fallbackMode } = get()
    if (fallbackMode) {
      fallbackFiles.delete(path)
      await get().refreshIndex()
      return
    }
    if (!rootHandle) return
    const parts = path.split('/')
    let dir: FileSystemDirectoryHandle = rootHandle
    for (let i = 0; i < parts.length - 1; i++) {
      dir = await dir.getDirectoryHandle(parts[i])
    }
    await dir.removeEntry(parts[parts.length - 1])
    await get().refreshIndex()
  },

  readNote: async (path: string): Promise<string> => {
    const { rootHandle, fallbackMode } = get()
    if (fallbackMode) {
      const file = fallbackFiles.get(path)
      return file ? file.text() : ''
    }
    if (!rootHandle) return ''
    const handle = await getFileHandle(rootHandle, path)
    return readFile(handle)
  },
}))
