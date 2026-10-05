import {
  addDays,
  addMonths,
  currentMonthKey,
  firstDayOfMonth,
  todayIso,
  type AccountDto,
  type BillsDto,
  type CardDto,
  type CardPurchaseResultDto,
  type InvoiceSummaryDto,
  type TransactionDto,
} from '@spendly/shared'
import { beforeEach, describe, expect, it } from 'vitest'

import { resetDatabase, signUp, type TestClient } from './helpers'

beforeEach(resetDatabase)

const today = todayIso()
const thisMonth = currentMonthKey()

async function setup() {
  const session = await signUp()
  const { client } = session
  const account = (
    await client.post('/api/accounts', {
      name: 'Conta',
      type: 'CHECKING',
      color: '700',
      holderId: null,
      initialBalanceCents: 500_000,
      initialBalanceDate: firstDayOfMonth(addMonths(thisMonth, -2)),
    })
  ).body as AccountDto
  return { ...session, account }
}

async function createBill(
  client: TestClient,
  overrides: Record<string, unknown> = {},
): Promise<TransactionDto> {
  const res = await client.post('/api/transactions', {
    type: 'EXPENSE',
    status: 'PENDING',
    amountCents: 21_870,
    date: today,
    dueDate: today,
    description: 'Luz',
    ...overrides,
  })
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  return res.body as TransactionDto
}

async function createCardWithPurchase(client: TestClient, accountId: string | null = null) {
  const card = (
    await client.post('/api/cards', {
      name: 'Nubank',
      brand: 'VISA',
      color: '700',
      lastFour: null,
      limitCents: 800_000,
      closingDay: 25,
      dueDay: 5,
      paymentAccountId: accountId,
      holderId: null,
    })
  ).body as CardDto
  const purchase = (
    await client.post('/api/card-purchases', {
      creditCardId: card.id,
      description: 'Mercado',
      amountCents: 30_000,
      date: today,
      categoryId: null,
    })
  ).body as CardPurchaseResultDto
  return { card, purchase }
}

const bills = async (client: TestClient, month = thisMonth) =>
  (await client.get(`/api/bills?month=${month}`)).body as BillsDto

describe('bills ("Contas a pagar")', () => {
  it('lists pending rows and unpaid invoices by due date, with buckets', async () => {
    const { client, account } = await setup()
    await createBill(client, { description: 'Atrasada', dueDate: addDays(today, -3) })
    await createBill(client, { description: 'Hoje', dueDate: today })
    await createBill(client, { description: 'Essa semana', dueDate: addDays(today, 5) })
    await createBill(client, {
      description: 'Depois',
      dueDate: addDays(today, 20),
      accountId: account.id,
    })
    const { purchase } = await createCardWithPurchase(client, account.id)

    const { items, totals } = await bills(client, addMonths(thisMonth, 1))
    const byDescription = Object.fromEntries(items.map((bill) => [bill.description, bill]))
    expect(byDescription['Atrasada']).toMatchObject({ bucket: 'overdue', daysUntilDue: -3 })
    expect(byDescription['Hoje']).toMatchObject({ bucket: 'today', daysUntilDue: 0 })
    expect(byDescription['Essa semana']).toMatchObject({ bucket: 'week' })
    expect(byDescription['Depois']).toMatchObject({ bucket: 'later', accountId: account.id })

    // The invoice shows up as a bill on its due date, suggesting the card's payment account.
    const invoice = items.find((bill) => bill.kind === 'invoice')!
    expect(invoice).toMatchObject({
      description: 'Fatura Nubank',
      amountCents: 30_000,
      totalCents: 30_000,
      paidCents: 0,
      accountId: account.id,
      dueDate: purchase.invoice.dueDate,
    })

    // Sorted by due date, and the overdue total is just the late one.
    expect([...items].map((b) => b.dueDate)).toEqual([...items].map((b) => b.dueDate).sort())
    expect(totals.overdueCents).toBe(21_870)
    expect(totals.dueCents).toBe(21_870 * 4 + 30_000)
    expect(totals.count).toBe(5)
  })

  it('keeps overdue bills visible in later months and hides what is not due yet', async () => {
    const { client } = await setup()
    await createBill(client, { description: 'Atrasada', dueDate: addDays(today, -40) })
    await createBill(client, {
      description: 'Mês que vem',
      dueDate: firstDayOfMonth(addMonths(thisMonth, 1)),
    })

    const now = await bills(client, thisMonth)
    expect(now.items.map((b) => b.description)).toEqual(['Atrasada'])

    const next = await bills(client, addMonths(thisMonth, 1))
    expect(next.items.map((b) => b.description)).toEqual(['Atrasada', 'Mês que vem'])
  })

  it('pays a bill from an account: it leaves the list and moves the balance', async () => {
    const { client, account } = await setup()
    const bill = await createBill(client, { amountCents: 50_000 })

    const paid = await client.post(`/api/bills/${bill.id}/pay`, { accountId: account.id })
    expect(paid.status).toBe(200)
    expect(paid.body).toMatchObject({ status: 'PAID', accountId: account.id, paidDate: today })

    const after = await bills(client)
    expect(after.items).toHaveLength(0)
    expect(after.paid.map((b) => b.description)).toEqual(['Luz'])
    expect(after.totals).toMatchObject({ dueCents: 0, paidCents: 50_000, paidCount: 1 })

    const balance = ((await client.get('/api/accounts')).body as AccountDto[])[0]!.balanceCents
    expect(balance).toBe(500_000 - 50_000)
  })

  it('never shows another household its bills', async () => {
    const { client } = await setup()
    await createBill(client)
    const intruder = await signUp()
    expect((await bills(intruder.client)).items).toHaveLength(0)
  })
})

