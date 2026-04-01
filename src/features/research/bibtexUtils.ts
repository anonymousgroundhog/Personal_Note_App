import type { Reference, ReferenceType } from './types'

interface ParsedBibtex {
  type: ReferenceType
  title: string
  authors: string
  year?: number
  source?: string
  url?: string
  doi?: string
  abstract?: string
  notes?: string
  journal?: string
  volume?: string
  issue?: string
  pages?: string
  issn?: string
  booktitle?: string
  conference?: string
  address?: string
  publisher?: string
  isbn?: string
  website?: string
  accessDate?: string
  keywords?: string
  language?: string
}

/**
 * Parse a BibTeX entry string and extract fields
 * @example
 * const bibtex = `@article{key,
 *   title={My Paper},
 *   author={Smith, John and Doe, Jane},
 *   year={2021},
 *   journal={Nature}
 * }`
 * const parsed = parseBibtex(bibtex)
 */
export function parseBibtex(bibtex: string): ParsedBibtex | null {
  try {
    // Remove leading/trailing whitespace and comments
    const cleaned = bibtex
      .replace(/%.*$/gm, '') // Remove comments
      .trim()

    // Extract entry type: @article{...}, @book{...}, etc.
    const typeMatch = cleaned.match(/@(\w+)\s*\{/i)
    if (!typeMatch) return null

    const rawType = typeMatch[1].toLowerCase()
    const type = normalizeReferenceType(rawType)
    if (!type) return null

    // Extract all fields: key=value pairs
    const fields = extractFields(cleaned)

    // Map BibTeX fields to our Reference interface
    const title = cleanValue(fields.title || '')
    if (!title) return null // title is required

    const authors = cleanValue(fields.author || fields.authors || '')
    const year = fields.year ? parseInt(cleanValue(fields.year)) : undefined
    const url = cleanValue(fields.url || fields.howpublished || '')
    const doi = cleanValue(fields.doi || '')
    const abstract = cleanValue(fields.abstract || '')
    const notes = cleanValue(fields.note || fields.notes || '')

    // Type-specific fields
    const journal = cleanValue(fields.journal || '')
    const volume = cleanValue(fields.volume || '')
    const issue = cleanValue(fields.number || '')
    const pages = cleanValue(fields.pages || '')
    const issn = cleanValue(fields.issn || '')
    const booktitle = cleanValue(fields.booktitle || '')
    const address = cleanValue(fields.address || '')
    const publisher = cleanValue(fields.publisher || '')
    const isbn = cleanValue(fields.isbn || '')
    const keywords = cleanValue(fields.keywords || '')
    const language = cleanValue(fields.language || '')
    const accessDate = cleanValue(fields.urldate || '')

    // Set source based on type
    let source = ''
    if (type === 'journal') source = journal
    else if (type === 'conference') source = booktitle
    else if (type === 'book' || type === 'chapter') source = publisher
    else if (type === 'webpage') source = cleanValue(fields.website || '')

    return {
      type,
      title,
      authors,
      year: isNaN(year ?? NaN) ? undefined : year,
      source: source || undefined,
      url: url || undefined,
      doi: doi || undefined,
      abstract: abstract || undefined,
      notes: notes || undefined,
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
  } catch (err) {
    console.error('Failed to parse BibTeX:', err)
    return null
  }
}

/**
 * Normalize BibTeX entry type to our ReferenceType
 */
function normalizeReferenceType(type: string): ReferenceType | null {
  const map: Record<string, ReferenceType> = {
    article: 'journal',
    journal: 'journal',
    inproceedings: 'conference',
    bookinproceedings: 'conference',
    conference: 'conference',
    proceeding: 'conference',
    book: 'book',
    inbook: 'chapter',
    incollection: 'chapter',
    chapter: 'chapter',
    techreport: 'report',
    report: 'report',
    phdthesis: 'thesis',
    mastersthesis: 'thesis',
    thesis: 'thesis',
    misc: 'webpage',
    website: 'webpage',
    online: 'webpage',
    url: 'webpage',
  }
  return map[type] || null
}

/**
 * Extract field name=value pairs from BibTeX entry
 * Handles both quoted and braced values
 */
function extractFields(bibtex: string): Record<string, string> {
  const fields: Record<string, string> = {}

  // Remove @type{...} wrapper to get just the content
  const content = bibtex.replace(/@\w+\s*\{/, '').replace(/\}$/, '')

  // Split by comma, but respect nesting
  const entries = smartSplit(content, ',')

  for (const entry of entries) {
    const match = entry.match(/^\s*(\w+)\s*=\s*(.+)$/i)
    if (!match) continue

    const key = match[1].toLowerCase().trim()
    let value = match[2].trim()

    // Remove outer quotes or braces and unescape
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith('{') && value.endsWith('}'))) {
      value = value.slice(1, -1)
    }

    // Handle nested braces: "{{Title}}" -> "Title"
    while (value.startsWith('{') && value.endsWith('}')) {
      const inner = value.slice(1, -1)
      if (inner.includes('}') && !inner.slice(0, -1).includes('}')) {
        break // Stop if there are unmatched braces
      }
      value = inner
    }

    fields[key] = value
  }

  return fields
}

/**
 * Split string by delimiter while respecting brace nesting
 */
function smartSplit(str: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let braceDepth = 0

  for (let i = 0; i < str.length; i++) {
    const char = str[i]

    if (char === '{') {
      braceDepth++
      current += char
    } else if (char === '}') {
      braceDepth--
      current += char
    } else if (char === delimiter && braceDepth === 0) {
      if (current.trim()) {
        result.push(current)
      }
      current = ''
    } else {
      current += char
    }
  }

  if (current.trim()) {
    result.push(current)
  }

  return result
}

/**
 * Clean a BibTeX value: unescape special characters, handle LaTeX
 */
function cleanValue(value: string): string {
  return value
    .trim()
    // Unescape common LaTeX commands
    .replace(/\\&/g, '&')
    .replace(/\\\$/g, '$')
    .replace(/\\%/g, '%')
    .replace(/\\\^{(.)}/g, '$1') // \^{a} -> a
    .replace(/\\`{(.)}/g, '$1')  // \`{a} -> a
    .replace(/~/, '-')            // ~ -> -
    .replace(/\\(?:textit|emph)\{([^}]+)\}/g, '$1') // Remove italics
    .replace(/\\(?:textbf|bfseries)\{([^}]+)\}/g, '$1') // Remove bold
    .replace(/\\(?:texttt|ttfamily)\{([^}]+)\}/g, '$1') // Remove monospace
    .replace(/[{}]/g, '') // Remove remaining braces
}
