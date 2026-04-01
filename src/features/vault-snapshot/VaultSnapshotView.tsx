import React, { useState, useEffect } from 'react'
import { useVaultStore } from '../../stores/vaultStore'
import { Save, RefreshCw, Trash2 } from 'lucide-react'
import {
  scanAllPaths,
  diffSnapshots,
  loadSnapshots,
  createSnapshot,
  deleteSnapshot,
  type SnapshotFile,
} from './vaultSnapshotUtils'

type Tab = 'save' | 'compare'

export default function VaultSnapshotView() {
  const { rootHandle, fallbackMode } = useVaultStore()
  const [activeTab, setActiveTab] = useState<Tab>('save')

  // Save Snapshot state
  const [label, setLabel] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scannedCount, setScannedCount] = useState<number | null>(null)
  const [saveError, setSaveError] = useState('')

  // Compare state
  const [snapshots, setSnapshots] = useState<SnapshotFile>({ version: 1, snapshots: [] })
  const [selectedLabel, setSelectedLabel] = useState('')
  const [comparing, setComparing] = useState(false)
  const [diffResult, setDiffResult] = useState<{
    added: string[]
    removed: string[]
    unchanged: string[]
  } | null>(null)
  const [compareError, setCompareError] = useState('')

  // Load snapshots on mount
  useEffect(() => {
    if (!rootHandle) return
    loadSnapshots(rootHandle).then(setSnapshots)
  }, [rootHandle])

  const handleSaveSnapshot = async () => {
    if (!rootHandle) {
      setSaveError('No vault open')
      return
    }
    if (!label.trim()) {
      setSaveError('Please enter a label')
      return
    }

    setSaveError('')
    setScanning(true)
    try {
      const files = await scanAllPaths(rootHandle)
      setScannedCount(files.length)
      await createSnapshot(rootHandle, label.trim(), files)
      setLabel('')
      // Reload snapshots
      const updated = await loadSnapshots(rootHandle)
      setSnapshots(updated)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save snapshot')
    } finally {
      setScanning(false)
    }
  }

  const handleCompare = async () => {
    if (!rootHandle) {
      setCompareError('No vault open')
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
      const current = await scanAllPaths(rootHandle)
      const diff = diffSnapshots(snapshot.files, current)
      setDiffResult(diff)
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : 'Failed to compare')
    } finally {
      setComparing(false)
    }
  }

  const handleDeleteSnapshot = async () => {
    if (!rootHandle || !selectedLabel) return
    try {
      await deleteSnapshot(rootHandle, selectedLabel)
      const updated = await loadSnapshots(rootHandle)
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
          {fallbackMode ? (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg text-amber-700 dark:text-amber-300 mb-6">
              <p className="font-medium mb-1">Read-Only Mode</p>
              <p className="text-sm">
                Snapshots can be viewed but not created in fallback mode. Use a browser with File System Access API support.
              </p>
            </div>
          ) : null}

          {/* Save Snapshot Tab */}
          {activeTab === 'save' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Save Snapshot</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Create a snapshot of your vault's file structure. This can be compared later to identify changes across
                  systems.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Snapshot Label (optional)
                    </label>
                    <input
                      type="text"
                      value={label}
                      onChange={e => setLabel(e.target.value)}
                      placeholder="e.g., laptop, work-pc"
                      disabled={scanning || fallbackMode}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-surface-800 text-gray-900 dark:text-white placeholder-gray-400 disabled:opacity-50"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      If empty, will use current timestamp
                    </p>
                  </div>

                  <button
                    onClick={handleSaveSnapshot}
                    disabled={scanning || fallbackMode || !rootHandle}
                    className="flex items-center gap-2 px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                      ✓ Saved! Found <span className="font-semibold">{scannedCount}</span> files.
                    </div>
                  )}

                  {saveError && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
                      {saveError}
                    </div>
                  )}
                </div>
              </div>

              {snapshots.snapshots.length > 0 && (
                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Saved Snapshots</h3>
                  <div className="space-y-2">
                    {snapshots.snapshots.map(snapshot => (
                      <div
                        key={snapshot.label}
                        className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                      >
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">{snapshot.label}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {new Date(snapshot.timestamp).toLocaleString()} • {snapshot.files.length} files
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Compare Tab */}
          {activeTab === 'compare' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Compare Snapshots</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Compare a saved snapshot with the current vault structure to see what has changed.
                </p>

                {snapshots.snapshots.length === 0 ? (
                  <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-400">
                    No snapshots saved yet. Create one on the Save Snapshot tab first.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Select Snapshot
                      </label>
                      <select
                        value={selectedLabel}
                        onChange={e => {
                          setSelectedLabel(e.target.value)
                          setDiffResult(null)
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-surface-800 text-gray-900 dark:text-white"
                      >
                        <option value="">-- Choose a snapshot --</option>
                        {snapshots.snapshots.map(s => (
                          <option key={s.label} value={s.label}>
                            {s.label} ({new Date(s.timestamp).toLocaleString()})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleCompare}
                        disabled={comparing || !selectedLabel}
                        className="flex items-center gap-2 px-4 py-2 bg-accent-500 text-white rounded-lg hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {comparing ? (
                          <>
                            <RefreshCw size={18} className="animate-spin" />
                            Comparing...
                          </>
                        ) : (
                          <>
                            <RefreshCw size={18} />
                            Compare with Current
                          </>
                        )}
                      </button>
                      <button
                        onClick={handleDeleteSnapshot}
                        disabled={!selectedLabel}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        <Trash2 size={18} />
                        Delete
                      </button>
                    </div>

                    {compareError && (
                      <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg text-red-700 dark:text-red-300 text-sm">
                        {compareError}
                      </div>
                    )}
                  </div>
                )}
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
