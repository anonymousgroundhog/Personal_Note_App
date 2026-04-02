import React, { useState } from 'react'
import { X, Trash2, Clipboard, ChevronDown } from 'lucide-react'
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

interface FormSectionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}

function FormSection({ title, children, defaultOpen = true }: FormSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-0 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 transition-colors"
      >
        {title}
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && <div className="space-y-3 pt-3">{children}</div>}
    </div>
  )
}

interface FieldInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  optional?: boolean
}

function FieldInput({ label, value, onChange, placeholder, type = 'text', optional = true }: FieldInputProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
        {label}
        {!optional && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2.5 py-2 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500"
      />
    </div>
  )
}

export default function ReferenceForm({ reference, onClose }: Props) {
  const { addReference, updateReference, deleteReference } = useResearchStore()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showBibtexModal, setShowBibtexModal] = useState(false)
  const [bibtexInput, setBibtexInput] = useState('')
  const [bibtexError, setBibtexError] = useState<string | null>(null)

  // Core Info
  const [title, setTitle] = useState(reference?.title ?? '')
  const [authors, setAuthors] = useState(reference?.authors ?? '')
  const [year, setYear] = useState(reference?.year?.toString() ?? '')
  const [type, setType] = useState<ReferenceType>(reference?.type ?? 'journal')
  const [source, setSource] = useState(reference?.source ?? '')

  // Series Data
  const [series, setSeries] = useState(reference?.series ?? '')
  const [seriesTitle, setSeriesTitle] = useState(reference?.seriesTitle ?? '')
  const [seriesText, setSeriesText] = useState(reference?.seriesText ?? '')
  const [seriesNumber, setSeriesNumber] = useState(reference?.seriesNumber ?? '')

  // Identifiers
  const [doi, setDoi] = useState(reference?.doi ?? '')
  const [issn, setIssn] = useState(reference?.issn ?? '')
  const [isbn, setIsbn] = useState(reference?.isbn ?? '')
  const [journalAbbr, setJournalAbbr] = useState(reference?.journalAbbr ?? '')

  // Physical/ID
  const [pages, setPages] = useState(reference?.pages ?? '')
  const [language, setLanguage] = useState(reference?.language ?? '')
  const [volume, setVolume] = useState(reference?.volume ?? '')
  const [issue, setIssue] = useState(reference?.issue ?? '')

  // Digital/Locational
  const [shortTitle, setShortTitle] = useState(reference?.shortTitle ?? '')
  const [url, setUrl] = useState(reference?.url ?? '')
  const [accessed, setAccessed] = useState(reference?.accessed ?? '')
  const [archive, setArchive] = useState(reference?.archive ?? '')
  const [locInArchive, setLocInArchive] = useState(reference?.locInArchive ?? '')

  // Management
  const [libraryTags, setLibraryTags] = useState(reference?.libraryTags ?? '')
  const [callNumber, setCallNumber] = useState(reference?.callNumber ?? '')
  const [rights, setRights] = useState(reference?.rights ?? '')
  const [extra, setExtra] = useState(reference?.extra ?? '')

  // Type-specific fields
  const [journal, setJournal] = useState(reference?.journal ?? '')
  const [booktitle, setBooktitle] = useState(reference?.booktitle ?? '')
  const [conference, setConference] = useState(reference?.conference ?? '')
  const [address, setAddress] = useState(reference?.address ?? '')
  const [publisher, setPublisher] = useState(reference?.publisher ?? '')

  // General fields
  const [keywords, setKeywords] = useState(reference?.keywords ?? '')
  const [abstract, setAbstract] = useState(reference?.abstract ?? '')
  const [notes, setNotes] = useState(reference?.notes ?? '')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState(reference?.tags ?? [])

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
    setAccessed(parsed.accessDate ?? '')

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
      // Series Data
      series: series || undefined,
      seriesTitle: seriesTitle || undefined,
      seriesText: seriesText || undefined,
      seriesNumber: seriesNumber || undefined,
      // Identifiers
      issn: issn || undefined,
      isbn: isbn || undefined,
      journalAbbr: journalAbbr || undefined,
      // Physical/ID
      pages: pages || undefined,
      language: language || undefined,
      volume: volume || undefined,
      issue: issue || undefined,
      // Digital/Locational
      shortTitle: shortTitle || undefined,
      accessed: accessed || undefined,
      archive: archive || undefined,
      locInArchive: locInArchive || undefined,
      // Management
      libraryTags: libraryTags || undefined,
      callNumber: callNumber || undefined,
      rights: rights || undefined,
      extra: extra || undefined,
      // Type-specific
      journal: journal || undefined,
      booktitle: booktitle || undefined,
      conference: conference || undefined,
      address: address || undefined,
      publisher: publisher || undefined,
      // General
      keywords: keywords || undefined,
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
    <div className="w-96 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-surface-900 flex flex-col overflow-hidden">
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
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {/* Type Selection */}
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

        {/* Core Info Section */}
        <FormSection title="Core Info">
          <FieldInput
            label="Title"
            value={title}
            onChange={setTitle}
            placeholder="Paper title"
            optional={false}
          />
          <FieldInput label="Authors" value={authors} onChange={setAuthors} placeholder="Smith, John, Doe, Jane" />
          <FieldInput label="Year" value={year} onChange={setYear} placeholder="2023" type="number" />
          <FieldInput label={sourceLabel || 'Source'} value={source} onChange={setSource} placeholder={sourceLabel} />
        </FormSection>

        {/* Series Data Section */}
        <FormSection title="Series Data" defaultOpen={false}>
          <FieldInput label="Series" value={series} onChange={setSeries} />
          <FieldInput label="Series Title" value={seriesTitle} onChange={setSeriesTitle} />
          <FieldInput label="Series Number" value={seriesNumber} onChange={setSeriesNumber} />
          <FieldInput label="Series Text" value={seriesText} onChange={setSeriesText} />
        </FormSection>

        {/* Identifiers Section */}
        <FormSection title="Identifiers" defaultOpen={false}>
          <FieldInput label="DOI" value={doi} onChange={setDoi} placeholder="10.1234/..." />
          <FieldInput label="ISSN" value={issn} onChange={setIssn} placeholder="e.g., 0307-4803" />
          <FieldInput label="ISBN" value={isbn} onChange={setIsbn} placeholder="e.g., 978-1-891562-41-9" />
          <FieldInput label="Journal Abbreviation" value={journalAbbr} onChange={setJournalAbbr} />
        </FormSection>

        {/* Type-specific Fields */}
        {(type === 'journal' || type === 'conference') && (
          <FormSection title="Publication Details" defaultOpen={true}>
            {type === 'journal' && (
              <>
                <FieldInput label="Journal Name" value={journal} onChange={setJournal} />
              </>
            )}
            {type === 'conference' && (
              <>
                <FieldInput label="Conference Name" value={conference} onChange={setConference} />
                <FieldInput label="Proceedings Title" value={booktitle} onChange={setBooktitle} />
                <FieldInput label="Location" value={address} onChange={setAddress} placeholder="e.g., New York, NY" />
              </>
            )}
            <FieldInput label="Volume" value={volume} onChange={setVolume} placeholder="e.g., 110" />
            <FieldInput label="Issue" value={issue} onChange={setIssue} placeholder="e.g., 5" />
            <FieldInput label="Pages" value={pages} onChange={setPages} placeholder="e.g., 237--248" />
            <FieldInput label="Publisher" value={publisher} onChange={setPublisher} />
          </FormSection>
        )}

        {(type === 'book' || type === 'chapter') && (
          <FormSection title="Publication Details" defaultOpen={true}>
            {type === 'book' && (
              <>
                <FieldInput label="Publisher" value={publisher} onChange={setPublisher} />
              </>
            )}
            {type === 'chapter' && (
              <>
                <FieldInput label="Book Title" value={booktitle} onChange={setBooktitle} />
              </>
            )}
            <FieldInput label="Volume" value={volume} onChange={setVolume} />
            <FieldInput label="Pages" value={pages} onChange={setPages} placeholder="e.g., 237--248" />
          </FormSection>
        )}

        {type === 'report' && (
          <FormSection title="Publication Details" defaultOpen={true}>
            <FieldInput label="Institution" value={source} onChange={setSource} />
            <FieldInput label="Publisher" value={publisher} onChange={setPublisher} />
            <FieldInput label="Location" value={address} onChange={setAddress} />
          </FormSection>
        )}

        {type === 'thesis' && (
          <FormSection title="Publication Details" defaultOpen={true}>
            <FieldInput label="University" value={source} onChange={setSource} />
            <FieldInput label="Location" value={address} onChange={setAddress} />
          </FormSection>
        )}

        {type === 'webpage' && (
          <FormSection title="Publication Details" defaultOpen={true}>
            <FieldInput label="Website Name" value={source} onChange={setSource} />
          </FormSection>
        )}

        {type === 'chapter' && (
          <FormSection title="Publication Details" defaultOpen={true}>
            <FieldInput label="Publisher" value={publisher} onChange={setPublisher} />
          </FormSection>
        )}

        {/* Physical/ID Section */}
        <FormSection title="Physical/ID" defaultOpen={false}>
          <FieldInput label="Language" value={language} onChange={setLanguage} />
        </FormSection>

        {/* Digital/Locational Section */}
        <FormSection title="Digital/Locational" defaultOpen={false}>
          <FieldInput label="Short Title" value={shortTitle} onChange={setShortTitle} />
          <FieldInput label="URL" value={url} onChange={setUrl} placeholder="https://..." type="url" />
          <FieldInput label="Accessed" value={accessed} onChange={setAccessed} type="date" />
          <FieldInput label="Archive" value={archive} onChange={setArchive} />
          <FieldInput label="Location in Archive" value={locInArchive} onChange={setLocInArchive} />
        </FormSection>

        {/* Management Section */}
        <FormSection title="Management" defaultOpen={false}>
          <FieldInput label="Call Number" value={callNumber} onChange={setCallNumber} />
          <FieldInput label="Library Tags" value={libraryTags} onChange={setLibraryTags} />
          <FieldInput label="Rights" value={rights} onChange={setRights} />
          <FieldInput label="Extra" value={extra} onChange={setExtra} />
        </FormSection>

        {/* Keywords */}
        <FormSection title="Content" defaultOpen={false}>
          <FieldInput label="Keywords" value={keywords} onChange={setKeywords} placeholder="Comma-separated keywords" />
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Abstract</label>
            <textarea
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              placeholder="Summary of the work..."
              rows={3}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2.5 py-2 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Personal observations..."
              rows={2}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded px-2.5 py-2 bg-white dark:bg-surface-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500 resize-none"
            />
          </div>
        </FormSection>

        {/* Tags */}
        <FormSection title="Tags" defaultOpen={false}>
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
        </FormSection>
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
