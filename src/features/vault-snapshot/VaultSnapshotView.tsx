import React, { useState } from 'react'
import { Save, RefreshCw, Trash2, FolderOpen } from 'lucide-react'
import {
  scanAllPaths,
  diffSnapshots,
  loadSnapshots,
  createSnapshot,
  deleteSnapshot,
  getDirectoryName,
  type SnapshotFile,
} from './vaultSnapshotUtils'

type Tab = 'save' | 'compare'

function isFsApiSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window
}

export default function VaultSnapshotView() {
  const [activeTab, setActiveTab] = useState<Tab>('save')
  const fsSupported = isFsApiSupported()

  // Save Snapshot state
  const [chosenDir, setChosenDir] = useState<FileSystemDirectoryHandle | null>(null)
  const [chosenDirName, setChosenDirName] = useState('')
  const [label, setLabel] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scannedCount, setScannedCount] = useState<number | null>(null)
  const [saveError, setSaveError] = useState('')

  // Compare state
  const [snapshotDir, setSnapshotDir] = useState<FileSystemDirectoryHandle | null>(null)
  const [snapshots, setSnapshots] = useState<SnapshotFile>({ version: 1, snapshots: [] })
  const [selectedLabel, setSelectedLabel] = useState('')
  const [compareDir, setCompareDir] = useState<FileSystemDirectoryHandle | null>(null)
  const [compareDirName, setCompareDirName] = useState('')
  const [comparing, setComparing] = useState(false)
  const [diffResult, setDiffResult] = useState<{
    added: string[]
    removed: string[]
    unchanged: string[]
  } | null>(null)
  const [compareError, setCompareError] = useState('')

  // Save tab handlers
  const handleChooseSaveDir = async () => {
    try {
      const dir = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> })
        .showDirectoryPicker()
      setChosenDir(dir)
      setChosenDirName(getDirectoryName(dir))
      setSaveError('')
      setScannedCount(null)
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setSaveError(err.message)
      }
    }
  }

  const handleSaveSnapshot = async () => {
    if (!chosenDir) {
      setSaveError('Please choose a directory first')
      return
    }

    const finalLabel = label.trim() || chosenDirName
    setSaveError('')
    setScanning(true)

    try {
      const files = await scanAllPaths(chosenDir)
      setScannedCount(files.length)
      await createSnapshot(chosenDir, finalLabel, chosenDirName, files)
      setLabel('')
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save snapshot')
    } finally {
      setScanning(false)
    }
  }

  // Compare tab handlers
  const handleLoadSnapshotDir = async () => {
    try {
      const dir = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> })
        .showDirectoryPicker()
      setSnapshotDir(dir)
      setSelectedLabel('')
      setDiffResult(null)
      setCompareError('')

      const loaded = await loadSnapshots(dir)
      setSnapshots(loaded)
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setCompareError(err.message)
      }
    }
  }

  const handleChooseCompareDir = async () => {
    try {
      const dir = await (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> })
        .showDirectoryPicker()
      setCompareDir(dir)
      setCompareDirName(getDirectoryName(dir))
      setCompareError('')
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setCompareError(err.message)
      }
    }
  }

  const handleCompare = async () => {
    if (!compareDir) {
      setCompareError('Please choose a directory to compare')
      return
    }
    if (!selectedLabel) {
      setCompareError('Please select a snapshot')
      return
    }

    const snapshot = snapshots.snapshots.find(s => s.label === selectedLabel)
    if (!snapshot) {
      setCompareError('Snapshot not found')
      return
    }

    setCompareError('')
    setComparing(true)
    try {
      const current = await scanAllPaths(compareDir)
      const diff = diffSnapshots(snapshot.files, current)
      setDiffResult(diff)
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : 'Failed to compare')
    } finally {
      setComparing(false)
    }
  }

  const handleDeleteSnapshot = async () => {
    if (!snapshotDir || !selectedLabel) return
    try {
      await deleteSnapshot(snapshotDir, selectedLabel)
      const updated = await loadSnapshots(snapshotDir)
      setSnapshots(updated)
      setSelectedLabel('')
      setDiffResult(null)
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : 'Failed to delete snapshot')
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-surface-900">
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700 px-4 flex-shrink-0">
        {(['save', 'compare'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-accent-500 text-accent-500'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
            }`}
          >
            {tab === 'save' ? 'Save Snapshot' : 'Compare'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6">
          {!fsSupported && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-amber-700 dark:text-amber-300 mb-6">
              <p className="font-medium mb-1">File System Access Required</p>
              <p className="text-sm">
                This tool requires a browser with File System Access API support (Chrome, Edge, Opera). Use one of these browsers to create and compare snapshots.
              </p>
            </div>
          )}

          {/* Save Snapshot Tab */}
          {activeTab === 'save' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Save Snapshot</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Choose any directory to create a snapshot of its file structure. A <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm">.vault-snapshot.json</code> file will be saved inside that directory so it travels with your files.
                </p>

                <div className="space-y-4">
                  {/* Choose Directory */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Directory
                    </label>
                    {chosenDir ? (
                      <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg mb-2">
                        <FolderOpen size={18} className="text-green-600 dark:text-green-400 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-medium text-green-700 dark:text-green-300">{chosenDirName}</p>
                          <p className="text-xs text-green-600 dark:text-green-400">Ready to scan and save</p>
                        </div>
                      </div>
                    ) : null}
                    <button
                      onClick={handleChooseSaveDir}
                      disabled={!fsSupported || scanning}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-accent-500 dark:hover:border-accent-500 hover:bg-accent-50 dark:hover:bg-accent-900/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-700 dark:text-gray-300"
                    >
                      <FolderOpen size={18} />
                      {chosenDir ? 'Choose Different Directory' : 'Choose Directory'}
                    </button>
                  </div>

                  {/* Label */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Snapshot Label (optional)
                    </label>
                    <input
                      type="text"
                      value={label}
                      onChange={e => setLabel(e.target.value)}
                      placeholder={chosenDirName ? `Default: ${chosenDirName}` : 'e.g., laptop, work-pc'}
                      disabled={!chosenDir || scanning}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-surface-800 text-gray-900 dark:text-white placeholder-gray-400 disabled:opacity-50"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Leave empty to use the folder name
                    </p>
                  </div>

                  {/* Scan & Save Button */}
                  <button
                    onClick={handleSaveSnapshot}
                    disabled={!chosenDir || scanning || !fsSupported}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {scanning ? (
                      <>
                        <RefreshCw size={18} className="animate-spin" />
                        Scanning...
                      </>
                    ) : (
                      <>
                        <Save size={18} />
                        Scan & Save
                      </>
                    )}
                  </button>

                  {scannedCount !== null && (
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg text-green-700 dark:text-green-300 text-sm">
                      ✓ Saved! Found <span className="font-semibold">{scannedCount}</span> files in {chosenDirName}.
                    </div>
                  )}

                  {saveError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
                      {saveError}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Compare Tab */}
          {activeTab === 'compare' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Compare Snapshots</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Load a saved snapshot from one directory and compare it against another directory's current state.
                </p>

                <div className="space-y-6">
                  {/* Step 1: Load Snapshot */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent-500 text-white text-xs font-bold">1</span>
                      Load Snapshot File
                    </h3>
                    {snapshotDir ? (
                      <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg mb-3">
                        <FolderOpen size={18} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        <p className="font-medium text-blue-700 dark:text-blue-300">
                          Loaded from: {getDirectoryName(snapshotDir)}
                        </p>
                      </div>
                    ) : null}
                    <button
                      onClick={handleLoadSnapshotDir}
                      disabled={!fsSupported}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-accent-500 dark:hover:border-accent-500 hover:bg-accent-50 dark:hover:bg-accent-900/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-700 dark:text-gray-300"
                    >
                      <FolderOpen size={18} />
                      {snapshotDir ? 'Choose Different Directory' : 'Choose Directory'}
                    </button>
                  </div>

                  {/* Step 2: Select Snapshot */}
                  {snapshots.snapshots.length > 0 && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent-500 text-white text-xs font-bold">2</span>
                        Select Snapshot
                      </h3>
                      <select
                        value={selectedLabel}
                        onChange={e => {
                          setSelectedLabel(e.target.value)
                          setDiffResult(null)
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-surface-800 text-gray-900 dark:text-white mb-2"
                      >
                        <option value="">-- Choose a snapshot --</option>
                        {snapshots.snapshots.map(s => (
                          <option key={s.label} value={s.label}>
                            {s.label} • {new Date(s.timestamp).toLocaleString()} ({s.files.length} files)
                          </option>
                        ))}
                      </select>
                      <div className="space-y-2">
                        {snapshots.snapshots.map(snapshot => (
                          <div
                            key={snapshot.label}
                            className={`p-2 rounded text-sm cursor-pointer transition-colors ${
                              selectedLabel === snapshot.label
                                ? 'bg-accent-100 dark:bg-accent-900/30 border border-accent-300 dark:border-accent-600'
                                : 'text-gray-600 dark:text-gray-400'
                            }`}
                          >
                            <div className="font-medium text-gray-900 dark:text-white">{snapshot.label}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(snapshot.timestamp).toLocaleString()} • {snapshot.files.length} files • From: {snapshot.dirName}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {snapshots.snapshots.length === 0 && snapshotDir && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400 text-sm">
                      No snapshots found in this directory. Go to Save Snapshot tab to create one.
                    </div>
                  )}

                  {/* Step 3: Choose Compare Directory */}
                  {selectedLabel && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-accent-500 text-white text-xs font-bold">3</span>
                        Choose Directory to Compare
                      </h3>
                      {compareDir ? (
                        <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg mb-3">
                          <FolderOpen size={18} className="text-purple-600 dark:text-purple-400 flex-shrink-0" />
                          <p className="font-medium text-purple-700 dark:text-purple-300">{compareDirName}</p>
                        </div>
                      ) : null}
                      <button
                        onClick={handleChooseCompareDir}
                        disabled={!fsSupported}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-accent-500 dark:hover:border-accent-500 hover:bg-accent-50 dark:hover:bg-accent-900/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-gray-700 dark:text-gray-300 mb-3"
                      >
                        <FolderOpen size={18} />
                        {compareDir ? 'Choose Different Directory' : 'Choose Directory'}
                      </button>
                      <button
                        onClick={handleCompare}
                        disabled={!compareDir || comparing || !fsSupported}
                        className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                      >
                        {comparing ? (
                          <>
                            <RefreshCw size={18} className="animate-spin" />
                            Comparing...
                          </>
                        ) : (
                          <>
                            <RefreshCw size={18} />
                            Compare
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Delete Snapshot Button */}
                  {selectedLabel && (
                    <button
                      onClick={handleDeleteSnapshot}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      <Trash2 size={18} />
                      Delete This Snapshot
                    </button>
                  )}

                  {compareError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
                      {compareError}
                    </div>
                  )}
                </div>
              </div>

              {/* Diff Results */}
              {diffResult && (
                <div className="space-y-4 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Results</h3>

                  {/* Added */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-green-600 dark:text-green-400 font-semibold">+ Added</span>
                      <span className="text-sm text-gray-500">({diffResult.added.length})</span>
                    </div>
                    {diffResult.added.length > 0 ? (
                      <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-700 rounded-lg p-3 max-h-48 overflow-auto">
                        <ul className="space-y-1 text-sm">
                          {diffResult.added.map(file => (
                            <li key={file} className="text-green-700 dark:text-green-300 font-mono text-xs break-all">
                              {file}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-sm">None</p>
                    )}
                  </div>

                  {/* Removed */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-red-600 dark:text-red-400 font-semibold">- Removed</span>
                      <span className="text-sm text-gray-500">({diffResult.removed.length})</span>
                    </div>
                    {diffResult.removed.length > 0 ? (
                      <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-700 rounded-lg p-3 max-h-48 overflow-auto">
                        <ul className="space-y-1 text-sm">
                          {diffResult.removed.map(file => (
                            <li key={file} className="text-red-700 dark:text-red-300 font-mono text-xs break-all">
                              {file}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-gray-500 dark:text-gray-400 text-sm">None</p>
                    )}
                  </div>

                  {/* Unchanged */}
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <p className="text-gray-700 dark:text-gray-300 text-sm">
                      <span className="font-semibold">{diffResult.unchanged.length}</span> files unchanged
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
