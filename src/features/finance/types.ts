export interface FinanceCategory {
  id: string
  name: string
  color: string
  isIncome: boolean
}

export interface Transaction {
  id: string
  date: string           // ISO 'YYYY-MM-DD'
  description: string
  amount: number         // positive = income, negative = expense
  categoryId: string | null
  account: string
  notes: string
  importedFrom?: string
  createdAt: number
}

export type KnownField = 'date' | 'description' | 'amount' | 'debit' | 'credit' | 'skip'

export interface CsvColumnMapping {
  csvHeader: string
  mappedTo: KnownField
}

export interface MonthSummary {
  month: string   // 'YYYY-MM'
  income: number
  expenses: number
  net: number
}

export interface CategorySummary {
  categoryId: string | null
  categoryName: string
  color: string
  total: number
  count: number
}

export interface RunningBalancePoint {
  date: string
  balance: number
}
