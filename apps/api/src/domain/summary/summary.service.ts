import {
  addMonths,
  BUDGET_ALERT_THRESHOLDS_BPS,
  firstDayOfMonth,
  isPaletteKey,
  lastDayOfMonth,
  type BudgetAlertDto,
  type CategoryIconKey,
  type CategorySpendDto,
  type DashboardSummaryDto,
  type MonthKey,
  type MonthPointDto,
} from '@spendly/shared'

import { toDbDate } from '../../lib/db-dates'
import { prisma } from '../../lib/prisma'
import { ensureOccurrences } from '../recurring/recurring.service'

/** Months shown in the trend chart, ending with the one on screen. */
const TREND_MONTHS = 6

/**
 * What a month cost, per top-level category: expenses on accounts and cards minus card
 * credits (estornos), with subcategories rolled up into their parent. Pending rows count —
 * a budget is about what the month costs, paid or not. Transfers are never spending.
 */
async function spendingByCategory(householdId: string, month: MonthKey) {
  const rows = await prisma.$queryRaw<{ categoryId: string; spent: bigint }[]>`
    SELECT COALESCE(c."parentId", c.id) AS "categoryId",
           COALESCE(SUM(
             CASE
               WHEN t.type = 'EXPENSE' THEN t."amountCents"
               WHEN t.type = 'INCOME' AND t."creditCardId" IS NOT NULL THEN -t."amountCents"
               ELSE 0
             END
           ), 0)::bigint AS spent
      FROM "Transaction" t
      JOIN "Category" c ON c.id = t."categoryId" AND c."householdId" = t."householdId"
     WHERE t."householdId" = ${householdId}::uuid
       AND t."deletedAt" IS NULL
       AND c.kind = 'EXPENSE'
       AND t.date >= ${toDbDate(firstDayOfMonth(month))}
       AND t.date <= ${toDbDate(lastDayOfMonth(month))}
     GROUP BY 1`
  return new Map(rows.map((row) => [row.categoryId, Number(row.spent)]))
}

/** Income and expense per month over the trend window, in one aggregate. */
async function monthlyTrend(householdId: string, month: MonthKey): Promise<MonthPointDto[]> {
  const from = firstDayOfMonth(addMonths(month, -(TREND_MONTHS - 1)))
  const rows = await prisma.$queryRaw<{ month: string; income: bigint; expense: bigint }[]>`
    SELECT to_char(t.date, 'YYYY-MM') AS month,
           COALESCE(SUM(t."amountCents")
             FILTER (WHERE t.type = 'INCOME' AND t."creditCardId" IS NULL), 0)::bigint AS income,
           (COALESCE(SUM(t."amountCents") FILTER (WHERE t.type = 'EXPENSE'), 0)
            - COALESCE(SUM(t."amountCents")
                FILTER (WHERE t.type = 'INCOME' AND t."creditCardId" IS NOT NULL), 0))::bigint AS expense
      FROM "Transaction" t
     WHERE t."householdId" = ${householdId}::uuid
       AND t."deletedAt" IS NULL
       AND t.date >= ${toDbDate(from)}
       AND t.date <= ${toDbDate(lastDayOfMonth(month))}
     GROUP BY 1`
  const byMonth = new Map(
    rows.map((row) => [row.month, { income: Number(row.income), expense: Number(row.expense) }]),
  )
  // Every month in the window shows up, even the empty ones (the chart needs the gap).
  return Array.from({ length: TREND_MONTHS }, (_, index) => {
    const key = addMonths(month, index - (TREND_MONTHS - 1))
    const point = byMonth.get(key)
    return {
      month: key,
      incomeCents: point?.income ?? 0,
      expenseCents: point?.expense ?? 0,
    }
  })
}

