import {
  addMonths,
  addMonthsToDate,
  currentMonthKey,
  firstDayOfMonth,
  todayIso,
  type AccountDto,
  type CardDto,
  type CategoryDto,
  type RecurringRuleDto,
  type TransactionListDto,
} from '@spendly/shared'
import { beforeEach, describe, expect, it } from 'vitest'

import { resetDatabase, signUp, type TestClient } from './helpers'

beforeEach(resetDatabase)

const thisMonth = currentMonthKey()
const nextMonth = addMonths(thisMonth, 1)
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
      initialBalanceDate: firstDayOfMonth(addMonths(thisMonth, -3)),
    })
  ).body as AccountDto
  const categories = (await client.get('/api/categories')).body as CategoryDto[]
  const housing = categories.find((c) => c.name === 'Moradia')!
  const salary = categories.find((c) => c.name === 'Salário')!
  return { ...session, account, housing, salary }
}

async function createRule(client: TestClient, body: Record<string, unknown>, status = 201) {
  const res = await client.post('/api/recurring-rules', {
    type: 'EXPENSE',
    description: 'Aluguel',
    amountCents: 240_000,
    categoryId: null,
    accountId: null,
    creditCardId: null,
    startDate: firstDayOfMonth(thisMonth),
    ...body,
  })
  expect(res.status, JSON.stringify(res.body)).toBe(status)
  return res.body as RecurringRuleDto
}

const monthRows = async (client: TestClient, month: string) =>
  ((await client.get(`/api/transactions?month=${month}`)).body as TransactionListDto).items

describe('recurring rules', () => {
  it('materializes pending occurrences ahead (idempotent) for bills and forecast', async () => {
    const { client, account, housing } = await setup()
    const rule = await createRule(client, { accountId: account.id, categoryId: housing.id })
    expect(rule.nextOccurrence).not.toBeNull()

    for (let i = 0; i < 2; i++) {
      const rows = await monthRows(client, thisMonth)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        status: 'PENDING',
        amountCents: 240_000,
        recurringRuleId: rule.id,
        dueDate: firstDayOfMonth(thisMonth),
      })
    }
    expect(await monthRows(client, nextMonth)).toHaveLength(1)
    // Looking further ahead generates up to that month.
    expect(await monthRows(client, addMonths(thisMonth, 4))).toHaveLength(1)
  })

  it('auto-confirms automatic debits once their day arrives', async () => {
    const { client, account, salary } = await setup()
    await createRule(client, {
      type: 'INCOME',
      description: 'Salário',
      amountCents: 850_000,
      categoryId: salary.id,
      accountId: account.id,
      startDate: firstDayOfMonth(addMonths(thisMonth, -2)),
      autoConfirm: true,
    })
    const past = await monthRows(client, addMonths(thisMonth, -1))
    expect(past[0]).toMatchObject({ status: 'PAID', paidDate: past[0]!.date })
    expect((await monthRows(client, nextMonth))[0]?.status).toBe('PENDING')

    const balance = ((await client.get('/api/accounts')).body as AccountDto[])[0]!.balanceCents
    // Two (or three, from the 1st of this month) salaries already paid.
    expect(balance).toBe(850_000 * 3)
  })

  it('card subscriptions land on invoices only when their day arrives', async () => {
    const { client } = await setup()
    const card = (
      await client.post('/api/cards', {
        name: 'Nubank',
        brand: 'VISA',
        color: '700',
        lastFour: null,
        limitCents: 500_000,
        closingDay: 25,
        dueDay: 5,
        paymentAccountId: null,
        holderId: null,
      })
    ).body as CardDto
    await createRule(client, {
      description: 'Netflix',
      amountCents: 4_490,
      creditCardId: card.id,
      startDate: addMonthsToDate(firstDayOfMonth(thisMonth), -1),
    })
    const cards = (await client.get('/api/cards')).body as CardDto[]
    expect(cards[0]!.usedCents).toBe(4_490 * 2) // last month + the 1st of this month
    expect(await monthRows(client, nextMonth)).toHaveLength(0)
  })

  it('edits apply to pending occurrences from today on; paid history stays', async () => {
    const { client, account } = await setup()
    const rule = await createRule(client, {
      accountId: account.id,
      startDate: firstDayOfMonth(addMonths(thisMonth, -1)),
      autoConfirm: true,
    })
    const res = await client.patch(`/api/recurring-rules/${rule.id}`, { amountCents: 250_000 })
    expect(res.body.amountCents).toBe(250_000)
    expect((await monthRows(client, addMonths(thisMonth, -1)))[0]?.amountCents).toBe(240_000)
    expect((await monthRows(client, nextMonth))[0]?.amountCents).toBe(250_000)
  })

  it('pauses, resumes and deletes', async () => {
    const { client, account } = await setup()
    const rule = await createRule(client, {
      accountId: account.id,
      startDate: firstDayOfMonth(addMonths(thisMonth, -1)),
      autoConfirm: true,
    })
    await client.post(`/api/recurring-rules/${rule.id}/pause`)
    expect(await monthRows(client, nextMonth)).toHaveLength(0)
    const paused = ((await client.get('/api/recurring-rules')).body as RecurringRuleDto[])[0]!
    expect(paused).toMatchObject({ nextOccurrence: null })
    expect(paused.pausedAt).not.toBeNull()

    await client.post(`/api/recurring-rules/${rule.id}/resume`)
    expect(await monthRows(client, nextMonth)).toHaveLength(1)

    expect((await client.delete(`/api/recurring-rules/${rule.id}`)).status).toBe(204)
    expect(await monthRows(client, nextMonth)).toHaveLength(0)
    // What already happened stays in the ledger.
    const last = await monthRows(client, addMonths(thisMonth, -1))
    expect(last[0]).toMatchObject({ status: 'PAID', recurringRuleId: null })
    expect(today).toBeTruthy()
  })

  it('validates', async () => {
    const { client, account, housing, salary } = await setup()
    const intruder = await signUp()
    await createRule(client, { accountId: account.id, creditCardId: account.id }, 400)
    await createRule(client, { categoryId: salary.id }, 400)
    await createRule(client, { type: 'INCOME', categoryId: housing.id }, 400)
    await createRule(client, { endDate: '2000-01-01' }, 400)
    const rule = await createRule(client, { accountId: account.id })
    expect(
      (await intruder.client.patch(`/api/recurring-rules/${rule.id}`, { amountCents: 1 })).status,
    ).toBe(404)
    expect((await intruder.client.get('/api/recurring-rules')).body).toHaveLength(0)
  })
})
