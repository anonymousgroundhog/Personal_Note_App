import React, { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area, CartesianGrid,
} from 'recharts'
import { TrendingUp, TrendingDown, DollarSign, Pencil, Settings2 } from 'lucide-react'
import { useFinanceStore } from './financeStore'
import { formatCurrency, formatMonthShort, formatMonth, useChartTheme, monthRange } from './financeUtils'
import TransactionForm from './TransactionForm'
import CustomizeModal from '../../components/CustomizeModal'
import { useSectionVisibility, type SectionDef } from '../../hooks/useSectionVisibility'
import type { Transaction } from './types'

type Range = '1m' | '3m' | '6m' | '1y' | 'all'

function getRangeLabel(r: Range) {
  return { '1m': 'This Month', '3m': 'Last 3 Mo', '6m': 'Last 6 Mo', '1y': 'This Year', all: 'All Time' }[r]
}

function getRangeDates(r: Range): { from: string; to: string } {
  const now = new Date()
  const to = now.toISOString().slice(0, 10)
  if (r === '1m') return monthRange(0)
  if (r === '3m') { const from = new Date(now.getFullYear(), now.getMonth() - 2, 1); return { from: from.toISOString().slice(0, 10), to } }
  if (r === '6m') { const from = new Date(now.getFullYear(), now.getMonth() - 5, 1); return { from: from.toISOString().slice(0, 10), to } }
  if (r === '1y') { return { from: `${now.getFullYear()}-01-01`, to } }
  return { from: '', to: '' }
}

