import React, { useState, useRef, useCallback } from 'react'
import { Upload, ChevronRight, ChevronLeft, Check, AlertTriangle, FileText, X } from 'lucide-react'
import { useFinanceStore } from './financeStore'
import { parseCsvText, autoDetectColumnMapping, parseDateFlexible, parseAmountFlexible, mapRowToTransaction } from './financeUtils'
import type { CsvColumnMapping, KnownField } from './types'

const KNOWN_FIELDS: { value: KnownField; label: string }[] = [
  { value: 'date', label: 'Date' },
  { value: 'description', label: 'Description' },
  { value: 'amount', label: 'Amount' },
  { value: 'debit', label: 'Debit (withdrawal)' },
  { value: 'credit', label: 'Credit (deposit)' },
  { value: 'skip', label: 'Skip this column' },
]

const inputCls = 'text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-surface-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-accent-500'

export default function CsvImport() {
  const { importTransactions } = useFinanceStore()

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [dragActive, setDragActive] = useState(false)
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<CsvColumnMapping[]>([])
  const [account, setAccount] = useState('')
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [imported, setImported] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function loadFile(file: File) {
    setFileName(file.name)
    // Try UTF-8, fall back to latin1
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const { headers: h, rows: r } = parseCsvText(text)
      setHeaders(h)
      setRows(r)
      const detected = autoDetectColumnMapping(h)
      setMapping(detected)
      setAccount(file.name.replace(/\.csv$/i, ''))
      setStep(2)
    }
    reader.readAsText(file, 'UTF-8')
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragActive(false)
    const file = e.dataTransfer.files[0]
    if (file?.name.endsWith('.csv')) loadFile(file)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) loadFile(file)
    e.target.value = ''
  }

  function updateMapping(idx: number, field: KnownField) {
    setMapping(prev => prev.map((m, i) => i === idx ? { ...m, mappedTo: field } : m))
  }

  // Compute preview rows
  const previewRows = rows.map((row, i) => {
    const mapped = mapRowToTransaction(row, mapping, account, fileName)
    return { idx: i, raw: row, mapped, hasError: !!mapped._errors?.length }
  })

  const validCount = previewRows.filter(r => !r.hasError).length
  const errorCount = previewRows.filter(r => r.hasError).length

  function goToPreview() {
    // Auto-check all non-error rows
    const allValid = new Set(previewRows.filter(r => !r.hasError).map(r => r.idx))
    setChecked(allValid)
    setStep(3)
  }

  function handleImport() {
    const toImport = previewRows
      .filter(r => checked.has(r.idx) && !r.hasError)
      .map(r => {
        const { _errors, ...tx } = r.mapped as ReturnType<typeof mapRowToTransaction>
        return { ...tx, account, importedFrom: fileName }
      })
    const count = importTransactions(toImport as Parameters<typeof importTransactions>[0])
    setImported(count)
  }

  function reset() {
    setStep(1); setFileName(''); setHeaders([]); setRows([]); setMapping([])
    setChecked(new Set()); setImported(null); setAccount('')
  }

  const hasDateCol = mapping.some(m => m.mappedTo === 'date')
  const hasDescCol = mapping.some(m => m.mappedTo === 'description')
  const hasAmtCol = mapping.some(m => m.mappedTo === 'amount') ||
    (mapping.some(m => m.mappedTo === 'debit') || mapping.some(m => m.mappedTo === 'credit'))

  // Step indicator
  function StepDot({ n, label }: { n: number; label: string }) {
    const done = step > n, active = step === n
    return (
      <div className="flex items-center gap-1.5">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${done ? 'bg-green-500 text-white' : active ? 'bg-accent-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}>
          {done ? <Check size={12} /> : n}
        </div>
        <span className={`text-xs ${active ? 'text-gray-800 dark:text-gray-100 font-medium' : 'text-gray-400'}`}>{label}</span>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-6">
        <StepDot n={1} label="Upload" />
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        <StepDot n={2} label="Map Columns" />
        <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        <StepDot n={3} label="Preview & Import" />
      </div>

      {/* ── Step 1: Upload ── */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-1">Import Bank Statement</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">Upload a CSV file exported from your bank. Different bank formats are supported — you'll map the columns in the next step.</p>
          </div>
          <div
            onDragOver={e => { e.preventDefault(); setDragActive(true) }}
            onDragLeave={() => setDragActive(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-14 px-8 cursor-pointer transition-colors ${dragActive ? 'border-accent-500 bg-accent-500/5' : 'border-gray-300 dark:border-gray-600 hover:border-accent-400 hover:bg-gray-50 dark:hover:bg-surface-800'}`}
          >
            <Upload size={32} className={`transition-colors ${dragActive ? 'text-accent-500' : 'text-gray-300 dark:text-gray-600'}`} />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Drop your CSV file here</p>
              <p className="text-xs text-gray-400 mt-0.5">or click to browse</p>
            </div>
            <p className="text-[11px] text-gray-400">Supports Chase, Bank of America, Wells Fargo, Capital One, and most bank exports</p>
          </div>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onFileChange} />
        </div>
      )}

      {/* ── Step 2: Map columns ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
                <FileText size={16} className="text-accent-500" /> {fileName}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{rows.length} rows detected. Map each column to the correct field.</p>
            </div>
            <button onClick={reset} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"><X size={16} /></button>
          </div>

          {/* Account name */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Account / Source label</label>
            <input type="text" value={account} onChange={e => setAccount(e.target.value)}
              placeholder="e.g. Chase Checking" className={`${inputCls} max-w-xs`} />
          </div>

          {/* Column mapping */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-surface-800">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">CSV Column</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sample Value</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Map To</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {mapping.map((m, i) => {
                  const sample = rows.slice(0, 3).map(r => r[m.csvHeader]).filter(Boolean).join(', ')
                  return (
                    <tr key={m.csvHeader} className="bg-white dark:bg-surface-900">
                      <td className="px-4 py-2.5 font-mono text-xs text-gray-700 dark:text-gray-300">{m.csvHeader}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-400 truncate max-w-[160px]">{sample || '—'}</td>
                      <td className="px-4 py-2.5">
                        <select
                          value={m.mappedTo}
                          onChange={e => updateMapping(i, e.target.value as KnownField)}
                          className={`${inputCls} py-1`}
                        >
                          {KNOWN_FIELDS.map(f => (
                            <option key={f.value} value={f.value}>{f.label}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Warnings */}
          {!hasDateCol && <p className="text-xs text-amber-500 flex items-center gap-1"><AlertTriangle size={12} /> No date column mapped</p>}
          {!hasAmtCol && <p className="text-xs text-amber-500 flex items-center gap-1"><AlertTriangle size={12} /> No amount column mapped</p>}

          {/* Preview of first 3 rows */}
          {rows.length > 0 && hasDateCol && hasAmtCol && (
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 dark:bg-surface-800 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Preview (first 3 rows)</div>
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-surface-800 border-t border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="px-3 py-1.5 text-left text-gray-500">Date</th>
                    <th className="px-3 py-1.5 text-left text-gray-500">Description</th>
                    <th className="px-3 py-1.5 text-right text-gray-500">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {rows.slice(0, 3).map((row, i) => {
                    const p = mapRowToTransaction(row, mapping, account, fileName)
                    return (
                      <tr key={i} className={p._errors ? 'bg-amber-50 dark:bg-amber-900/10' : 'bg-white dark:bg-surface-900'}>
                        <td className="px-3 py-1.5 text-gray-600 dark:text-gray-400">{p.date || '?'}</td>
                        <td className="px-3 py-1.5 text-gray-700 dark:text-gray-300 truncate max-w-[180px]">{p.description}</td>
                        <td className={`px-3 py-1.5 text-right font-mono ${(p.amount ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {p.amount != null ? `$${Math.abs(p.amount).toFixed(2)}` : '?'}
                          {p._errors && <span className="ml-1 text-amber-500">⚠</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button onClick={reset} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-surface-800">
              <ChevronLeft size={14} /> Back
            </button>
            <button onClick={goToPreview} disabled={!hasDateCol || !hasAmtCol}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-500 hover:bg-accent-600 text-white rounded text-sm font-medium disabled:opacity-40 transition-colors">
              Preview <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Preview & confirm ── */}
      {step === 3 && imported === null && (
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-100">Review Transactions</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                <span className="text-green-600 font-medium">{validCount} valid</span>
                {errorCount > 0 && <span className="text-amber-500 font-medium ml-2">{errorCount} with errors (will be skipped)</span>}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <button onClick={() => setChecked(new Set(previewRows.filter(r => !r.hasError).map(r => r.idx)))} className="hover:text-accent-500">All</button>
              <span>/</span>
              <button onClick={() => setChecked(new Set())} className="hover:text-accent-500">None</button>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden max-h-[50vh] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-gray-50 dark:bg-surface-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th className="px-3 py-2 w-8" />
                  <th className="px-3 py-2 text-left text-gray-500 uppercase tracking-wide">Date</th>
                  <th className="px-3 py-2 text-left text-gray-500 uppercase tracking-wide">Description</th>
                  <th className="px-3 py-2 text-right text-gray-500 uppercase tracking-wide">Amount</th>
                  <th className="px-3 py-2 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {previewRows.map(row => (
                  <tr key={row.idx} className={`${row.hasError ? 'bg-amber-50 dark:bg-amber-900/10 opacity-60' : checked.has(row.idx) ? 'bg-white dark:bg-surface-900' : 'bg-gray-50 dark:bg-surface-800 opacity-50'}`}>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={checked.has(row.idx) && !row.hasError} disabled={row.hasError}
                        onChange={() => {
                          setChecked(prev => {
                            const next = new Set(prev)
                            if (next.has(row.idx)) next.delete(row.idx); else next.add(row.idx)
                            return next
                          })
                        }}
                        className="accent-accent-500" />
                    </td>
                    <td className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{row.mapped.date || '?'}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-[220px] truncate">{row.mapped.description}</td>
                    <td className={`px-3 py-2 text-right font-mono ${(row.mapped.amount ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {row.mapped.amount != null ? `$${Math.abs(row.mapped.amount).toFixed(2)}` : '?'}
                    </td>
                    <td className="px-3 py-2">
                      {row.hasError && (
                        <span title={row.mapped._errors?.join(', ')} className="text-amber-500 cursor-help"><AlertTriangle size={11} /></span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setStep(2)} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-surface-800">
              <ChevronLeft size={14} /> Back
            </button>
            <button onClick={handleImport} disabled={checked.size === 0}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-accent-500 hover:bg-accent-600 text-white rounded text-sm font-medium disabled:opacity-40 transition-colors">
              <Check size={14} /> Import {checked.size} transaction{checked.size !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      )}

      {/* ── Success ── */}
      {imported !== null && (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <Check size={28} className="text-green-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Import Complete</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            Successfully imported <strong className="text-gray-700 dark:text-gray-200">{imported}</strong> new transaction{imported !== 1 ? 's' : ''} from {fileName}.
            {imported === 0 && ' All transactions already existed.'}
          </p>
          <button onClick={reset} className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white rounded text-sm font-medium transition-colors">
            Import Another File
          </button>
        </div>
      )}
    </div>
  )
}
