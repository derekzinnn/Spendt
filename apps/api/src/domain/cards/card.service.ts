import {
  isPaletteKey,
  todayIso,
  type CardDto,
  type CreateCardInput,
  type UpdateCardInput,
} from '@spendly/shared'

import type { CreditCard } from '../../generated/prisma/client'
import { HttpError } from '../../lib/http-error'
import { prisma } from '../../lib/prisma'
import { assertHolder } from '../accounts/account.service'

import { currentInvoiceOf, loadInvoices, type InvoiceRow } from './invoice.service'

/**
 * Limit used per card, derived (never stored): purchases − credits − PAID invoice payments,
 * over every non-deleted row — future installments consume the limit up front, like banks do.
 */
async function usageByCard(householdId: string): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<{ id: string; used: bigint }[]>`
    SELECT c.id,
           COALESCE(SUM(
             CASE
               WHEN t.type = 'EXPENSE' THEN t."amountCents"
               WHEN t.type = 'INCOME' THEN -t."amountCents"
               WHEN t.type = 'TRANSFER' AND t.status = 'PAID' THEN -t."amountCents"
               ELSE 0
             END
           ), 0)::bigint AS used
      FROM "CreditCard" c
      LEFT JOIN "Transaction" t
        ON t."creditCardId" = c.id
       AND t."householdId" = c."householdId"
       AND t."deletedAt" IS NULL
     WHERE c."householdId" = ${householdId}::uuid
     GROUP BY c.id`
  return new Map(rows.map((r) => [r.id, Number(r.used)]))
}

function toCardDto(card: CreditCard, usedCents: number, invoices: InvoiceRow[]): CardDto {
  return {
    id: card.id,
    name: card.name,
    brand: card.brand,
    color: isPaletteKey(card.color) ? card.color : 'neutral',
    lastFour: card.lastFour,
    limitCents: card.limitCents,
    closingDay: card.closingDay,
    dueDay: card.dueDay,
    paymentAccountId: card.paymentAccountId,
    holderId: card.holderId,
    archivedAt: card.archivedAt?.toISOString() ?? null,
    usedCents,
    availableCents: card.limitCents - usedCents,
    currentInvoice: currentInvoiceOf(
      card,
      invoices.filter((inv) => inv.creditCardId === card.id),
      todayIso(),
    ),
  }
}

export async function findCard(householdId: string, id: string): Promise<CreditCard> {
  const card = await prisma.creditCard.findFirst({ where: { id, householdId } })
  if (!card) throw HttpError.notFound('Cartão não encontrado.')
  return card
}

async function withDerived(card: CreditCard): Promise<CardDto> {
  const [usage, invoices] = await Promise.all([
    usageByCard(card.householdId),
    loadInvoices(card.householdId, { creditCardId: card.id }),
  ])
  return toCardDto(card, usage.get(card.id) ?? 0, invoices)
}

async function assertPaymentAccount(householdId: string, accountId: string | null | undefined) {
  if (!accountId) return
  const account = await prisma.account.findFirst({
    where: { id: accountId, householdId, archivedAt: null },
    select: { id: true },
  })
  if (!account) throw HttpError.field('paymentAccountId', 'Escolha uma conta ativa da casa.')
}

async function assertNameAvailable(householdId: string, name: string, exceptId?: string) {
  const clash = await prisma.creditCard.findFirst({
    where: {
      householdId,
      archivedAt: null,
      name: { equals: name, mode: 'insensitive' },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  })
  if (clash)
    throw HttpError.field('name', `Já existe um cartão chamado “${name}”.`, 409, 'NAME_TAKEN')
}

export async function listCards(householdId: string, includeArchived: boolean): Promise<CardDto[]> {
  const [cards, usage, invoices] = await Promise.all([
    prisma.creditCard.findMany({
      where: { householdId, ...(includeArchived ? {} : { archivedAt: null }) },
      orderBy: [{ archivedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
    }),
    usageByCard(householdId),
    loadInvoices(householdId),
  ])
  return cards.map((card) => toCardDto(card, usage.get(card.id) ?? 0, invoices))
}

export async function getCard(householdId: string, id: string): Promise<CardDto> {
  return withDerived(await findCard(householdId, id))
}

export async function createCard(householdId: string, input: CreateCardInput): Promise<CardDto> {
  await assertHolder(householdId, input.holderId)
  await assertPaymentAccount(householdId, input.paymentAccountId)
  await assertNameAvailable(householdId, input.name)
  const card = await prisma.creditCard.create({ data: { householdId, ...input } })
  return toCardDto(card, 0, [])
}

/**
 * Changing the closing or due day only affects invoices created from now on: existing
 * invoices are snapshots and keep their dates.
 */
export async function updateCard(
  householdId: string,
  id: string,
  input: UpdateCardInput,
): Promise<CardDto> {
  const card = await findCard(householdId, id)
  await assertHolder(householdId, input.holderId)
  await assertPaymentAccount(householdId, input.paymentAccountId)
  if (input.name !== undefined && input.name.toLowerCase() !== card.name.toLowerCase()) {
    await assertNameAvailable(householdId, input.name, id)
  }
  const data = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  ) as UpdateCardInput
  const updated = await prisma.creditCard.update({ where: { id }, data })
  return withDerived(updated)
}

export async function setCardArchived(
  householdId: string,
  id: string,
  archived: boolean,
): Promise<CardDto> {
  const card = await findCard(householdId, id)
  if (!archived) await assertNameAvailable(householdId, card.name, id)
  const updated = await prisma.creditCard.update({
    where: { id },
    data: { archivedAt: archived ? new Date() : null },
  })
  return withDerived(updated)
}

/** Hard delete — only for cards nothing points at. Otherwise, archive. */
export async function deleteCard(householdId: string, id: string) {
  const card = await findCard(householdId, id)
  const [transactions, rules] = await Promise.all([
    prisma.transaction.count({ where: { creditCardId: card.id } }),
    prisma.recurringRule.count({ where: { creditCardId: card.id } }),
  ])
  if (transactions > 0 || rules > 0) {
    throw HttpError.conflict(
      'Este cartão já tem compras ou recorrências. Arquive em vez de excluir.',
    )
  }
  await prisma.$transaction([
    prisma.invoice.deleteMany({ where: { creditCardId: card.id } }),
    prisma.creditCard.delete({ where: { id: card.id } }),
  ])
}
