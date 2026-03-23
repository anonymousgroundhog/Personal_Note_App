import { useUiStore } from '../../stores/uiStore'
import type { Transaction, FinanceCategory, MonthSummary, CategorySummary, RunningBalancePoint, CsvColumnMapping, KnownField } from './types'

// ── CSV Parsing ───────────────────────────────────────────────────────────────

function parseLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++ }
      else if (ch === '"') inQuote = false
      else current += ch
    } else {
      if (ch === '"') inQuote = true
      else if (ch === ',') { fields.push(current.trim()); current = '' }
      else current += ch
    }
  }
  fields.push(current.trim())
  return fields
}

// Detect whether a line looks like a real transaction-data header row
// (has at least one date-like column AND one amount-like or description-like column)
function looksLikeDataHeader(fields: string[]): boolean {
  const lower = fields.map(f => f.toLowerCase().trim())
  const hasDate = lower.some(f => ['date', 'transaction date', 'trans date', 'posted date', 'value date', 'posting date'].includes(f))
  const hasAmount = lower.some(f => ['amount', 'debit', 'credit', 'withdrawal', 'deposit', 'amt', 'transaction amount'].includes(f))
  const hasDesc = lower.some(f => ['description', 'desc', 'memo', 'payee', 'narrative', 'merchant'].includes(f))
  return hasDate && (hasAmount || hasDesc)
}

export function parseCsvText(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const allLines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (allLines.length === 0) return { headers: [], rows: [] }

  // Find the first line that looks like a real data header (handles multi-section files like BofA)
  let headerLineIdx = 0
  for (let i = 0; i < Math.min(allLines.length, 20); i++) {
    if (!allLines[i].trim()) continue
    const fields = parseLine(allLines[i])
    if (looksLikeDataHeader(fields)) { headerLineIdx = i; break }
  }

  const headers = parseLine(allLines[headerLineIdx])
  const rows: Record<string, string>[] = []
  for (let i = headerLineIdx + 1; i < allLines.length; i++) {
    if (!allLines[i].trim()) continue
    const vals = parseLine(allLines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => { row[h] = vals[idx] ?? '' })
    // Skip summary/balance rows: rows where the date field contains text like "Beginning balance" or "Total"
    const dateVal = row[headers[0]] ?? ''
    if (/^(beginning|ending|total|opening|closing)\b/i.test(dateVal.trim())) continue
    rows.push(row)
  }
  return { headers, rows }
}

const DATE_KEYWORDS = ['date', 'transaction date', 'trans date', 'posted date', 'value date', 'posting date', 'settlement date', 'booking date', 'trans. date']
const DESC_KEYWORDS = ['description', 'desc', 'memo', 'narrative', 'payee', 'merchant', 'transaction description', 'details', 'particulars', 'reference', 'name', 'transaction', 'note']
const AMOUNT_KEYWORDS = ['amount', 'amt', 'transaction amount', 'value', 'net amount']
const DEBIT_KEYWORDS = ['debit', 'debit amount', 'withdrawal', 'withdrawals', 'money out', 'charge', 'payment', 'dr']
const CREDIT_KEYWORDS = ['credit', 'credit amount', 'deposit', 'deposits', 'money in', 'payment in', 'cr']
// Columns that should always be skipped (running totals, balances, etc.)
const SKIP_KEYWORDS = ['running bal', 'running balance', 'balance', 'bal.', 'running bal.', 'summary amt', 'summary amt.']

export function autoDetectColumnMapping(headers: string[]): CsvColumnMapping[] {
  const used = new Set<KnownField>()
  return headers.map(h => {
    const lower = h.toLowerCase().trim()
    // Always skip balance/summary columns
    if (SKIP_KEYWORDS.some(k => lower === k || lower.startsWith(k))) return { csvHeader: h, mappedTo: 'skip' }
    let mappedTo: KnownField = 'skip'
    if (DATE_KEYWORDS.includes(lower) && !used.has('date')) { mappedTo = 'date'; used.add('date') }
    else if (DESC_KEYWORDS.some(k => lower === k || lower.includes(k)) && !used.has('description')) { mappedTo = 'description'; used.add('description') }
    else if (AMOUNT_KEYWORDS.includes(lower) && !used.has('amount')) { mappedTo = 'amount'; used.add('amount') }
    else if (DEBIT_KEYWORDS.includes(lower) && !used.has('debit')) { mappedTo = 'debit'; used.add('debit') }
    else if (CREDIT_KEYWORDS.includes(lower) && !used.has('credit')) { mappedTo = 'credit'; used.add('credit') }
    return { csvHeader: h, mappedTo }
  })
}

