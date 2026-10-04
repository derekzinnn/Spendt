import { currentMonthKey, type MonthKey } from '@spendly/shared'
import { createContext, use, useMemo, useState, type ReactNode } from 'react'

interface MonthContextValue {
  month: MonthKey
  setMonth: (month: MonthKey) => void
}

const MonthContext = createContext<MonthContextValue | null>(null)

/**
 * The month the whole app is looking at. The header's month picker sets it, and every
 * monthly screen (painel, lançamentos, faturas…) reads it — so switching screens keeps
 * the month you were reviewing. Starts at the current month in São Paulo.
 */
export function MonthProvider({ children }: { children: ReactNode }) {
  const [month, setMonth] = useState<MonthKey>(() => currentMonthKey())
  const value = useMemo(() => ({ month, setMonth }), [month])
  return <MonthContext value={value}>{children}</MonthContext>
}

export function useMonth() {
  const context = use(MonthContext)
  if (!context) throw new Error('useMonth must be used inside <MonthProvider>')
  return context
}
