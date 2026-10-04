import {
  isPaletteKey,
  type AccountDto,
  type CreateAccountInput,
  type UpdateAccountInput,
} from '@spendly/shared'

import type { Account } from '../../generated/prisma/client'
import { fromDbDate, toDbDate } from '../../lib/db-dates'
import { HttpError } from '../../lib/http-error'
import { prisma } from '../../lib/prisma'

function toAccountDto(account: Account, movementCents: number): AccountDto {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    color: isPaletteKey(account.color) ? account.color : 'neutral',
    holderId: account.holderId,
    initialBalanceCents: account.initialBalanceCents,
    initialBalanceDate: fromDbDate(account.initialBalanceDate),
    balanceCents: account.initialBalanceCents + movementCents,
    archivedAt: account.archivedAt?.toISOString() ?? null,
  }
}

/**
 * Net PAID movement per account since its initial-balance date — the derived part of the
 * balance (the balance itself is never stored):
 *   + income into the account · − expenses from it
 *   − transfers out (incl. invoice payments) · + transfers in
 * Pending and soft-deleted rows don't count.
 */
async function movementsByAccount(
  householdId: string,
  accountIds?: string[],
): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<{ id: string; movement: bigint }[]>`
    SELECT a.id,
           COALESCE(SUM(
             CASE
               WHEN t."accountId" = a.id AND t.type = 'INCOME' THEN t."amountCents"
               WHEN t."accountId" = a.id AND t.type IN ('EXPENSE', 'TRANSFER') THEN -t."amountCents"
               WHEN t."toAccountId" = a.id AND t.type = 'TRANSFER' THEN t."amountCents"
               ELSE 0
             END
           ), 0)::bigint AS movement
      FROM "Account" a
      LEFT JOIN "Transaction" t
        ON (t."accountId" = a.id OR t."toAccountId" = a.id)
       AND t."householdId" = a."householdId"
       AND t.status = 'PAID'
       AND t."deletedAt" IS NULL
       AND t.date >= a."initialBalanceDate"
     WHERE a."householdId" = ${householdId}::uuid
     GROUP BY a.id`
  const filter = accountIds ? new Set(accountIds) : null
  return new Map(
    rows.filter((r) => !filter || filter.has(r.id)).map((r) => [r.id, Number(r.movement)]),
  )
}

async function findAccount(householdId: string, id: string): Promise<Account> {
  const account = await prisma.account.findFirst({ where: { id, householdId } })
  if (!account) throw HttpError.notFound('Conta não encontrada.')
  return account
}

async function withBalance(account: Account): Promise<AccountDto> {
  const movements = await movementsByAccount(account.householdId, [account.id])
  return toAccountDto(account, movements.get(account.id) ?? 0)
}

/** The holder must be an active member of the same household (or null = joint). */
export async function assertHolder(householdId: string, holderId: string | null | undefined) {
  if (!holderId) return
  const member = await prisma.householdMember.findFirst({
    where: { id: holderId, householdId, leftAt: null },
    select: { id: true },
  })
  if (!member) throw HttpError.field('holderId', 'Escolha alguém da casa como titular.')
}

async function assertNameAvailable(householdId: string, name: string, exceptId?: string) {
  const clash = await prisma.account.findFirst({
    where: {
      householdId,
      archivedAt: null,
      name: { equals: name, mode: 'insensitive' },
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  })
  if (clash)
    throw HttpError.field('name', `Já existe uma conta chamada “${name}”.`, 409, 'NAME_TAKEN')
}

export async function listAccounts(
  householdId: string,
  includeArchived: boolean,
): Promise<AccountDto[]> {
  const [accounts, movements] = await Promise.all([
    prisma.account.findMany({
      where: { householdId, ...(includeArchived ? {} : { archivedAt: null }) },
      orderBy: [{ archivedAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
    }),
    movementsByAccount(householdId),
  ])
  return accounts.map((account) => toAccountDto(account, movements.get(account.id) ?? 0))
}

export async function createAccount(
  householdId: string,
  input: CreateAccountInput,
): Promise<AccountDto> {
  await assertHolder(householdId, input.holderId)
  await assertNameAvailable(householdId, input.name)
  const account = await prisma.account.create({
    data: {
      householdId,
      name: input.name,
      type: input.type,
      color: input.color,
      holderId: input.holderId,
      initialBalanceCents: input.initialBalanceCents,
      initialBalanceDate: toDbDate(input.initialBalanceDate),
    },
  })
  return toAccountDto(account, 0)
}

export async function updateAccount(
  householdId: string,
  id: string,
  input: UpdateAccountInput,
): Promise<AccountDto> {
  const account = await findAccount(householdId, id)
  await assertHolder(householdId, input.holderId)
  if (input.name !== undefined && input.name.toLowerCase() !== account.name.toLowerCase()) {
    await assertNameAvailable(householdId, input.name, id)
  }
  const updated = await prisma.account.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.holderId !== undefined ? { holderId: input.holderId } : {}),
      ...(input.initialBalanceCents !== undefined
        ? { initialBalanceCents: input.initialBalanceCents }
        : {}),
      ...(input.initialBalanceDate !== undefined
        ? { initialBalanceDate: toDbDate(input.initialBalanceDate) }
        : {}),
    },
  })
  return withBalance(updated)
}

export async function setAccountArchived(
  householdId: string,
  id: string,
  archived: boolean,
): Promise<AccountDto> {
  const account = await findAccount(householdId, id)
  if (!archived) await assertNameAvailable(householdId, account.name, id)
  const updated = await prisma.account.update({
    where: { id },
    data: { archivedAt: archived ? new Date() : null },
  })
  return withBalance(updated)
}

/** Hard delete — only for accounts nothing points at. Otherwise, archive. */
export async function deleteAccount(householdId: string, id: string) {
  const account = await findAccount(householdId, id)
  const [transactions, rules] = await Promise.all([
    prisma.transaction.count({
      where: { OR: [{ accountId: account.id }, { toAccountId: account.id }] },
    }),
    prisma.recurringRule.count({ where: { accountId: account.id } }),
  ])
  if (transactions > 0 || rules > 0) {
    throw HttpError.conflict(
      'Esta conta já tem lançamentos ou recorrências. Arquive em vez de excluir.',
    )
  }
  await prisma.account.delete({ where: { id: account.id } })
}
