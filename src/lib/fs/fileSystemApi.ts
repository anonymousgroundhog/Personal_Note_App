export async function readFile(handle: FileSystemFileHandle): Promise<string> {
  const file = await handle.getFile()
  return file.text()
}

export async function writeFile(handle: FileSystemFileHandle, content: string): Promise<void> {
  const writable = await handle.createWritable()
  await writable.write(content)
  await writable.close()
}

export async function writeBinaryFile(handle: FileSystemFileHandle, data: Blob): Promise<void> {
  const writable = await handle.createWritable()
  await writable.write(data)
  await writable.close()
}

export async function getFileHandle(
  dir: FileSystemDirectoryHandle,
  path: string,
  create = false
): Promise<FileSystemFileHandle> {
  const parts = path.split('/').filter(Boolean)
  let current: FileSystemDirectoryHandle = dir
  for (let i = 0; i < parts.length - 1; i++) {
    current = await current.getDirectoryHandle(parts[i], { create })
  }
  return current.getFileHandle(parts[parts.length - 1], { create })
}

export async function getOrCreateDir(
  dir: FileSystemDirectoryHandle,
  name: string
): Promise<FileSystemDirectoryHandle> {
  return dir.getDirectoryHandle(name, { create: true })
}

export async function listFiles(
  dir: FileSystemDirectoryHandle,
  prefix = ''
): Promise<Array<{ path: string; handle: FileSystemFileHandle }>> {
  const files: Array<{ path: string; handle: FileSystemFileHandle }> = []
  for await (const [name, handle] of (dir as unknown as AsyncIterable<[string, FileSystemHandle]>)) {
    if (name.startsWith('.') || name === 'node_modules') continue
    const path = prefix ? `${prefix}/${name}` : name
    if (handle.kind === 'file' && name.endsWith('.md')) {
      files.push({ path, handle: handle as FileSystemFileHandle })
    } else if (handle.kind === 'directory') {
      const sub = await listFiles(handle as FileSystemDirectoryHandle, path)
      files.push(...sub)
    }
  }
  return files
}

export async function buildFileTree(
  dir: FileSystemDirectoryHandle,
  prefix = ''
): Promise<import('../../types/note').FileTreeNode[]> {
  const nodes: import('../../types/note').FileTreeNode[] = []
  const entries: Array<[string, FileSystemHandle]> = []
  for await (const [name, handle] of (dir as unknown as AsyncIterable<[string, FileSystemHandle]>)) {
    if (name.startsWith('.') || name === 'node_modules') continue
    entries.push([name, handle])
  }
  entries.sort(([a, ha], [b, hb]) => {
    if (ha.kind !== hb.kind) return ha.kind === 'directory' ? -1 : 1
    return a.localeCompare(b)
  })
  for (const [name, handle] of entries) {
    const path = prefix ? `${prefix}/${name}` : name
    if (handle.kind === 'directory') {
      const children = await buildFileTree(handle as FileSystemDirectoryHandle, path)
      nodes.push({ name, path, type: 'folder', children, handle: handle as FileSystemDirectoryHandle })
    } else if (name.endsWith('.md')) {
      nodes.push({ name, path, type: 'file', handle: handle as FileSystemFileHandle })
    }
  }
  return nodes
}

export async function deleteFile(dir: FileSystemDirectoryHandle, path: string): Promise<void> {
  const parts = path.split('/').filter(Boolean)
  let current: FileSystemDirectoryHandle = dir
  for (let i = 0; i < parts.length - 1; i++) {
    current = await current.getDirectoryHandle(parts[i])
  }
  await current.removeEntry(parts[parts.length - 1])
}
