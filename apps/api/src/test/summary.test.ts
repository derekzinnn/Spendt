import {
  addMonths,
  currentMonthKey,
  firstDayOfMonth,
  todayIso,
  type AccountDto,
  type CardDto,
  type CategoryDto,
  type DashboardSummaryDto,
} from '@spendly/shared'
import { beforeEach, describe, expect, it } from 'vitest'

import { resetDatabase, signUp, type TestClient } from './helpers'

beforeEach(resetDatabase)

const thisMonth = currentMonthKey()
const today = todayIso()

async function setup() {
  const session = await signUp()
  const { client } = session
  const account = (
    await client.post('/api/accounts', {
      name: 'Conta',
      type: 'CHECKING',
      color: '700',
      holderId: null,
      initialBalanceCents: 0,
      initialBalanceDate: firstDayOfMonth(addMonths(thisMonth, -6)),
    })
  ).body as AccountDto
  const categories = (await client.get('/api/categories')).body as CategoryDto[]
  const market = categories.find((c) => c.name === 'Mercado' && !c.parentId)!
  const marketChild = categories.find((c) => c.parentId === market.id)!
  const leisure = categories.find((c) => c.name === 'Lazer' && !c.parentId)!
  const salary = categories.find((c) => c.name === 'Salário')!
  return { ...session, account, market, marketChild, leisure, salary }
}

const summary = async (client: TestClient, month = thisMonth) =>
  (await client.get(`/api/summary?month=${month}`)).body as DashboardSummaryDto

const spend = (client: TestClient, body: Record<string, unknown>) =>
  client.post('/api/transactions', {
    type: 'EXPENSE',
    amountCents: 10_000,
    date: today,
    description: 'Gasto',
    ...body,
  })

describe('dashboard summary', () => {
  it('rolls subcategories into the parent and ranks by spending', async () => {
    const { client, account, market, marketChild, leisure } = await setup()
    await spend(client, { amountCents: 30_000, categoryId: marketChild.id, accountId: account.id })
    await spend(client, { amountCents: 12_000, categoryId: market.id, accountId: account.id })
    await spend(client, { amountCents: 20_000, categoryId: leisure.id, accountId: account.id })

    const { byCategory } = await summary(client)
    const top = byCategory.slice(0, 2)
    expect(top.map((row) => [row.name, row.spentCents])).toEqual([
      ['Mercado', 42_000],
      ['Lazer', 20_000],
    ])
    // Shares are basis points of the month's spending (62.000 total).
    expect(top[0]!.shareBps).toBe(6774)
    expect(top[0]!.icon).toBe(market.icon)
  })

  it('counts pending bills, subtracts card credits and ignores transfers', async () => {
    const { client, account, market } = await setup()
    const savings = (
      await client.post('/api/accounts', {
        name: 'Reserva',
        type: 'SAVINGS',
        color: '300',
        holderId: null,
        initialBalanceCents: 0,
        initialBalanceDate: firstDayOfMonth(addMonths(thisMonth, -6)),
      })
    ).body as AccountDto
    const card = (
      await client.post('/api/cards', {
        name: 'Nubank',
        brand: 'VISA',
        color: '700',
        lastFour: null,
        limitCents: 500_000,
        closingDay: 25,
        dueDay: 5,
        paymentAccountId: account.id,
        holderId: null,
      })
    ).body as CardDto

    await spend(client, {
      amountCents: 50_000,
      categoryId: market.id,
      status: 'PENDING',
      dueDate: today,
    })
    await client.post('/api/card-purchases', {
      creditCardId: card.id,
      description: 'Mercado',
      amountCents: 30_000,
      date: today,
      categoryId: market.id,
    })
    await client.post('/api/card-purchases', {
      creditCardId: card.id,
      kind: 'REFUND',
      description: 'Estorno',
      amountCents: 5_000,
      date: today,
      categoryId: market.id,
    })
    await client.post('/api/transactions', {
      type: 'TRANSFER',
      amountCents: 90_000,
      date: today,
      description: 'Guardar',
      accountId: account.id,
      toAccountId: savings.id,
    })

    const { byCategory, totals } = await summary(client)
    // 50.000 pending + 30.000 on the card − 5.000 credit; the transfer is not spending.
    expect(byCategory[0]).toMatchObject({ name: 'Mercado', spentCents: 75_000 })
    expect(totals).toMatchObject({ expenseCents: 75_000, pendingExpenseCents: 50_000 })
  })

  it('raises budget alerts at 80% and 100%, worst first', async () => {
    const { client, account, market, leisure } = await setup()
    await client.patch(`/api/categories/${market.id}`, { monthlyBudgetCents: 100_000 })
    await client.patch(`/api/categories/${leisure.id}`, { monthlyBudgetCents: 50_000 })

    await spend(client, { amountCents: 85_000, categoryId: market.id, accountId: account.id })
    const quiet = await summary(client)
    expect(quiet.alerts.map((alert) => [alert.name, alert.thresholdBps])).toEqual([
      ['Mercado', 8_000],
    ])
    expect(quiet.byCategory.find((row) => row.name === 'Mercado')).toMatchObject({
      budgetCents: 100_000,
      usageBps: 8_500,
    })

    await spend(client, { amountCents: 60_000, categoryId: leisure.id, accountId: account.id })
    const loud = await summary(client)
    expect(loud.alerts.map((alert) => [alert.name, alert.usageBps, alert.thresholdBps])).toEqual([
      ['Lazer', 12_000, 10_000],
      ['Mercado', 8_500, 8_000],
    ])

    // A budget with nothing spent still shows in the list, with no alert.
    expect(loud.byCategory.some((row) => row.name === 'Mercado')).toBe(true)
    expect(loud.alerts).toHaveLength(2)
  })

  it('returns six months of trend, empty ones included', async () => {
    const { client, account, market, salary } = await setup()
    await spend(client, { amountCents: 10_000, categoryId: market.id, accountId: account.id })
    await client.post('/api/transactions', {
      type: 'INCOME',
      amountCents: 500_000,
      date: today,
      description: 'Salário',
      categoryId: salary.id,
      accountId: account.id,
    })
    await spend(client, {
      amountCents: 7_000,
      categoryId: market.id,
      accountId: account.id,
      date: firstDayOfMonth(addMonths(thisMonth, -2)),
    })

    const { trend } = await summary(client)
    expect(trend).toHaveLength(6)
    expect(trend.map((point) => point.month)).toEqual(
      Array.from({ length: 6 }, (_, index) => addMonths(thisMonth, index - 5)),
    )
    expect(trend.at(-1)).toMatchObject({ incomeCents: 500_000, expenseCents: 10_000 })
    expect(trend.at(-3)).toMatchObject({ incomeCents: 0, expenseCents: 7_000 })
    expect(trend.at(-2)).toMatchObject({ incomeCents: 0, expenseCents: 0 })
  })

  it('validates the month and never leaks another household', async () => {
    const { client, account, market } = await setup()
    await spend(client, { amountCents: 10_000, categoryId: market.id, accountId: account.id })
    expect((await client.get('/api/summary?month=2026-13')).status).toBe(400)
    expect((await client.get('/api/summary')).status).toBe(400)

    const intruder = await signUp()
    const theirs = await summary(intruder.client)
    expect(theirs.totals.expenseCents).toBe(0)
    expect(theirs.byCategory.every((row) => row.spentCents === 0)).toBe(true)
  })
})
