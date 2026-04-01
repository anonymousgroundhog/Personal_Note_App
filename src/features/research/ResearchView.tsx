import React, { useEffect, useState } from 'react'
import { Plus, Check, AlertCircle, Loader } from 'lucide-react'
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
  const { references, libraries, annotations, addReference, updateReference, deleteReference, addLibrary, addAnnotation, deleteAnnotation, getAnnotationsForRef, selectedLibraryId, setSelectedLibrary, setReferences, setLibraries, setAnnotations } = useResearchStore()
  const { rootHandle } = useVaultStore()
  const hasVault = !!rootHandle

  const [selectedRefId, setSelectedRefId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingRef, setEditingRef] = useState<Reference | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [syncMsg, setSyncMsg] = useState('')

  // Load from vault on mount
  useEffect(() => {
    if (!rootHandle) return

    const loadFromVault = async () => {
      setSyncStatus('loading')
      try {
        const handle = await getFileHandle(rootHandle, 'research/data.json', false)
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
  }, [rootHandle, setReferences, setLibraries, setAnnotations])

  // Auto-save to vault on changes (debounced)
  useEffect(() => {
    if (!hasVault || !rootHandle) return

    const timeout = setTimeout(async () => {
      setSyncStatus('saving')
      try {
        const handle = await getFileHandle(rootHandle, 'research/data.json', true)
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
  }, [references, libraries, annotations, hasVault, rootHandle])

  const saveToVault = async () => {
    if (!rootHandle || !hasVault) return

    setSyncStatus('saving')
    try {
      const handle = await getFileHandle(rootHandle, 'research/data.json', true)
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

      {/* Manual Save Button (for non-auto-save moments) */}
      {hasVault && syncStatus === 'idle' && (
        <button
          onClick={saveToVault}
          className="fixed bottom-4 right-4 z-20 px-3 py-2 text-xs font-medium bg-accent-500 text-white rounded hover:bg-accent-600 transition-colors shadow-lg"
          title="Save to vault manually"
        >
          Save to Vault
        </button>
      )}
    </div>
  )
}