export function parseDateFlexible(value: string): string | null {
  if (!value || !value.trim()) return null
  const v = value.trim()

  // ISO YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(v)) {
    const d = new Date(v)
    if (!isNaN(d.getTime())) return v
  }
  // YYYYMMDD
  if (/^\d{8}$/.test(v)) {
    const iso = `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`
    const d = new Date(iso)
    if (!isNaN(d.getTime())) return iso
  }
  // MM/DD/YYYY or M/D/YYYY or MM/DD/YY
  if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(v)) {
    const parts = v.split(/[\/\-]/)
    let [a, b, c] = parts.map(Number)
    if (c < 100) c += 2000
    // Disambiguate: if a > 12 it must be DD/MM
    const [month, day] = a > 12 ? [b, a] : [a, b]
    const iso = `${c}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    const d = new Date(iso)
    if (!isNaN(d.getTime())) return iso
  }
  // DD-Mon-YYYY or DD-Mon-YY e.g. 15-Jan-2026
  const monMatch = v.match(/^(\d{1,2})[-\s]([A-Za-z]{3})[-\s](\d{2,4})$/)
  if (monMatch) {
    const months: Record<string, string> = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' }
    const mo = months[monMatch[2].toLowerCase()]
    if (mo) {
      let yr = parseInt(monMatch[3])
      if (yr < 100) yr += 2000
      const iso = `${yr}-${mo}-${monMatch[1].padStart(2,'0')}`
      const d = new Date(iso)
      if (!isNaN(d.getTime())) return iso
    }
  }
  // Last resort: Date constructor
  const d = new Date(v)
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return null
}

export function parseAmountFlexible(value: string): number | null {
  if (!value || !value.trim()) return null
  let v = value.trim()
  // Accounting negatives: (1234.56)
  const isNeg = v.startsWith('(') && v.endsWith(')')
  if (isNeg) v = v.slice(1, -1)
  // Strip currency symbols
  v = v.replace(/[$£€¥]/g, '')
  // European format: if last separator is comma (1.234,56 → 1234.56)
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(v)) v = v.replace(/\./g, '').replace(',', '.')
  // Strip thousands commas
  v = v.replace(/,/g, '')
  const n = parseFloat(v)
  if (isNaN(n)) return null
  return isNeg ? -n : n
}

export function mapRowToTransaction(
  row: Record<string, string>,
  mapping: CsvColumnMapping[],
  account: string,
  importedFrom: string
): Partial<Transaction> & { _errors?: string[] } {
  const errors: string[] = []
  const get = (field: KnownField) => {
    const col = mapping.find(m => m.mappedTo === field)
    return col ? row[col.csvHeader] ?? '' : ''
  }

  const rawDate = get('date')
  const date = parseDateFlexible(rawDate)
  if (!date) errors.push(`Invalid date: "${rawDate}"`)

  const description = get('description') || 'Imported transaction'

  let amount: number | null = null
  const rawAmount = get('amount')
  const rawDebit = get('debit')
  const rawCredit = get('credit')

  if (rawAmount) {
    amount = parseAmountFlexible(rawAmount)
    if (amount === null) errors.push(`Invalid amount: "${rawAmount}"`)
  } else if (rawDebit || rawCredit) {
    const debit = rawDebit ? (parseAmountFlexible(rawDebit) ?? 0) : 0
    const credit = rawCredit ? (parseAmountFlexible(rawCredit) ?? 0) : 0
    amount = credit - Math.abs(debit)
  }

  // Skip summary/balance rows that slipped through (blank amount + balance-like description)
  if (amount === null && /^(beginning|ending|total|opening|closing|balance)\b/i.test(description)) {
    errors.push('Summary row — skipped')
  } else if (amount === null) {
    errors.push('No amount found')
  }

  return {
    date: date ?? '',
    description,
    amount: amount ?? 0,
    account,
    importedFrom,
    categoryId: null,
    notes: '',
    _errors: errors.length > 0 ? errors : undefined,
  }
}

// ── Finance aggregation ───────────────────────────────────────────────────────

export function groupByMonth(transactions: Transaction[], count = 6): MonthSummary[] {
  const now = new Date()
  const months: MonthSummary[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.push({ month: key, income: 0, expenses: 0, net: 0 })
  }
  for (const t of transactions) {
    const key = t.date.slice(0, 7)
    const entry = months.find(m => m.month === key)
    if (!entry) continue
    if (t.amount >= 0) entry.income += t.amount
    else entry.expenses += Math.abs(t.amount)
  }
  months.forEach(m => { m.net = m.income - m.expenses })
  return months
}

export function groupByCategory(
  transactions: Transaction[],
  categories: FinanceCategory[]
): CategorySummary[] {
  const map = new Map<string, CategorySummary>()
  const uncatKey = '__uncat__'

  for (const t of transactions) {
    if (t.amount >= 0) continue // expenses only
    const key = t.categoryId ?? uncatKey
    if (!map.has(key)) {
      const cat = categories.find(c => c.id === key)
      map.set(key, {
        categoryId: key === uncatKey ? null : key,
        categoryName: cat?.name ?? 'Uncategorized',
        color: cat?.color ?? '#6b7280',
        total: 0,
        count: 0,
      })
    }
    const entry = map.get(key)!
    entry.total += Math.abs(t.amount)
    entry.count++
  }

  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

export function computeRunningBalance(transactions: Transaction[]): RunningBalancePoint[] {
  const sorted = [...transactions].sort((a, b) => a.date.localeCompare(b.date))
  let balance = 0
  return sorted.map(t => {
    balance += t.amount
    return { date: t.date, balance: Math.round(balance * 100) / 100 }
  })
}

// ── Formatting ────────────────────────────────────────────────────────────────

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
export function formatCurrency(amount: number): string { return fmt.format(amount) }

export function formatMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

export function formatMonthShort(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' })
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export function monthRange(offset = 0): { from: string; to: string } {
  const now = new Date()
  const from = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const to = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

// ── Chart theme hook ──────────────────────────────────────────────────────────

export function useChartTheme() {
  const darkMode = useUiStore(s => s.darkMode)
  return {
    tooltipBg: darkMode ? '#1e1e1e' : '#fff',
    tooltipBorder: darkMode ? '#444' : '#e5e7eb',
    tooltipText: darkMode ? '#e5e5e5' : '#374151',
    axisColor: darkMode ? '#6b7280' : '#9ca3af',
    gridColor: darkMode ? '#2d2d2d' : '#f3f4f6',
  }
}
