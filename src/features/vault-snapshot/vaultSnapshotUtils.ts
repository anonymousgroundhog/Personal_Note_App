import { readFile, writeFile, getFileHandle } from '../../lib/fs/fileSystemApi'

export interface SnapshotEntry {
  label: string
  timestamp: string
  files: string[]
}

export interface SnapshotFile {
  version: 1
  snapshots: SnapshotEntry[]
}

/**
 * Recursively scan all file paths in the vault, excluding hidden files and node_modules
 */
export async function scanAllPaths(
  dir: FileSystemDirectoryHandle,
  prefix = ''
): Promise<string[]> {
  const paths: string[] = []
  for await (const [name, handle] of dir as unknown as AsyncIterable<[string, FileSystemHandle]>) {
    if (name.startsWith('.') || name === 'node_modules') continue
    const path = prefix ? `${prefix}/${name}` : name
    if (handle.kind === 'file') {
      paths.push(path)
    } else if (handle.kind === 'directory') {
      const subPaths = await scanAllPaths(handle as FileSystemDirectoryHandle, path)
      paths.push(...subPaths)
    }
  }
  return paths.sort()
}

/**
 * Compare two file lists and return added, removed, and unchanged files
 */
export function diffSnapshots(
  previous: string[],
  current: string[]
): { added: string[]; removed: string[]; unchanged: string[] } {
  const prevSet = new Set(previous)
  const currSet = new Set(current)

  const added = Array.from(currSet).filter(f => !prevSet.has(f)).sort()
  const removed = Array.from(prevSet).filter(f => !currSet.has(f)).sort()
  const unchanged = Array.from(currSet).filter(f => prevSet.has(f)).sort()

  return { added, removed, unchanged }
}

/**
 * Load all snapshots from .vault-snapshot.json
 */
export async function loadSnapshots(rootHandle: FileSystemDirectoryHandle): Promise<SnapshotFile> {
  try {
    const handle = await getFileHandle(rootHandle, '.vault-snapshot.json')
    const content = await readFile(handle)
    return JSON.parse(content) as SnapshotFile
  } catch {
    // File doesn't exist yet
    return { version: 1, snapshots: [] }
  }
}

/**
 * Save snapshots to .vault-snapshot.json
 */
export async function saveSnapshots(
  rootHandle: FileSystemDirectoryHandle,
  snapshotFile: SnapshotFile
): Promise<void> {
  const handle = await getFileHandle(rootHandle, '.vault-snapshot.json', true)
  await writeFile(handle, JSON.stringify(snapshotFile, null, 2))
}

/**
 * Create a new snapshot and add/overwrite it in the snapshot file
 */
export async function createSnapshot(
  rootHandle: FileSystemDirectoryHandle,
  label: string,
  files: string[]
): Promise<void> {
  const snapshotFile = await loadSnapshots(rootHandle)
  const timestamp = new Date().toISOString()

  // Remove existing snapshot with same label, or add new one
  snapshotFile.snapshots = snapshotFile.snapshots.filter(s => s.label !== label)
  snapshotFile.snapshots.push({ label, timestamp, files })

  await saveSnapshots(rootHandle, snapshotFile)
}

/**
 * Delete a snapshot by label
 */
export async function deleteSnapshot(
  rootHandle: FileSystemDirectoryHandle,
  label: string
): Promise<void> {
  const snapshotFile = await loadSnapshots(rootHandle)
  snapshotFile.snapshots = snapshotFile.snapshots.filter(s => s.label !== label)
  await saveSnapshots(rootHandle, snapshotFile)
}