describe('invoice payment', () => {
  it('pays in full: balance drops, limit frees, invoice turns paid', async () => {
    const { client, account } = await setup()
    const { card, purchase } = await createCardWithPurchase(client, account.id)

    const res = await client.post(`/api/invoices/${purchase.invoice.id}/payments`, {
      accountId: account.id,
      amountCents: 30_000,
    })
    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ settled: true })
    expect(res.body.invoice).toMatchObject({
      paidCents: 30_000,
      totalCents: 30_000,
      status: 'paid',
    })

    const balance = ((await client.get('/api/accounts')).body as AccountDto[])[0]!.balanceCents
    expect(balance).toBe(500_000 - 30_000)
    const after = (await client.get(`/api/cards/${card.id}`)).body as CardDto
    expect(after).toMatchObject({ usedCents: 0, availableCents: 800_000 })
    expect((await bills(client, addMonths(thisMonth, 1))).items).toHaveLength(0)
  })

  it('accepts partial payments and refuses to overpay', async () => {
    const { client, account } = await setup()
    const { purchase } = await createCardWithPurchase(client, account.id)
    const invoiceId = purchase.invoice.id!

    const partial = await client.post(`/api/invoices/${invoiceId}/payments`, {
      accountId: account.id,
      amountCents: 10_000,
    })
    expect(partial.body).toMatchObject({ settled: false })
    expect(partial.body.invoice).toMatchObject({ paidCents: 10_000, status: 'partially_paid' })

    const tooMuch = await client.post(`/api/invoices/${invoiceId}/payments`, {
      accountId: account.id,
      amountCents: 25_000,
    })
    expect(tooMuch.status).toBe(409)
    expect(tooMuch.body.error.code).toBe('OVERPAYMENT')

    // What is left still shows in "Contas a pagar".
    const list = await bills(client, addMonths(thisMonth, 1))
    expect(list.items.find((b) => b.kind === 'invoice')).toMatchObject({
      amountCents: 20_000,
      paidCents: 10_000,
      totalCents: 30_000,
    })

    const rest = await client.post(`/api/invoices/${invoiceId}/payments`, {
      accountId: account.id,
      amountCents: 20_000,
    })
    expect(rest.body).toMatchObject({ settled: true })
    expect(
      (
        await client.post(`/api/invoices/${invoiceId}/payments`, {
          accountId: account.id,
          amountCents: 100,
        })
      ).body.error.code,
    ).toBe('INVOICE_PAID')
  })

  it('undoing a payment puts the invoice back', async () => {
    const { client, account } = await setup()
    const { card, purchase } = await createCardWithPurchase(client, account.id)
    const payment = await client.post(`/api/invoices/${purchase.invoice.id}/payments`, {
      accountId: account.id,
      amountCents: 30_000,
    })

    await client.delete(`/api/transactions/${payment.body.transactionId}`)
    const invoices = (await client.get(`/api/cards/${card.id}/invoices`))
      .body as InvoiceSummaryDto[]
    expect(invoices[0]).toMatchObject({ paidCents: 0, status: 'open' })
    const balance = ((await client.get('/api/accounts')).body as AccountDto[])[0]!.balanceCents
    expect(balance).toBe(500_000)
  })

  it('validates the account, the invoice and empty invoices', async () => {
    const { client, account } = await setup()
    const { purchase } = await createCardWithPurchase(client, account.id)
    const invoiceId = purchase.invoice.id!
    const other = await signUp()

    expect(
      (
        await client.post(`/api/invoices/${invoiceId}/payments`, {
          accountId: other.me.member!.id,
          amountCents: 100,
        })
      ).status,
    ).toBe(400)
    expect(
      (
        await client.post(`/api/invoices/${invoiceId}/payments`, {
          accountId: account.id,
          amountCents: 0,
        })
      ).status,
    ).toBe(400)
    expect(
      (
        await other.client.post(`/api/invoices/${invoiceId}/payments`, {
          accountId: account.id,
          amountCents: 100,
        })
      ).status,
    ).toBe(404)
  })
})
