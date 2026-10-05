import {
  addDays,
  addMonths,
  currentMonthKey,
  lastDayOfMonth,
  nextOccurrence,
  occurrencesBetween,
  resolveInvoiceCycle,
  todayIso,
  type IsoDate,
  type RecurringRuleDto,
  type RecurringRuleInput,
  type UpdateRecurringRuleInput,
} from '@spendly/shared'

import type { RecurringRule } from '../../generated/prisma/client'
import { fromDbDate, toDbDate } from '../../lib/db-dates'
import { HttpError } from '../../lib/http-error'
import { prisma } from '../../lib/prisma'
import { assertHolder } from '../accounts/account.service'
import { loadInvoices, upsertInvoice } from '../cards/invoice.service'

/** How far ahead account occurrences are materialized by default (feeds the forecast). */
const defaultHorizon = () => lastDayOfMonth(addMonths(currentMonthKey(), 1))
/** Never generate further than this. */
const maxHorizon = () => lastDayOfMonth(addMonths(currentMonthKey(), 12))

function toDto(rule: RecurringRule, today: IsoDate = todayIso()): RecurringRuleDto {
  const startDate = fromDbDate(rule.startDate)
  const endDate = rule.endDate ? fromDbDate(rule.endDate) : null
  return {
    id: rule.id,
    type: rule.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
    description: rule.description,
    amountCents: rule.amountCents,
    categoryId: rule.categoryId,
    accountId: rule.accountId,
    creditCardId: rule.creditCardId,
    paidById: rule.paidById,
    frequency: rule.frequency,
    interval: rule.interval,
    startDate,
    endDate,
    autoConfirm: rule.autoConfirm,
    pausedAt: rule.pausedAt?.toISOString() ?? null,
    nextOccurrence: rule.pausedAt
      ? null
      : nextOccurrence(
          { startDate, endDate, frequency: rule.frequency, interval: rule.interval },
          today,
        ),
  }
}

/**
 * Materializes every active rule up to the horizon — idempotent: the unique
 * (recurringRuleId, occurrenceDate) makes repeating it harmless.
 * - Account rules: PENDING rows (bills / expected incomes) up to the horizon.
 * - Card rules: purchases on the right invoice, only once their day arrives.
 * - Auto-confirmed account rows turn PAID when their day arrives.
 */
export async function ensureOccurrences(householdId: string, until?: IsoDate) {
  const today = todayIso()
  const horizon = [until ?? defaultHorizon(), defaultHorizon()].sort().at(-1)!
  const capped = horizon > maxHorizon() ? maxHorizon() : horizon

  const rules = await prisma.recurringRule.findMany({ where: { householdId, pausedAt: null } })
  for (const rule of rules) {
    const config = {
      startDate: fromDbDate(rule.startDate),
      endDate: rule.endDate ? fromDbDate(rule.endDate) : null,
      frequency: rule.frequency,
      interval: rule.interval,
    }
    const from = rule.generatedUntil
      ? addDays(fromDbDate(rule.generatedUntil), 1)
      : config.startDate
    const to = rule.creditCardId ? today : capped
    if (from > to) continue
    const dates = occurrencesBetween(config, from, to)

    if (rule.creditCardId) {
      await generateCardOccurrences(rule, dates)
    } else if (dates.length > 0) {
      await prisma.transaction.createMany({
        skipDuplicates: true,
        data: dates.map((date) => {
          const paid = rule.autoConfirm && rule.accountId !== null && date <= today
          return {
            householdId,
            type: rule.type,
            status: paid ? ('PAID' as const) : ('PENDING' as const),
            amountCents: rule.amountCents,
            date: toDbDate(date),
            dueDate: toDbDate(date),
            paidDate: paid ? toDbDate(date) : null,
            description: rule.description,
            categoryId: rule.categoryId,
            accountId: rule.accountId,
            paidById: rule.paidById,
            recurringRuleId: rule.id,
            occurrenceDate: toDbDate(date),
          }
        }),
      })
    }
    await prisma.recurringRule.update({
      where: { id: rule.id },
      data: { generatedUntil: toDbDate(to) },
    })
  }

  // Automatic debits: confirm the ones whose day has arrived.
  await prisma.$executeRaw`
    UPDATE "Transaction" t
       SET status = 'PAID', "paidDate" = t.date, "updatedAt" = now()
      FROM "RecurringRule" r
     WHERE t."recurringRuleId" = r.id
       AND r."autoConfirm" = true
       AND t."householdId" = ${householdId}::uuid
       AND t.status = 'PENDING'
       AND t."deletedAt" IS NULL
       AND t."accountId" IS NOT NULL
       AND t.date <= ${toDbDate(today)}`
}

