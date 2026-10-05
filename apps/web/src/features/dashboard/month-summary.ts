import type { CategoryDto, TransactionDto } from '@spendly/shared'

/**
 * Spending per top-level category for the month (subcategories roll up to their parent):
 * expenses on accounts and cards, minus card credits (estornos). Pending bills count — a
 * budget is about what the month costs, paid or not.
 */
export function spendingByCategory(items: TransactionDto[], categories: CategoryDto[]) {
  const parentOf = new Map(categories.map((c) => [c.id, c.parentId ?? c.id]))
  const spent = new Map<string, number>()
  for (const t of items) {
    if (!t.categoryId) continue
    const sign = t.type === 'EXPENSE' ? 1 : t.type === 'INCOME' && t.creditCardId ? -1 : 0
    if (sign === 0) continue
    const key = parentOf.get(t.categoryId) ?? t.categoryId
    spent.set(key, (spent.get(key) ?? 0) + sign * t.amountCents)
  }
  return spent
}

/** What is still to come this month on accounts: pending incomes and pending bills. */
export function pendingSplit(items: TransactionDto[]) {
  let incomeCents = 0
  let expenseCents = 0
  for (const t of items) {
    if (t.status !== 'PENDING' || t.creditCardId) continue
    if (t.type === 'INCOME') incomeCents += t.amountCents
    if (t.type === 'EXPENSE') expenseCents += t.amountCents
  }
  return { incomeCents, expenseCents }
}
