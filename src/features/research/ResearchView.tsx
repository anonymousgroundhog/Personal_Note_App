import React, { useEffect, useState } from 'react'
import { Plus, Check, AlertCircle, Loader, Settings, X } from 'lucide-react'
import { useResearchStore } from './researchStore'
import { useVaultStore } from '../../stores/vaultStore'
import { getFileHandle, readFile, writeFile } from '../../lib/fs/fileSystemApi'
import ReferenceList from './ReferenceList'
import ReferenceDetail from './ReferenceDetail'
import ReferenceForm from './ReferenceForm'
import PdfViewer from './PdfViewer'
import type { Reference, Library } from './types'

type SyncStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error'

export default function ResearchView() {
  const { references, libraries, annotations, config, addReference, updateReference, deleteReference, addLibrary, addAnnotation, deleteAnnotation, getAnnotationsForRef, selectedLibraryId, setSelectedLibrary, setReferences, setLibraries, setAnnotations } = useResearchStore()
  const { rootHandle } = useVaultStore()
  const hasVault = !!rootHandle

  const { setConfig } = useResearchStore()
  const [selectedRefId, setSelectedRefId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingRef, setEditingRef] = useState<Reference | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [syncMsg, setSyncMsg] = useState('')
  const [showSettings, setShowSettings] = useState(false)
  const [settingsDataPath, setSettingsDataPath] = useState(config.dataPath)
  const [settingsPdfPath, setSettingsPdfPath] = useState(config.pdfPath)

  // Sync settings state with store config
  useEffect(() => {
    setSettingsDataPath(config.dataPath)
    setSettingsPdfPath(config.pdfPath)
  }, [config.dataPath, config.pdfPath])

  // Load from vault on mount
  useEffect(() => {
    if (!rootHandle) return

    const loadFromVault = async () => {
      setSyncStatus('loading')
      try {
        const handle = await getFileHandle(rootHandle, config.dataPath, false)
        const data = JSON.parse(await readFile(handle))

        // Load references
        if (data.references && Array.isArray(data.references)) {
          setReferences(data.references)
        }

        // Load libraries
        if (data.libraries && Array.isArray(data.libraries)) {
          setLibraries(data.libraries)
        }

        // Load annotations
        if (data.annotations && Array.isArray(data.annotations)) {
          setAnnotations(data.annotations)
        }

        setSyncStatus('idle')
      } catch (err) {
        // File doesn't exist or error reading, ignore
        setSyncStatus('idle')
      }
    }

    loadFromVault()
  }, [rootHandle, config.dataPath, setReferences, setLibraries, setAnnotations])

  // Auto-save to vault on changes (debounced)
  useEffect(() => {
    if (!hasVault || !rootHandle) return

    const timeout = setTimeout(async () => {
      setSyncStatus('saving')
      try {
        const handle = await getFileHandle(rootHandle, config.dataPath, true)
        const data = {
          references,
          libraries,
          annotations,
          savedAt: new Date().toISOString(),
        }
        await writeFile(handle, JSON.stringify(data, null, 2))
        setSyncStatus('saved')
        setSyncMsg('Saved to vault')
        setTimeout(() => setSyncStatus('idle'), 2000)
      } catch (err) {
        setSyncStatus('error')
        setSyncMsg(`Save error: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }, 2000) // 2-second debounce

    return () => clearTimeout(timeout)
  }, [references, libraries, annotations, hasVault, rootHandle, config.dataPath])

  const saveToVault = async () => {
    if (!rootHandle || !hasVault) return

    setSyncStatus('saving')
    try {
      const handle = await getFileHandle(rootHandle, config.dataPath, true)
      const data = {
        references,
        libraries,
        annotations,
        savedAt: new Date().toISOString(),
      }
      await writeFile(handle, JSON.stringify(data, null, 2))
      setSyncStatus('saved')
      setSyncMsg('Saved to vault')
      setTimeout(() => setSyncStatus('idle'), 2000)
    } catch (err) {
      setSyncStatus('error')
      setSyncMsg(`Save error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  const handleAddReference = () => {
    setEditingRef(null)
    setShowForm(true)
  }

  const handleEditReference = (ref: Reference) => {
    setEditingRef(ref)
    setShowForm(true)
  }

  const handleDeleteReference = () => {
    if (selectedRefId) {
      deleteReference(selectedRefId)
      setSelectedRefId(null)
    }
  }

  const handleFormClose = () => {
    setShowForm(false)
    setEditingRef(null)
  }

  const handleSaveSettings = () => {
    setConfig({
      dataPath: settingsDataPath || 'research/data.json',
      pdfPath: settingsPdfPath || 'research/pdfs',
    })
    setShowSettings(false)
  }

  const selectedRef = selectedRefId ? references.find((r) => r.id === selectedRefId) : null
  const pageAnnotations = selectedRef ? getAnnotationsForRef(selectedRef.id) : []

  return (
    <div className="flex h-full overflow-hidden bg-white dark:bg-surface-900">
      {/* Left Panel: Reference List */}
      <ReferenceList
        selectedId={selectedRefId}
        onSelect={setSelectedRefId}
        onAdd={handleAddReference}
        selectedLibraryId={selectedLibraryId}
        onSelectLibrary={setSelectedLibrary}
      />

      {/* Center Panel: Reference Detail or Empty State */}
      {selectedRef ? (
        <ReferenceDetail
          referenceId={selectedRef.id}
          onEdit={handleEditReference}
          onDelete={handleDeleteReference}
        />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
          <div className="text-center space-y-3">
            <p className="text-lg font-medium">No reference selected</p>
            <p className="text-sm">Select a reference from the list or click + Add to create one</p>
          </div>
        </div>
      )}

      {/* Right Panel: Edit Form */}
      {showForm && (
        <ReferenceForm
          key={`form-${editingRef?.id || 'new'}`}
          reference={editingRef}
          onClose={handleFormClose}
        />
      )}

      {/* Sync Status Bar */}
      {hasVault && (
        <div className="fixed bottom-4 right-4 z-20">
          {syncStatus === 'saving' && (
            <div className="flex items-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-lg shadow-lg">
              <Loader size={16} className="animate-spin" />
              <span className="text-sm font-medium">Saving...</span>
            </div>
          )}
          {syncStatus === 'saved' && (
            <div className="flex items-center gap-2 px-4 py-3 bg-green-500 text-white rounded-lg shadow-lg">
              <Check size={16} />
              <span className="text-sm font-medium">{syncMsg}</span>
            </div>
          )}
          {syncStatus === 'error' && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-500 text-white rounded-lg shadow-lg">
              <AlertCircle size={16} />
              <span className="text-sm font-medium">{syncMsg}</span>
            </div>
          )}
        </div>
      )}

      {/* Manual Save Button and Settings Button */}
      <div className="fixed bottom-4 right-4 z-20 flex gap-2">
        {hasVault && syncStatus === 'idle' && (
          <button
            onClick={saveToVault}
            className="px-3 py-2 text-xs font-medium bg-accent-500 text-white rounded hover:bg-accent-600 transition-colors shadow-lg"
            title="Save to vault manually"
          >
            Save to Vault
          </button>
        )}
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 text-gray-600 dark:text-gray-400 bg-white dark:bg-surface-800 rounded hover:bg-gray-100 dark:hover:bg-surface-700 transition-colors shadow-lg border border-gray-200 dark:border-gray-700"
          title="Settings"
        >
          <Settings size={16} />
        </button>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-surface-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-sm">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Research Settings
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Configure where research data and PDFs are stored in your vault.
              </p>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Data File Path
                </label>
                <input
                  type="text"
                  value={settingsDataPath}
                  onChange={(e) => setSettingsDataPath(e.target.value)}
                  placeholder="e.g., research/data.json"
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Where reference data (as JSON) is stored
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  PDF Folder Path
                </label>
                <input
                  type="text"
                  value={settingsPdfPath}
                  onChange={(e) => setSettingsPdfPath(e.target.value)}
                  placeholder="e.g., research/pdfs"
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Folder where attached PDF files are stored
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
              <button
                onClick={handleSaveSettings}
                className="flex-1 px-3 py-2 text-xs font-medium bg-accent-500 text-white rounded hover:bg-accent-600 transition-colors"
              >
                Save
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 px-3 py-2 text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-50 dark:hover:bg-surface-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