async function generateCardOccurrences(rule: RecurringRule, dates: IsoDate[]) {
  if (dates.length === 0 || !rule.creditCardId) return
  const card = await prisma.creditCard.findFirst({
    where: { id: rule.creditCardId, householdId: rule.householdId },
  })
  if (!card) return
  const periods = await loadInvoices(rule.householdId, { creditCardId: card.id })
  for (const date of dates) {
    const exists = await prisma.transaction.findFirst({
      where: { recurringRuleId: rule.id, occurrenceDate: toDbDate(date) },
      select: { id: true },
    })
    if (exists) continue
    const cycle = resolveInvoiceCycle(card, date, periods)
    const invoice = await upsertInvoice(prisma, rule.householdId, card.id, cycle)
    if (!cycle.existing) periods.push({ ...cycle, ...invoiceRowStub(invoice.id, card.id) })
    await prisma.transaction.create({
      data: {
        householdId: rule.householdId,
        type: 'EXPENSE',
        status: 'PAID',
        amountCents: rule.amountCents,
        date: toDbDate(date),
        description: rule.description,
        categoryId: rule.categoryId,
        creditCardId: card.id,
        invoiceId: invoice.id,
        paidById: rule.paidById,
        recurringRuleId: rule.id,
        occurrenceDate: toDbDate(date),
      },
    })
  }
}

const invoiceRowStub = (id: string, creditCardId: string) => ({
  id,
  creditCardId,
  purchasesCents: 0,
  creditsCents: 0,
  paidCents: 0,
  itemCount: 0,
})

async function findRule(householdId: string, id: string) {
  const rule = await prisma.recurringRule.findFirst({ where: { id, householdId } })
  if (!rule) throw HttpError.notFound('Recorrência não encontrada.')
  return rule
}

async function validate(
  householdId: string,
  input: {
    type?: 'EXPENSE' | 'INCOME'
    categoryId?: string | null | undefined
    accountId?: string | null | undefined
    creditCardId?: string | null | undefined
    paidById?: string | null | undefined
  },
  type: 'EXPENSE' | 'INCOME',
) {
  if (input.categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: input.categoryId, householdId, archivedAt: null, kind: type },
      select: { id: true },
    })
    if (!category)
      throw HttpError.field(
        'categoryId',
        type === 'INCOME'
          ? 'Escolha uma categoria de receita.'
          : 'Escolha uma categoria de despesa.',
      )
  }
  if (input.accountId) {
    const account = await prisma.account.findFirst({
      where: { id: input.accountId, householdId, archivedAt: null },
      select: { id: true },
    })
    if (!account) throw HttpError.field('accountId', 'Escolha uma conta ativa da casa.')
  }
  if (input.creditCardId) {
    const card = await prisma.creditCard.findFirst({
      where: { id: input.creditCardId, householdId, archivedAt: null },
      select: { id: true },
    })
    if (!card) throw HttpError.field('creditCardId', 'Escolha um cartão ativo da casa.')
  }
  await assertHolder(householdId, input.paidById)
}

export async function listRecurringRules(householdId: string): Promise<RecurringRuleDto[]> {
  await ensureOccurrences(householdId)
  const rules = await prisma.recurringRule.findMany({
    where: { householdId },
    orderBy: [{ type: 'asc' }, { createdAt: 'asc' }],
  })
  const today = todayIso()
  return rules.map((rule) => toDto(rule, today))
}

