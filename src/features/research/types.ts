export type ReferenceType = 'journal' | 'conference' | 'book' | 'chapter' | 'webpage' | 'report' | 'thesis'

export interface Reference {
  id: string
  title: string
  authors: string           // comma-separated, e.g. "Smith, John, Doe, Jane"
  year?: number
  type: ReferenceType
  source?: string           // journal/publisher/website name
  url?: string
  doi?: string
  abstract?: string
  notes?: string
  tags: string[]
  pdfPath?: string          // vault-relative: 'research/pdfs/<id>.pdf'

  // Series Data
  series?: string
  seriesTitle?: string
  seriesText?: string
  seriesNumber?: string

  // Identifiers
  issn?: string
  isbn?: string
  journalAbbr?: string      // journal abbreviation

  // Physical/ID
  pages?: string
  language?: string
  volume?: string
  issue?: string

  // Digital/Locational
  shortTitle?: string
  accessed?: string         // when you accessed it (ISO date)
  archive?: string          // archived location
  locInArchive?: string     // location in archive

  // Management
  libraryTags?: string      // additional tags for organization
  callNumber?: string
  rights?: string
  extra?: string

  // Journal-specific fields
  journal?: string

  // Conference-specific fields
  booktitle?: string
  conference?: string
  address?: string

  // Book-specific fields
  publisher?: string

  // Webpage-specific fields
  website?: string
  accessDate?: string       // deprecated, use 'accessed' instead

  // General fields
  keywords?: string         // comma-separated

  createdAt: number
  updatedAt: number
}

export interface Library {
  id: string
  name: string
  description?: string
  color?: string            // hex color for UI
  referenceIds: string[]    // array of reference IDs in this library
  createdAt: number
  updatedAt: number
}

export interface PdfAnnotation {
  id: string
  referenceId: string
  page: number
  type: 'highlight' | 'note'
  x: number                 // normalized 0-1 relative to page width
  y: number                 // normalized 0-1 relative to page height
  width?: number            // highlight only, normalized
  height?: number           // highlight only, normalized
  text?: string             // note text
  color: string             // hex
  createdAt: number
}
