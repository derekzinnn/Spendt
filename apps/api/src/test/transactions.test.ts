import type {
  AccountDto,
  CardDto,
  CategoryDto,
  TransactionDto,
  TransactionListDto,
} from '@spendly/shared'
import { beforeEach, describe, expect, it } from 'vitest'

import { resetDatabase, signUp, type TestClient } from './helpers'

beforeEach(resetDatabase)

async function setup() {
  const session = await signUp()
  const { client } = session
  const account = async (name: string, initial = 100_000) =>
    (
      await client.post('/api/accounts', {
        name,
        type: 'CHECKING',
        color: '700',
        holderId: null,
        initialBalanceCents: initial,
        initialBalanceDate: '2026-10-01',
      })
    ).body as AccountDto
  const main = await account('Conta')
  const savings = await account('Reserva', 0)
  const categories = (await client.get('/api/categories')).body as CategoryDto[]
  const market = categories.find((c) => c.name === 'Mercado' && !c.parentId)!
  const supermarket = categories.find((c) => c.parentId === market.id)!
  const salary = categories.find((c) => c.name === 'Salário')!
  return { ...session, main, savings, market, supermarket, salary }
}

const post = async (client: TestClient, body: Record<string, unknown>, status = 201) => {
  const res = await client.post('/api/transactions', body)
  expect(res.status, JSON.stringify(res.body)).toBe(status)
  return res.body as TransactionDto
}

const list = async (client: TestClient, query = 'month=2026-10') =>
  (await client.get(`/api/transactions?${query}`)).body as TransactionListDto

const balanceOf = async (client: TestClient, id: string) =>
  ((await client.get('/api/accounts')).body as AccountDto[]).find((a) => a.id === id)!.balanceCents