export async function createRecurringRule(
  householdId: string,
  memberId: string,
  input: RecurringRuleInput,
): Promise<RecurringRuleDto> {
  const paidById = input.paidById === undefined ? memberId : input.paidById
  await validate(householdId, { ...input, paidById }, input.type)
  const rule = await prisma.recurringRule.create({
    data: {
      householdId,
      type: input.type,
      description: input.description,
      amountCents: input.amountCents,
      categoryId: input.categoryId,
      accountId: input.accountId,
      creditCardId: input.creditCardId,
      paidById,
      frequency: input.frequency,
      interval: input.interval,
      startDate: toDbDate(input.startDate),
      endDate: input.endDate ? toDbDate(input.endDate) : null,
      autoConfirm: input.autoConfirm,
    },
  })
  await ensureOccurrences(householdId)
  return toDto(rule)
}

/** Updates the rule and every occurrence still PENDING from today on (paid history stays). */
export async function updateRecurringRule(
  householdId: string,
  id: string,
  input: UpdateRecurringRuleInput,
): Promise<RecurringRuleDto> {
  const rule = await findRule(householdId, id)
  const type = rule.type === 'INCOME' ? 'INCOME' : 'EXPENSE'
  await validate(householdId, input, type)
  if (input.accountId && rule.creditCardId)
    throw HttpError.field('accountId', 'Esta recorrência é no cartão.')
  if (input.endDate && input.endDate < fromDbDate(rule.startDate))
    throw HttpError.field('endDate', 'O fim vem depois do início.')

  const today = todayIso()
  const futurePending = {
    recurringRuleId: rule.id,
    householdId,
    status: 'PENDING' as const,
    deletedAt: null,
    date: { gte: toDbDate(today) },
  }
  const updated = await prisma.$transaction(async (tx) => {
    const next = await tx.recurringRule.update({
      where: { id: rule.id },
      data: {
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.amountCents !== undefined ? { amountCents: input.amountCents } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
        ...(input.paidById !== undefined ? { paidById: input.paidById } : {}),
        ...(input.autoConfirm !== undefined ? { autoConfirm: input.autoConfirm } : {}),
        ...(input.endDate !== undefined
          ? { endDate: input.endDate ? toDbDate(input.endDate) : null }
          : {}),
      },
    })
    await tx.transaction.updateMany({
      where: futurePending,
      data: {
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.amountCents !== undefined ? { amountCents: input.amountCents } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
        ...(input.paidById !== undefined ? { paidById: input.paidById } : {}),
      },
    })
    if (input.endDate) {
      // Occurrences after the new end disappear (soft delete).
      await tx.transaction.updateMany({
        where: { ...futurePending, date: { gt: toDbDate(input.endDate) } },
        data: { deletedAt: new Date() },
      })
    }
    return next
  })
  return toDto(updated, today)
}

/** Pausing hides the occurrences still to come; resuming brings them back. */
export async function setRecurringRulePaused(
  householdId: string,
  id: string,
  paused: boolean,
): Promise<RecurringRuleDto> {
  const rule = await findRule(householdId, id)
  const today = toDbDate(todayIso())
  const updated = await prisma.$transaction(async (tx) => {
    await tx.transaction.updateMany({
      where: {
        recurringRuleId: rule.id,
        householdId,
        status: 'PENDING',
        date: { gte: today },
        deletedAt: paused ? null : { not: null },
      },
      data: { deletedAt: paused ? new Date() : null },
    })
    return tx.recurringRule.update({
      where: { id: rule.id },
      data: { pausedAt: paused ? new Date() : null },
    })
  })
  if (!paused) await ensureOccurrences(householdId)
  return toDto(updated)
}

/**
 * Removes the rule. Occurrences still to come go away; what already happened stays in the
 * ledger (unlinked from the rule).
 */
export async function deleteRecurringRule(householdId: string, id: string) {
  const rule = await findRule(householdId, id)
  await prisma.$transaction(async (tx) => {
    await tx.transaction.updateMany({
      where: {
        recurringRuleId: rule.id,
        householdId,
        status: 'PENDING',
        date: { gte: toDbDate(todayIso()) },
      },
      data: { deletedAt: new Date() },
    })
    await tx.transaction.updateMany({
      where: { recurringRuleId: rule.id, householdId },
      data: { recurringRuleId: null, occurrenceDate: null },
    })
    await tx.recurringRule.delete({ where: { id: rule.id } })
  })
}
