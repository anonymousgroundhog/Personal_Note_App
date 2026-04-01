import { create } from 'zustand'
import type { Reference, Library, PdfAnnotation } from './types'

interface ResearchState {
  references: Reference[]
  libraries: Library[]
  annotations: PdfAnnotation[]
  selectedLibraryId: string | null
  addReference: (partial: Omit<Reference, 'id' | 'createdAt' | 'updatedAt'>) => Reference
  updateReference: (id: string, partial: Partial<Reference>) => void
  deleteReference: (id: string) => void
  getReference: (id: string) => Reference | undefined
  addLibrary: (partial: Omit<Library, 'id' | 'createdAt' | 'updatedAt'>) => Library
  updateLibrary: (id: string, partial: Partial<Library>) => void
  deleteLibrary: (id: string) => void
  getLibrary: (id: string) => Library | undefined
  addReferenceToLibrary: (refId: string, libId: string) => void
  removeReferenceFromLibrary: (refId: string, libId: string) => void
  setSelectedLibrary: (libId: string | null) => void
  addAnnotation: (partial: Omit<PdfAnnotation, 'id' | 'createdAt'>) => PdfAnnotation
  deleteAnnotation: (id: string) => void
  getAnnotationsForRef: (refId: string, page?: number) => PdfAnnotation[]
  setReferences: (references: Reference[]) => void
  setLibraries: (libraries: Library[]) => void
  setAnnotations: (annotations: PdfAnnotation[]) => void
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const useResearchStore = create<ResearchState>((set) => {
  return {
    references: [],
    libraries: [],
    annotations: [],
    selectedLibraryId: null,

    addReference: (partial) => {
      const reference: Reference = {
        ...partial,
        id: generateId('ref'),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      set((s) => ({
        references: [...s.references, reference],
      }))
      return reference
    },

    updateReference: (id, partial) => {
      set((s) => ({
        references: s.references.map((r) =>
          r.id === id ? { ...r, ...partial, updatedAt: Date.now() } : r
        ),
      }))
    },

    deleteReference: (id) => {
      set((s) => ({
        references: s.references.filter((r) => r.id !== id),
        annotations: s.annotations.filter((a) => a.referenceId !== id),
        libraries: s.libraries.map((lib) => ({
          ...lib,
          referenceIds: lib.referenceIds.filter((refId) => refId !== id),
        })),
      }))
    },

    getReference: (id) => {
      // Note: get() will be injected by zustand at call time
      const store = useResearchStore.getState()
      return store.references.find((r) => r.id === id)
    },

    addLibrary: (partial) => {
      const library: Library = {
        ...partial,
        id: generateId('lib'),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      set((s) => ({
        libraries: [...s.libraries, library],
      }))
      return library
    },

    updateLibrary: (id, partial) => {
      set((s) => ({
        libraries: s.libraries.map((lib) =>
          lib.id === id ? { ...lib, ...partial, updatedAt: Date.now() } : lib
        ),
      }))
    },

    deleteLibrary: (id) => {
      set((s) => ({
        libraries: s.libraries.filter((lib) => lib.id !== id),
        selectedLibraryId: s.selectedLibraryId === id ? null : s.selectedLibraryId,
      }))
    },

    getLibrary: (id) => {
      const store = useResearchStore.getState()
      return store.libraries.find((lib) => lib.id === id)
    },

    addReferenceToLibrary: (refId, libId) => {
      set((s) => ({
        libraries: s.libraries.map((lib) =>
          lib.id === libId && !lib.referenceIds.includes(refId)
            ? { ...lib, referenceIds: [...lib.referenceIds, refId], updatedAt: Date.now() }
            : lib
        ),
      }))
    },

    removeReferenceFromLibrary: (refId, libId) => {
      set((s) => ({
        libraries: s.libraries.map((lib) =>
          lib.id === libId
            ? { ...lib, referenceIds: lib.referenceIds.filter((r) => r !== refId), updatedAt: Date.now() }
            : lib
        ),
      }))
    },

    setSelectedLibrary: (libId) => {
      set({ selectedLibraryId: libId })
    },

    addAnnotation: (partial) => {
      const annotation: PdfAnnotation = {
        ...partial,
        id: generateId('ann'),
        createdAt: Date.now(),
      }
      set((s) => ({
        annotations: [...s.annotations, annotation],
      }))
      return annotation
    },

    deleteAnnotation: (id) => {
      set((s) => ({
        annotations: s.annotations.filter((a) => a.id !== id),
      }))
    },

    getAnnotationsForRef: (refId, page) => {
      const store = useResearchStore.getState()
      return store.annotations.filter(
        (a) => a.referenceId === refId && (page === undefined || a.page === page)
      )
    },

    setReferences: (references) => {
      set({ references })
    },

    setLibraries: (libraries) => {
      set({ libraries })
    },

    setAnnotations: (annotations) => {
      set({ annotations })
    },
  }
})
