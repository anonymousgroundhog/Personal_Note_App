import React, { useState } from 'react'
import { X, Trash2, Clipboard } from 'lucide-react'
import { useResearchStore } from './researchStore'
import { parseBibtex } from './bibtexUtils'
import type { Reference, ReferenceType } from './types'

interface Props {
  reference: Reference | null
  onClose: () => void
}

const REFERENCE_TYPES: ReferenceType[] = ['journal', 'conference', 'book', 'chapter', 'webpage', 'report', 'thesis']

const TYPE_LABELS: Record<ReferenceType, string> = {
  journal: 'Journal Article',
  conference: 'Conference Paper',
  book: 'Book',
  chapter: 'Book Chapter',
  webpage: 'Webpage',
  report: 'Report',
  thesis: 'Thesis/Dissertation',
}

export default function ReferenceForm({ reference, onClose }: Props) {
  const { addReference, updateReference, deleteReference } = useResearchStore()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showBibtexModal, setShowBibtexModal] = useState(false)
  const [bibtexInput, setBibtexInput] = useState('')
  const [bibtexError, setBibtexError] = useState<string | null>(null)

  const [title, setTitle] = useState(reference?.title ?? '')
  const [authors, setAuthors] = useState(reference?.authors ?? '')
  const [year, setYear] = useState(reference?.year?.toString() ?? '')
  const [type, setType] = useState<ReferenceType>(reference?.type ?? 'journal')
  const [source, setSource] = useState(reference?.source ?? '')
  const [url, setUrl] = useState(reference?.url ?? '')
  const [doi, setDoi] = useState(reference?.doi ?? '')
  const [abstract, setAbstract] = useState(reference?.abstract ?? '')
  const [notes, setNotes] = useState(reference?.notes ?? '')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState(reference?.tags ?? [])

  // Type-specific fields
  const [journal, setJournal] = useState(reference?.journal ?? '')
  const [volume, setVolume] = useState(reference?.volume ?? '')
  const [issue, setIssue] = useState(reference?.issue ?? '')
  const [pages, setPages] = useState(reference?.pages ?? '')
  const [issn, setIssn] = useState(reference?.issn ?? '')
  const [booktitle, setBooktitle] = useState(reference?.booktitle ?? '')
  const [address, setAddress] = useState(reference?.address ?? '')
  const [publisher, setPublisher] = useState(reference?.publisher ?? '')
  const [isbn, setIsbn] = useState(reference?.isbn ?? '')
  const [keywords, setKeywords] = useState(reference?.keywords ?? '')
  const [language, setLanguage] = useState(reference?.language ?? '')
  const [accessDate, setAccessDate] = useState(reference?.accessDate ?? '')

  const [errors, setErrors] = useState<{ title?: string }>({})

  const handleParseBibtex = () => {
    setBibtexError(null)
    const parsed = parseBibtex(bibtexInput)

    if (!parsed) {
      setBibtexError('Failed to parse BibTeX. Make sure the format is valid.')
      return
    }

    // Populate form with parsed data
    setTitle(parsed.title)
    setAuthors(parsed.authors)
    setYear(parsed.year?.toString() ?? '')
    setType(parsed.type)
    setSource(parsed.source ?? '')
    setUrl(parsed.url ?? '')
    setDoi(parsed.doi ?? '')
    setAbstract(parsed.abstract ?? '')
    setNotes(parsed.notes ?? '')
    setJournal(parsed.journal ?? '')
    setVolume(parsed.volume ?? '')
    setIssue(parsed.issue ?? '')
    setPages(parsed.pages ?? '')
    setIssn(parsed.issn ?? '')
    setBooktitle(parsed.booktitle ?? '')
    setAddress(parsed.address ?? '')
    setPublisher(parsed.publisher ?? '')
    setIsbn(parsed.isbn ?? '')
    setKeywords(parsed.keywords ?? '')
    setLanguage(parsed.language ?? '')
    setAccessDate(parsed.accessDate ?? '')

    // Close modal and reset
    setShowBibtexModal(false)
    setBibtexInput('')
  }

  const validate = () => {
    const newErrors: typeof errors = {}
    if (!title.trim()) newErrors.title = 'Title is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleAddTag = (tagText?: string) => {
    const text = tagText ?? tagInput.trim()
    if (text && !tags.includes(text)) {
      setTags([...tags, text])
      setTagInput('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  const handleSave = () => {
    if (!validate()) return

    const baseData = {
      title,
      authors,
      year: year ? parseInt(year) : undefined,
      type,
      source,
      url,
      doi,
      abstract,
      notes,
      tags,
      journal: journal || undefined,
      volume: volume || undefined,
      issue: issue || undefined,
      pages: pages || undefined,
      issn: issn || undefined,
      booktitle: booktitle || undefined,
      address: address || undefined,
      publisher: publisher || undefined,
      isbn: isbn || undefined,
      keywords: keywords || undefined,
      language: language || undefined,
      accessDate: accessDate || undefined,
    }

    if (reference) {
      updateReference(reference.id, baseData)
    } else {
      addReference(baseData)
    }
    onClose()
  }

  const handleDelete = () => {
    if (reference) {
      deleteReference(reference.id)
      onClose()
    }
  }

  const sourceLabel = {
    journal: 'Journal Name',
    conference: 'Conference Name',
    book: 'Publisher',
    chapter: 'Book Title',
    webpage: 'Website Name',
    report: 'Organization/Publisher',
    thesis: 'University',
  }[type]

  return (
    <div className="w-80 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
          {reference ? 'Edit Reference' : 'Add Reference'}
        </h3>
        <div className="flex items-center gap-2">
          {!reference && (
            <button
              onClick={() => setShowBibtexModal(true)}
              title="Paste BibTeX entry to auto-fill fields"
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-surface-700 rounded transition-colors"
            >
              <Clipboard size={14} />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Paper title"
            className={`w-full text-sm border rounded px-2.5 py-2 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 ${
              errors.title
                ? 'border-red-300 dark:border-red-600 focus:ring-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-accent-500'
            }`}
          />
          {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
        </div>

        {/* Authors */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Authors
          </label>
          <input
            type="text"
            value={authors}
            onChange={(e) => setAuthors(e.target.value)}
            placeholder="Smith, John, Doe, Jane"
            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2.5 py-2 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
        </div>

        {/* Year */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Year
          </label>
          <input
            type="number"
            min="1000"
            max="2099"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="2023"
            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2.5 py-2 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ReferenceType)}
            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2.5 py-2 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
          >
            {REFERENCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        {/* Source */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            {sourceLabel}
          </label>
          <input
            type="text"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder={sourceLabel}
            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2.5 py-2 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
        </div>

        {/* URL */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            URL
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2.5 py-2 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
        </div>

        {/* DOI */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            DOI
          </label>
          <input
            type="text"
            value={doi}
            onChange={(e) => setDoi(e.target.value)}
            placeholder="10.1234/..."
            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2.5 py-2 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
        </div>

        {/* Type-specific fields */}
        {(type === 'journal' || type === 'conference') && (
          <>
            {type === 'journal' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Volume
                  </label>
                  <input
                    type="text"
                    value={volume}
                    onChange={(e) => setVolume(e.target.value)}
                    placeholder="e.g., 110"
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2.5 py-2 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Issue
                  </label>
                  <input
                    type="text"
                    value={issue}
                    onChange={(e) => setIssue(e.target.value)}
                    placeholder="e.g., 5"
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2.5 py-2 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    ISSN
                  </label>
                  <input
                    type="text"
                    value={issn}
                    onChange={(e) => setIssn(e.target.value)}
                    placeholder="e.g., 0307-4803"
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2.5 py-2 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    Publisher
                  </label>
                  <input
                    type="text"
                    value={publisher}
                    onChange={(e) => setPublisher(e.target.value)}
                    placeholder="Publisher name"
                    className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2.5 py-2 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
                  />
                </div>
              </>
            )}
            {type === 'conference' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Conference Location
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g., New York, NY"
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2.5 py-2 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Pages
              </label>
              <input
                type="text"
                value={pages}
                onChange={(e) => setPages(e.target.value)}
                placeholder="e.g., 237--248"
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2.5 py-2 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
              />
            </div>
          </>
        )}

        {(type === 'book' || type === 'chapter') && (
          <>
            {type === 'book' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  ISBN
                </label>
                <input
                  type="text"
                  value={isbn}
                  onChange={(e) => setIsbn(e.target.value)}
                  placeholder="e.g., 978-1-891562-41-9"
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2.5 py-2 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
                />
              </div>
            )}
            {type === 'chapter' && (
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Pages
                </label>
                <input
                  type="text"
                  value={pages}
                  onChange={(e) => setPages(e.target.value)}
                  placeholder="e.g., 237--248"
                  className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2.5 py-2 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
                />
              </div>
            )}
          </>
        )}

        {type === 'webpage' && (
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
              Access Date
            </label>
            <input
              type="date"
              value={accessDate}
              onChange={(e) => setAccessDate(e.target.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2.5 py-2 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
            />
          </div>
        )}

        {/* Keywords */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Keywords
          </label>
          <input
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="Comma-separated keywords"
            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2.5 py-2 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
          />
        </div>

        {/* Abstract */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Abstract
          </label>
          <textarea
            value={abstract}
            onChange={(e) => setAbstract(e.target.value)}
            placeholder="Summary of the work..."
            rows={3}
            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2.5 py-2 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500 resize-none"
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Personal observations..."
            rows={2}
            className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2.5 py-2 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500 resize-none"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
            Tags
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 bg-accent-100 dark:bg-accent-900/30 text-accent-700 dark:text-accent-300 text-xs rounded-full"
              >
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="hover:text-accent-800 dark:hover:text-accent-200"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  handleAddTag()
                }
              }}
              placeholder="Add tag..."
              className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded px-2.5 py-1.5 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
            />
            <button
              onClick={() => handleAddTag()}
              className="px-2.5 py-1.5 text-xs font-medium text-accent-600 dark:text-accent-400 hover:bg-accent-50 dark:hover:bg-accent-900/20 rounded border border-accent-300 dark:border-accent-700"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex-shrink-0 space-y-2">
        {confirmDelete ? (
          <>
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
              Are you sure? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                className="flex-1 px-3 py-2 text-xs font-medium bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 px-3 py-2 text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-50 dark:hover:bg-surface-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              onClick={handleSave}
              className="w-full px-3 py-2 text-xs font-medium bg-accent-500 text-white rounded hover:bg-accent-600 transition-colors"
            >
              Save
            </button>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 px-3 py-2 text-xs font-medium border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 rounded hover:bg-gray-50 dark:hover:bg-surface-800 transition-colors"
              >
                Cancel
              </button>
              {reference && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* BibTeX Paste Modal */}
      {showBibtexModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-surface-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                Paste BibTeX Entry
              </h3>
              <button
                onClick={() => {
                  setShowBibtexModal(false)
                  setBibtexInput('')
                  setBibtexError(null)
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Paste a BibTeX entry below. Fields will be extracted and auto-filled in the form.
              </p>

              <textarea
                value={bibtexInput}
                onChange={(e) => {
                  setBibtexInput(e.target.value)
                  setBibtexError(null)
                }}
                placeholder="@article{key,
  title={Paper Title},
  author={Smith, John and Doe, Jane},
  journal={Journal Name},
  year={2021},
  ...
}"
                className={`w-full text-xs border rounded px-3 py-2.5 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 font-mono ${
                  bibtexError
                    ? 'border-red-300 dark:border-red-600 focus:ring-red-500'
                    : 'border-gray-300 dark:border-gray-600 focus:ring-accent-500'
                }`}
                rows={8}
              />

              {bibtexError && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded">
                  {bibtexError}
                </p>
              )}

              <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <p className="font-medium">Supported fields:</p>
                <p>title, author, year, journal, publisher, booktitle, url, doi, abstract, note</p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-2">
              <button
                onClick={handleParseBibtex}
                disabled={!bibtexInput.trim()}
                className="flex-1 px-3 py-2 text-xs font-medium bg-accent-500 text-white rounded hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Import
              </button>
              <button
                onClick={() => {
                  setShowBibtexModal(false)
                  setBibtexInput('')
                  setBibtexError(null)
                }}
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
