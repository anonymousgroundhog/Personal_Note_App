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

export interface ParseError {
  raw: string
  reason: string
}

/**
 * Parse a single BibTeX entry string and extract fields
 */
export function parseBibtex(bibtex: string): ParsedBibtex | null {
  try {
    // Remove leading/trailing whitespace and comments
    const cleaned = bibtex
      .replace(/%.*$/gm, '') // Remove comments
      .trim()

    if (!cleaned) return null

    // Extract entry type: @article{...}, @book{...}, etc.
    const typeMatch = cleaned.match(/@(\w+)\s*\{/i)
    if (!typeMatch) return null

    const rawType = typeMatch[1].toLowerCase()
    const type = normalizeReferenceType(rawType)
    if (!type) return null

    // Extract citation key (first thing in {})
    const keyMatch = cleaned.match(/@\w+\s*\{([^,]+),/i)
    const citationKey = keyMatch ? cleanValue(keyMatch[1]) : 'unknown'

    // Extract all fields: key=value pairs
    const fields = extractFields(cleaned)

    // Map BibTeX fields to our Reference interface
    const title = cleanValue(fields.title || '')

    // If no title, try common alternatives in order of preference
    let finalTitle = title
    if (!finalTitle) {
      finalTitle = cleanValue(
        fields.name ||
        fields.organization ||
        fields.booktitle ||
        fields.journaltitle ||
        fields.series ||
        fields.chapter ||
        fields.note ||
        fields.website ||
        fields.websitetitle ||
        ''
      )
    }

    // Last resort: use citation key or URL as title
    if (!finalTitle) {
      if (fields.url) {
        // Extract domain or filename from URL
        try {
          const urlObj = new URL(cleanValue(fields.url))
          finalTitle = urlObj.hostname || 'Untitled'
        } catch {
          finalTitle = citationKey
        }
      } else {
        finalTitle = citationKey
      }
    }

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
    const address = cleanValue(fields.address || fields.location || '')
    const publisher = cleanValue(fields.publisher || fields.institution || fields.school || '')
    const isbn = cleanValue(fields.isbn || '')
    const keywords = cleanValue(fields.keywords || '')
    const language = cleanValue(fields.language || '')
    const accessDate = cleanValue(fields.urldate || fields.accessed || '')

    // Set source based on type
    let source = ''
    if (type === 'journal') source = journal
    else if (type === 'conference') source = booktitle || publisher
    else if (type === 'book' || type === 'chapter') source = publisher
    else if (type === 'webpage') source = cleanValue(fields.website || fields.websitetitle || '')
    else if (type === 'report' || type === 'thesis') source = publisher

    return {
      type,
      title: finalTitle,
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
 * Handles both quoted and braced values with proper nesting
 */
function extractFields(bibtex: string): Record<string, string> {
  const fields: Record<string, string> = {}

  // Remove @type{key, ... to get just the content
  const content = bibtex.replace(/@\w+\s*\{[^,]*,\s*/, '').replace(/\}$/, '')

  // Split by comma at depth 0
  const entries = smartSplit(content, ',')

  for (const entry of entries) {
    const match = entry.match(/^\s*(\w+)\s*=\s*(.+)$/i)
    if (!match) continue

    const key = match[1].toLowerCase().trim()
    let value = match[2].trim()

    // Skip empty values
    if (!value) continue

    // Remove outer quotes or braces and unescape
    value = extractValue(value)

    // Only store non-empty values
    if (value.trim()) {
      fields[key] = value
    }
  }

  return fields
}

/**
 * Extract the value from a BibTeX field, handling quotes and braces
 */
function extractValue(value: string): string {
  let result = value.trim()

  // Handle multiple levels of quotes and braces
  let prevLength = 0
  while (result.length !== prevLength) {
    prevLength = result.length

    // Handle quoted strings: "value"
    if (result.startsWith('"') && result.endsWith('"') && result.length > 1) {
      result = result.slice(1, -1)
    }
    // Handle braced strings: {value} with balanced braces
    else if (result.startsWith('{') && result.endsWith('}') && result.length > 1) {
      const inner = result.slice(1, -1)
      if (isBalanced(inner)) {
        result = inner
      } else {
        break
      }
    }
    // Handle number/bare values - stop processing
    else {
      break
    }

    result = result.trim()
  }

  return result
}

/**
 * Check if braces are balanced in a string
 */
function isBalanced(str: string): boolean {
  let depth = 0
  for (let i = 0; i < str.length; i++) {
    if (str[i] === '{') depth++
    else if (str[i] === '}') {
      depth--
      if (depth < 0) return false
    }
  }
  return depth === 0
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
    // Remove file attachments (Zotero-specific): {Title:/path/to/file:type}
    .replace(/\{[^}]*:[^}]*\}/g, '')
    // Unescape common LaTeX commands
    .replace(/\\&/g, '&')
    .replace(/\\\$/g, '$')
    .replace(/\\%/g, '%')
    .replace(/\\#/g, '#')
    // LaTeX accents - more patterns
    .replace(/\\\^{(.)}/g, '$1') // \^{a} -> a
    .replace(/\\`{(.)}/g, '$1')  // \`{a} -> a
    .replace(/\\'{(.)}/g, '$1')  // \'{a} -> a
    .replace(/\\"{(.)}/g, '$1')  // \"{a} -> a
    .replace(/\\.{(.)}/g, '$1')  // \.{a} -> a
    .replace(/\\u{(.)}/g, '$1')  // \u{a} -> a
    .replace(/\\v{(.)}/g, '$1')  // \v{a} -> a
    .replace(/\\c{(.)}/g, '$1')  // \c{a} -> a
    .replace(/\\d{(.)}/g, '$1')  // \d{a} -> a
    .replace(/\\H{(.)}/g, '$1')  // \H{a} -> a
    .replace(/\\t{(.)}/g, '$1')  // \t{a} -> a
    .replace(/\\k{(.)}/g, '$1')  // \k{a} -> a
    .replace(/\\\~{(.)}/g, '$1') // \~{a} -> a
    .replace(/\\={(.)}/, '$1')   // \={a} -> a
    // Special characters
    .replace(/\\oe/gi, 'oe')
    .replace(/\\ae/gi, 'ae')
    .replace(/\\aa/gi, 'a')
    .replace(/\\o/gi, 'o')
    .replace(/\\O/gi, 'O')
    .replace(/\\l/gi, 'l')
    .replace(/\\L/gi, 'L')
    .replace(/\\ss/gi, 'ss')
    .replace(/\\?\^/g, '^')
    .replace(/\\?~/g, '~')
    .replace(/--/g, '–')           // en-dash
    .replace(/---/g, '—')          // em-dash
    // Math mode
    .replace(/\$\\sim\$/g, '~')
    .replace(/\$-\$/g, '-')
    .replace(/\$([^$]*)\$/g, '$1') // Remove math delimiters
    // Remove formatting commands
    .replace(/\\(?:textit|emph)\{([^}]*)\}/g, '$1')        // Remove italics
    .replace(/\\(?:textbf|bfseries)\{([^}]*)\}/g, '$1')    // Remove bold
    .replace(/\\(?:texttt|ttfamily)\{([^}]*)\}/g, '$1')    // Remove monospace
    .replace(/\\(?:textsc|scshape)\{([^}]*)\}/g, '$1')     // Remove smallcaps
    .replace(/\\(?:textup|upshape|rm|rmfamily)\{([^}]*)\}/g, '$1')
    .replace(/\\(?:textsl|slshape|it|itshape)\{([^}]*)\}/g, '$1')
    .replace(/\\(?:textmd|mdseries|bfseries|bf)\{([^}]*)\}/g, '$1')
    .replace(/\\(?:rm|up|bf|it|sl|sf|tt)\s+/g, '')         // Remove font switches
    .replace(/\\mbox\{([^}]*)\}/g, '$1')                    // Remove mbox
    .replace(/\\text\{([^}]*)\}/g, '$1')                    // Remove text mode
    // Remove citations, references
    .replace(/~\\cite\{[^}]*\}/g, '')
    .replace(/~\\ref\{[^}]*\}/g, '')
    .replace(/\\cite\{[^}]*\}/g, '')
    .replace(/\\ref\{[^}]*\}/g, '')
    // Clean up whitespace
    .replace(/\s+/g, ' ')          // Multiple spaces -> single space
    .trim()
    // Remove remaining braces last
    .replace(/[{}]/g, '')
}

/**
 * Parse multiple BibTeX entries from a file content string
 * Returns array of parsed entries with errors tracked separately
 */
export function parseBibtexFile(content: string): {
  entries: ParsedBibtex[]
  errors: ParseError[]
} {
  const entries: ParsedBibtex[] = []
  const errors: ParseError[] = []

  // Find all @type{ positions and extract entries by matching braces
  let pos = 0
  while (pos < content.length) {
    const atIndex = content.indexOf('@', pos)
    if (atIndex === -1) break

    // Find the opening brace
    const braceIndex = content.indexOf('{', atIndex)
    if (braceIndex === -1) break

    // Extract entry by matching braces
    let braceDepth = 0
    let endIndex = braceIndex

    for (let i = braceIndex; i < content.length; i++) {
      if (content[i] === '{') braceDepth++
      else if (content[i] === '}') {
        braceDepth--
        if (braceDepth === 0) {
          endIndex = i
          break
        }
      }
    }

    if (endIndex === braceIndex) {
      // No matching closing brace found, skip
      pos = braceIndex + 1
      continue
    }

    const rawEntry = content.substring(atIndex, endIndex + 1)

    try {
      const parsed = parseBibtex(rawEntry)
      if (parsed) {
        entries.push(parsed)
      } else {
        // Failed to parse but no exception
        errors.push({
          raw: rawEntry.substring(0, 100),
          reason: 'No title found (required field)'
        })
      }
    } catch (err) {
      errors.push({
        raw: rawEntry.substring(0, 100),
        reason: err instanceof Error ? err.message : 'Unknown parsing error'
      })
    }

    pos = endIndex + 1
  }

  return { entries, errors }
}
