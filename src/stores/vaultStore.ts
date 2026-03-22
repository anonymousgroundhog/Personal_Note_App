import { create } from 'zustand'
import type { FileTreeNode, NoteIndex } from '../types/note'
import { buildFileTree, listFiles, readFile, getFileHandle, writeFile } from '../lib/fs/fileSystemApi'
import { parseFrontmatter } from '../lib/markdown/processor'

interface VaultState {
  rootHandle: FileSystemDirectoryHandle | null
  fileTree: FileTreeNode[]
  index: Map<string, NoteIndex>
  isLoading: boolean
  openVault: () => Promise<void>
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

export const useVaultStore = create<VaultState>((set, get) => ({
  rootHandle: null,
  fileTree: [],
  index: new Map(),
  isLoading: false,

  openVault: async () => {
    try {
      const handle = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker()
      set({ isLoading: true, rootHandle: handle })
      const [fileTree, index] = await Promise.all([
        buildFileTree(handle),
        buildIndex(handle),
      ])
      set({ fileTree, index, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  closeVault: () => set({ rootHandle: null, fileTree: [], index: new Map() }),

  refreshIndex: async () => {
    const { rootHandle } = get()
    if (!rootHandle) return
    set({ isLoading: true })
    const [fileTree, index] = await Promise.all([
      buildFileTree(rootHandle),
      buildIndex(rootHandle),
    ])
    set({ fileTree, index, isLoading: false })
  },

  createNote: async (path: string, content = '') => {
    const { rootHandle } = get()
    if (!rootHandle) return
    const handle = await getFileHandle(rootHandle, path, true)
    await writeFile(handle, content)
    await get().refreshIndex()
  },

  saveNote: async (path: string, content: string) => {
    const { rootHandle } = get()
    if (!rootHandle) return
    const handle = await getFileHandle(rootHandle, path, true)
    await writeFile(handle, content)
    // Update index for this file
    const { frontmatter, body } = parseFrontmatter(content)
    const name = path.split('/').pop()?.replace(/\.md$/, '') || path
    const index = new Map(get().index)
    index.set(path, { path, name, frontmatter, excerpt: body.slice(0, 200).replace(/#+\s/g, '').trim(), body })
    set({ index })
  },

  deleteNote: async (path: string) => {
    const { rootHandle } = get()
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
    const { rootHandle } = get()
    if (!rootHandle) return ''
    const handle = await getFileHandle(rootHandle, path)
    return readFile(handle)
  },
}))