describe('transactions', () => {
  it('creates expenses, incomes and transfers and moves the balances', async () => {
    const { client, main, savings, supermarket, salary, me } = await setup()
    const expense = await post(client, {
      type: 'EXPENSE',
      amountCents: 12_345,
      date: '2026-10-03',
      description: 'Feira',
      categoryId: supermarket.id,
      accountId: main.id,
    })
    expect(expense).toMatchObject({
      status: 'PAID',
      paidDate: '2026-10-03',
      paidById: me.member!.id,
    })
    await post(client, {
      type: 'INCOME',
      amountCents: 500_000,
      date: '2026-10-05',
      description: 'Salário',
      categoryId: salary.id,
      accountId: main.id,
    })
    await post(client, {
      type: 'TRANSFER',
      amountCents: 50_000,
      date: '2026-10-06',
      description: 'Guardar',
      accountId: main.id,
      toAccountId: savings.id,
    })
    expect(await balanceOf(client, main.id)).toBe(100_000 - 12_345 + 500_000 - 50_000)
    expect(await balanceOf(client, savings.id)).toBe(50_000)

    const { items, totals } = await list(client)
    expect(items.map((t) => t.description)).toEqual(['Guardar', 'Salário', 'Feira'])
    expect(totals).toMatchObject({
      incomeCents: 500_000,
      expenseCents: 12_345,
      netCents: 487_655,
      count: 3,
    })
  })

  it('validates shapes: accounts, categories by kind, transfers, pending bills', async () => {
    const { client, main, market, salary } = await setup()
    const base = { amountCents: 1_000, date: '2026-10-03', description: 'x' }
    await post(client, { ...base, type: 'EXPENSE' }, 400) // PAID needs an account
    await post(client, { ...base, type: 'EXPENSE', status: 'PENDING' }, 400) // needs a due date
    await post(client, { ...base, type: 'EXPENSE', accountId: main.id, categoryId: salary.id }, 400)
    await post(client, { ...base, type: 'INCOME', accountId: main.id, categoryId: market.id }, 400)
    await post(client, { ...base, type: 'TRANSFER', accountId: main.id, toAccountId: main.id }, 400)
    await post(
      client,
      { ...base, type: 'TRANSFER', accountId: main.id, toAccountId: (await setup()).main.id },
      400,
    ) // another household's account

    const bill = await post(client, {
      ...base,
      type: 'EXPENSE',
      status: 'PENDING',
      dueDate: '2026-10-10',
      description: 'Luz',
      categoryId: market.id,
    })
    expect(bill).toMatchObject({ status: 'PENDING', accountId: null, paidDate: null })
    // Pending rows don't touch the balance.
    expect(await balanceOf(client, main.id)).toBe(100_000)
  })

  it('marks a bill as paid (records the paid date) and back', async () => {
    const { client, main, market } = await setup()
    const bill = await post(client, {
      type: 'EXPENSE',
      status: 'PENDING',
      amountCents: 21_870,
      date: '2026-10-01',
      dueDate: '2026-10-10',
      description: 'Luz',
      categoryId: market.id,
    })
    // Paying needs the account it left from.
    expect((await client.patch(`/api/transactions/${bill.id}`, { status: 'PAID' })).status).toBe(
      400,
    )
    const paid = await client.patch(`/api/transactions/${bill.id}`, {
      status: 'PAID',
      accountId: main.id,
      paidDate: '2026-10-09',
    })
    expect(paid.body).toMatchObject({ status: 'PAID', paidDate: '2026-10-09' })
    expect(await balanceOf(client, main.id)).toBe(100_000 - 21_870)

    const back = await client.patch(`/api/transactions/${bill.id}`, { status: 'PENDING' })
    expect(back.body).toMatchObject({ status: 'PENDING', paidDate: null })
  })

  it('filters by kind, category (incl. children), account, text and month', async () => {
    const { client, main, savings, market, supermarket, salary } = await setup()
    const mk = (body: Record<string, unknown>) =>
      post(client, { amountCents: 1_000, date: '2026-10-03', accountId: main.id, ...body })
    await mk({ type: 'EXPENSE', description: 'Padaria', categoryId: supermarket.id })
    await mk({ type: 'EXPENSE', description: 'Mercadinho', categoryId: market.id })
    await mk({ type: 'INCOME', description: 'Freela', categoryId: salary.id })
    await mk({ type: 'TRANSFER', description: 'Guardar', toAccountId: savings.id })
    await mk({ type: 'EXPENSE', description: 'Mês passado', date: '2026-09-30' })

    expect((await list(client, 'month=2026-10&kind=expense')).totals.count).toBe(2)
    expect((await list(client, 'month=2026-10&kind=income')).totals.count).toBe(1)
    expect((await list(client, 'month=2026-10&kind=transfer')).totals.count).toBe(1)
    expect((await list(client, `month=2026-10&categoryId=${market.id}`)).totals.count).toBe(2)
    expect((await list(client, `month=2026-10&accountId=${savings.id}`)).totals.count).toBe(1)
    expect((await list(client, 'month=2026-10&q=pada')).items[0]?.description).toBe('Padaria')
    expect((await list(client, 'month=2026-09')).totals.count).toBe(1)
    expect((await client.get('/api/transactions?month=2026-13')).status).toBe(400)
  })

  it('lists card purchases; card rows only accept text edits', async () => {
    const { client, market, main } = await setup()
    const card = (
      await client.post('/api/cards', {
        name: 'Nubank',
        brand: 'VISA',
        color: '700',
        lastFour: null,
        limitCents: 100_000,
        closingDay: 25,
        dueDay: 5,
        paymentAccountId: null,
        holderId: null,
      })
    ).body as CardDto
    await client.post('/api/card-purchases', {
      creditCardId: card.id,
      description: 'Fone',
      amountCents: 30_000,
      date: '2026-10-10',
      categoryId: null,
      installments: 3,
    })
    await client.post('/api/card-purchases', {
      creditCardId: card.id,
      kind: 'REFUND',
      description: 'Estorno',
      amountCents: 2_000,
      date: '2026-10-11',
      categoryId: null,
    })
    const october = await list(client)
    expect(october.items).toHaveLength(2) // installment 1 of 3 + the refund
    expect(october.totals.expenseCents).toBe(8_000) // 10.000 − 2.000 credit
    expect(october.items.find((t) => t.description === 'Fone')).toMatchObject({
      installmentNumber: 1,
      installmentCount: 3,
    })

    const first = october.items.find((t) => t.description === 'Fone')!
    const locked = await client.patch(`/api/transactions/${first.id}`, { amountCents: 1 })
    expect(locked.status).toBe(400)
    expect(locked.body.error.code).toBe('CARD_ROW_LOCKED')
    const renamed = await client.patch(`/api/transactions/${first.id}`, {
      description: 'Fone novo',
      categoryId: market.id,
    })
    expect(renamed.body).toMatchObject({ description: 'Fone novo', categoryId: market.id })

    // Deleting an installment row honours the scope.
    const removed = await client.delete(`/api/transactions/${first.id}?scope=all`)
    expect(removed.body.ids).toHaveLength(3)
    expect(main.id).toBeTruthy()
  })

  it('soft-deletes and restores (Desfazer), and isolates households', async () => {
    const { client, main } = await setup()
    const row = await post(client, {
      type: 'EXPENSE',
      amountCents: 5_000,
      date: '2026-10-03',
      description: 'Cinema',
      accountId: main.id,
    })
    const removed = await client.delete(`/api/transactions/${row.id}`)
    expect(removed.body.ids).toEqual([row.id])
    expect((await list(client)).totals.count).toBe(0)
    expect(await balanceOf(client, main.id)).toBe(100_000)

    await client.post('/api/transactions/restore', { ids: [row.id] })
    expect((await list(client)).totals.count).toBe(1)

    const intruder = await signUp()
    expect(
      (await intruder.client.patch(`/api/transactions/${row.id}`, { description: 'x' })).status,
    ).toBe(404)
    expect((await intruder.client.delete(`/api/transactions/${row.id}`)).status).toBe(404)
    expect((await list(intruder.client)).totals.count).toBe(0)
    await intruder.client.post('/api/transactions/restore', { ids: [row.id] })
  })
})
