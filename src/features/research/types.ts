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

  // Journal-specific fields
  journal?: string
  volume?: string
  issue?: string
  pages?: string
  issn?: string

  // Conference-specific fields
  booktitle?: string
  conference?: string
  address?: string

  // Book-specific fields
  publisher?: string
  isbn?: string

  // Webpage-specific fields
  website?: string
  accessDate?: string       // when you accessed it

  // General fields
  keywords?: string         // comma-separated
  language?: string

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