/** The month's headline numbers, including what is still pending. */
async function monthTotals(householdId: string, month: MonthKey) {
  const [row] = await prisma.$queryRaw<
    { income: bigint; expense: bigint; pending_income: bigint; pending_expense: bigint }[]
  >`
    SELECT COALESCE(SUM(t."amountCents")
             FILTER (WHERE t.type = 'INCOME' AND t."creditCardId" IS NULL), 0)::bigint AS income,
           (COALESCE(SUM(t."amountCents") FILTER (WHERE t.type = 'EXPENSE'), 0)
            - COALESCE(SUM(t."amountCents")
                FILTER (WHERE t.type = 'INCOME' AND t."creditCardId" IS NOT NULL), 0))::bigint AS expense,
           COALESCE(SUM(t."amountCents")
             FILTER (WHERE t.type = 'INCOME' AND t.status = 'PENDING'), 0)::bigint AS pending_income,
           COALESCE(SUM(t."amountCents")
             FILTER (WHERE t.type = 'EXPENSE' AND t.status = 'PENDING'), 0)::bigint AS pending_expense
      FROM "Transaction" t
     WHERE t."householdId" = ${householdId}::uuid
       AND t."deletedAt" IS NULL
       AND t.date >= ${toDbDate(firstDayOfMonth(month))}
       AND t.date <= ${toDbDate(lastDayOfMonth(month))}`
  const incomeCents = Number(row?.income ?? 0)
  const expenseCents = Number(row?.expense ?? 0)
  return {
    incomeCents,
    expenseCents,
    netCents: incomeCents - expenseCents,
    pendingIncomeCents: Number(row?.pending_income ?? 0),
    pendingExpenseCents: Number(row?.pending_expense ?? 0),
  }
}

/** Everything the dashboard charts need, in one request. */
export async function getDashboardSummary(
  householdId: string,
  month: MonthKey,
): Promise<DashboardSummaryDto> {
  // Recurring rules feed the forecast and the budgets, so materialize them first.
  await ensureOccurrences(householdId, lastDayOfMonth(month))

  const [spent, trend, totals, categories] = await Promise.all([
    spendingByCategory(householdId, month),
    monthlyTrend(householdId, month),
    monthTotals(householdId, month),
    prisma.category.findMany({
      where: { householdId, kind: 'EXPENSE', parentId: null },
      select: {
        id: true,
        name: true,
        icon: true,
        color: true,
        monthlyBudgetCents: true,
        archivedAt: true,
      },
      orderBy: { sortOrder: 'asc' },
    }),
  ])

  const totalSpent = [...spent.values()].reduce((sum, value) => sum + Math.max(value, 0), 0)
  const byCategory: CategorySpendDto[] = categories
    // An archived category still shows while it has spending in the month.
    .filter((category) => spent.has(category.id) || !category.archivedAt)
    .map((category) => {
      const spentCents = spent.get(category.id) ?? 0
      const budgetCents = category.monthlyBudgetCents
      return {
        categoryId: category.id,
        name: category.name,
        icon: category.icon as CategoryIconKey,
        color: isPaletteKey(category.color) ? category.color : 'neutral',
        spentCents,
        budgetCents,
        usageBps:
          budgetCents && budgetCents > 0 ? Math.round((spentCents / budgetCents) * 10_000) : null,
        shareBps: totalSpent > 0 ? Math.round((Math.max(spentCents, 0) / totalSpent) * 10_000) : 0,
      }
    })
    .filter((row) => row.spentCents !== 0 || row.budgetCents !== null)
    .sort((a, b) => b.spentCents - a.spentCents || a.name.localeCompare(b.name, 'pt-BR'))

  const [warnBps, overBps] = BUDGET_ALERT_THRESHOLDS_BPS
  const alerts: BudgetAlertDto[] = byCategory
    .filter((row) => row.usageBps !== null && row.usageBps >= warnBps)
    .map((row) => ({
      categoryId: row.categoryId,
      name: row.name,
      icon: row.icon,
      color: row.color,
      spentCents: row.spentCents,
      budgetCents: row.budgetCents!,
      usageBps: row.usageBps!,
      thresholdBps: row.usageBps! >= overBps ? overBps : warnBps,
    }))
    .sort((a, b) => b.usageBps - a.usageBps)

  return { month, totals, byCategory, trend, alerts }
}