function StatCard({ label, value, sub, positive }: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <div className="bg-white dark:bg-surface-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${positive === undefined ? 'text-gray-800 dark:text-gray-100' : positive ? 'text-green-500' : 'text-red-500'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

const SECTIONS: SectionDef[] = [
  { id: 'summary-cards', label: 'Summary Cards', description: 'Balance, income & expense totals' },
  { id: 'income-chart', label: 'Income vs Expenses', description: 'Monthly bar chart comparison' },
  { id: 'expense-chart', label: 'Expense Breakdown', description: 'Category pie chart' },
  { id: 'balance-chart', label: 'Running Balance', description: 'Balance over time area chart' },
  { id: 'recent-transactions', label: 'Recent Transactions', description: 'Latest transaction list' },
]

export default function FinanceDashboard() {
  const { transactions, categories, getMonthSummaries, getCategorySummaries, getRunningBalance, getTotalBalance } = useFinanceStore()
  const [range, setRange] = useState<Range>('6m')
  const [editTx, setEditTx] = useState<Transaction | null>(null)
  const [showCustomize, setShowCustomize] = useState(false)
  const { isVisible } = useSectionVisibility('finance-dashboard', SECTIONS)
  const theme = useChartTheme()

  const { from, to } = getRangeDates(range)
  const monthCount = { '1m': 1, '3m': 3, '6m': 6, '1y': 12, all: 12 }[range]
  const monthlySummaries = getMonthSummaries(monthCount)
  const catSummaries = getCategorySummaries(from || undefined, to || undefined)
  const runningBalance = getRunningBalance(from || undefined, to || undefined)
  const totalBalance = getTotalBalance()

  const inRange = transactions.filter(t => (!from || t.date >= from) && (!to || t.date <= to))
  const totalIncome = inRange.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const totalExpenses = Math.abs(inRange.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0))
  const netInRange = totalIncome - totalExpenses

  const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt).slice(0, 8)
  const catMap = new Map(categories.map(c => [c.id, c]))

  const tooltipStyle = { background: theme.tooltipBg, border: `1px solid ${theme.tooltipBorder}`, color: theme.tooltipText, borderRadius: '8px', fontSize: '12px' }

  const monthBarData = monthlySummaries.map(m => ({
    name: formatMonthShort(m.month),
    Income: Math.round(m.income * 100) / 100,
    Expenses: Math.round(m.expenses * 100) / 100,
  }))

  const balanceData = runningBalance.map(p => ({ date: p.date, Balance: p.balance }))

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 space-y-4">
        {/* Header with range selector and customize button */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            {(['1m','3m','6m','1y','all'] as Range[]).map(r => (
              <button key={r} onClick={() => setRange(r)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${range === r ? 'bg-accent-500 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-700'}`}>
                {getRangeLabel(r)}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowCustomize(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-surface-700 rounded transition-colors"
          >
            <Settings2 size={14} />
            Customize
          </button>
        </div>

        {/* Stat cards */}
        {isVisible('summary-cards') && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total Balance" value={formatCurrency(totalBalance)} />
          <StatCard label="Income" value={formatCurrency(totalIncome)} positive={true} sub={getRangeLabel(range)} />
          <StatCard label="Expenses" value={formatCurrency(totalExpenses)} positive={false} sub={getRangeLabel(range)} />
          <StatCard label="Net" value={formatCurrency(netInRange)} positive={netInRange >= 0} sub={getRangeLabel(range)} />
        </div>
        )}

        {/* Charts grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Monthly bar chart */}
          {isVisible('income-chart') && (
          <div className="bg-white dark:bg-surface-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={14} className="text-accent-500" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Income vs Expenses</h3>
            </div>
            {monthBarData.length === 0 || monthBarData.every(d => d.Income === 0 && d.Expenses === 0) ? (
              <div className="h-44 flex items-center justify-center text-xs text-gray-400">No data for this period</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthBarData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.gridColor} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: theme.axisColor }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: theme.axisColor }} axisLine={false} tickLine={false} tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(Number(v))} />
                  <Bar dataKey="Income" fill="#22c55e" radius={[3,3,0,0]} />
                  <Bar dataKey="Expenses" fill="#ef4444" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          )}

          {/* Expense categories pie */}
          {isVisible('expense-chart') && (
          <div className="bg-white dark:bg-surface-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign size={14} className="text-accent-500" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Expense Breakdown</h3>
            </div>
            {catSummaries.length === 0 ? (
              <div className="h-44 flex items-center justify-center text-xs text-gray-400">No expense data</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={catSummaries} dataKey="total" nameKey="categoryName" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                    {catSummaries.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(Number(v))} />
                  <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: '11px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          )}

          {/* Running balance area chart */}
          {isVisible('balance-chart') && (
          <div className="bg-white dark:bg-surface-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 lg:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown size={14} className="text-accent-500" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Running Balance</h3>
            </div>
            {balanceData.length < 2 ? (
              <div className="h-44 flex items-center justify-center text-xs text-gray-400">Not enough data to show trend</div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={balanceData}>
                  <defs>
                    <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.gridColor} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: theme.axisColor }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: theme.axisColor }} axisLine={false} tickLine={false} tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(0)+'k' : v}`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatCurrency(Number(v))} />
                  <Area type="monotone" dataKey="Balance" stroke="#8b5cf6" strokeWidth={2} fill="url(#balGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          )}
        </div>

        {/* Recent transactions */}
        {isVisible('recent-transactions') && (
        <div className="bg-white dark:bg-surface-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Recent Transactions</h3>
          {recent.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">No transactions yet — add one or import a CSV</p>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {recent.map(tx => {
                const cat = tx.categoryId ? catMap.get(tx.categoryId) : null
                return (
                  <div key={tx.id} className="flex items-center gap-3 py-2.5 group">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: (cat?.color ?? '#6b7280') + '22' }}>
                      <span className="text-base">{cat?.isIncome ? '↑' : '↓'}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 dark:text-gray-200 truncate">{tx.description}</p>
                      <p className="text-[11px] text-gray-400">{tx.date} · {tx.account || 'No account'}</p>
                    </div>
                    {cat && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                        style={{ background: cat.color + '22', color: cat.color }}>
                        {cat.name}
                      </span>
                    )}
                    <span className={`text-sm font-semibold tabular-nums flex-shrink-0 ${tx.amount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {tx.amount >= 0 ? '+' : ''}{formatCurrency(tx.amount)}
                    </span>
                    <button onClick={() => setEditTx(tx)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-accent-500 rounded transition-opacity">
                      <Pencil size={12} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        )}
      </div>

      {/* Customize modal */}
      {showCustomize && (
        <CustomizeModal
          title="Customize Dashboard"
          sections={SECTIONS}
          namespace="finance-dashboard"
          onClose={() => setShowCustomize(false)}
        />
      )}

      {/* Edit drawer */}
      {editTx && (
        <div className="fixed inset-0 z-40 flex justify-end" onClick={() => setEditTx(null)}>
          <div onClick={e => e.stopPropagation()} className="h-full shadow-2xl">
            <TransactionForm transaction={editTx} onClose={() => setEditTx(null)} />
          </div>
        </div>
      )}
    </div>
  )
}
