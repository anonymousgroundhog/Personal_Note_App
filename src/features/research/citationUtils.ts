import type { Reference } from './types'

/**
 * Generate a BibTeX entry for a single reference with all extended fields
 */
export function generateBibtexEntry(ref: Reference): string {
  const lastNameMatch = ref.authors.split(',')[0]?.match(/(\w+)$/)
  const citeKey = ((lastNameMatch?.[1] ?? 'ref').toLowerCase() + (ref.year ?? ''))
  const typeMap: Record<Reference['type'], string> = {
    journal: 'article',
    conference: 'inproceedings',
    book: 'book',
    chapter: 'inbook',
    webpage: 'misc',
    report: 'techreport',
    thesis: 'phdthesis',
  }
  const bibtexType = typeMap[ref.type]

  const fields: Record<string, string> = {
    title: ref.title,
    author: ref.authors,
    ...(ref.year && { year: ref.year.toString() }),
  }

  // Add type-specific fields
  if (ref.type === 'journal') {
    if (ref.source) fields.journal = ref.source
    if (ref.volume) fields.volume = ref.volume
    if (ref.issue) fields.number = ref.issue
    if (ref.pages) fields.pages = ref.pages
    if (ref.issn) fields.issn = ref.issn
  } else if (ref.type === 'conference') {
    if (ref.source) fields.booktitle = ref.source
    if (ref.booktitle) fields.booktitle = ref.booktitle
    if (ref.address) fields.address = ref.address
    if (ref.pages) fields.pages = ref.pages
  } else if (ref.type === 'book') {
    if (ref.source) fields.publisher = ref.source
    if (ref.publisher) fields.publisher = ref.publisher
    if (ref.isbn) fields.isbn = ref.isbn
  } else if (ref.type === 'chapter') {
    if (ref.source) fields.booktitle = ref.source
    if (ref.booktitle) fields.booktitle = ref.booktitle
    if (ref.pages) fields.pages = ref.pages
    if (ref.publisher) fields.publisher = ref.publisher
  } else if (ref.type === 'webpage') {
    if (ref.source) fields.website = ref.source
    if (ref.accessDate) fields.urldate = ref.accessDate
  } else if (ref.type === 'report') {
    if (ref.source) fields.organization = ref.source
    if (ref.publisher) fields.organization = ref.publisher
  } else if (ref.type === 'thesis') {
    if (ref.source) fields.school = ref.source
  }

  // Add universal fields
  if (ref.url) fields.url = ref.url
  if (ref.doi) fields.doi = ref.doi
  if (ref.keywords) fields.keywords = ref.keywords
  if (ref.abstract) fields.abstract = ref.abstract
  if (ref.notes) fields.note = ref.notes

  const fieldLines = Object.entries(fields)
    .map(([k, v]) => `  ${k}={${v}}`)
    .join(',\n')

  return `@${bibtexType}{${citeKey},\n${fieldLines}\n}`
}

/**
 * Generate a complete BibTeX file for multiple references
 */
export function generateBibtexFile(references: Reference[]): string {
  const entries = references.map(generateBibtexEntry)
  return entries.join('\n')
}

/**
 * Generate APA citation for a single reference
 */
export function generateApa(ref: Reference): string {
  const authors = ref.authors
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean)

  let authorStr: string
  if (authors.length === 0) {
    authorStr = 'Unknown'
  } else if (authors.length === 1) {
    authorStr = authors[0]
  } else if (authors.length === 2) {
    authorStr = `${authors[0]} & ${authors[1]}`
  } else {
    authorStr = `${authors[0]} et al.`
  }

  const year = ref.year ? ` (${ref.year}).` : '.'
  const source = ref.source ? ` ${ref.source}.` : ''
  const doi = ref.doi ? ` https://doi.org/${ref.doi}` : ref.url ? ` ${ref.url}` : ''

  return `${authorStr}${year} ${ref.title}.${source}${doi}`
}

/**
 * Download a BibTeX file
 */
export function downloadBibtexFile(content: string, filename: string = 'references.bib'): void {
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
