import type {
  AccountDto,
  CardDto,
  CardPurchaseResultDto,
  CategoryDto,
  InvoiceDetailDto,
  InvoiceSummaryDto,
} from '@spendly/shared'
import { beforeEach, describe, expect, it } from 'vitest'

import { toDbDate } from '../lib/db-dates'

import { prisma, resetDatabase, signUp, type TestClient } from './helpers'

beforeEach(resetDatabase)

async function createCard(client: TestClient, overrides: Record<string, unknown> = {}) {
  const res = await client.post('/api/cards', {
    name: 'Nubank',
    brand: 'MASTERCARD',
    color: '700',
    lastFour: '4821',
    limitCents: 800_000,
    closingDay: 25,
    dueDay: 5,
    paymentAccountId: null,
    holderId: null,
    ...overrides,
  })
  expect(res.status).toBe(201)
  return res.body as CardDto
}

async function buy(client: TestClient, card: CardDto, overrides: Record<string, unknown> = {}) {
  const res = await client.post('/api/card-purchases', {
    creditCardId: card.id,
    description: 'Mercado',
    amountCents: 10_000,
    date: '2026-10-24',
    categoryId: null,
    ...overrides,
  })
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  return res.body as CardPurchaseResultDto
}

const invoicesOf = async (client: TestClient, card: CardDto) =>
  (await client.get(`/api/cards/${card.id}/invoices`)).body as InvoiceSummaryDto[]

describe('cards', () => {
  it('creates, lists and edits a card; limit starts fully available', async () => {
    const { client } = await signUp()
    const card = await createCard(client)
    expect(card).toMatchObject({
      name: 'Nubank',
      closingDay: 25,
      dueDay: 5,
      usedCents: 0,
      availableCents: 800_000,
    })
    expect(card.currentInvoice).toMatchObject({ id: null, totalCents: 0, itemCount: 0 })

    const edited = await client.patch(`/api/cards/${card.id}`, { name: 'Roxinho', dueDay: 10 })
    expect(edited.body).toMatchObject({ name: 'Roxinho', dueDay: 10, closingDay: 25 })
    expect((await client.get('/api/cards')).body).toHaveLength(1)
  })

  it('validates days, last four digits, payment account and holder', async () => {
    const { client } = await signUp()
    const bad = await client.post('/api/cards', {
      name: 'X',
      brand: 'VISA',
      color: '700',
      lastFour: '12a4',
      limitCents: 0,
      closingDay: 0,
      dueDay: 32,
      paymentAccountId: null,
      holderId: null,
    })
    expect(bad.status).toBe(400)
    const paths = (bad.body.error.details as { path: string }[]).map((d) => d.path)
    expect(paths).toEqual(
      expect.arrayContaining(['lastFour', 'limitCents', 'closingDay', 'dueDay']),
    )

    const other = await signUp()
    const foreignAccount = (
      await other.client.post('/api/accounts', {
        name: 'Conta',
        type: 'CHECKING',
        color: '700',
        holderId: null,
        initialBalanceCents: 0,
        initialBalanceDate: '2026-10-01',
      })
    ).body as AccountDto
    const res = await client.post('/api/cards', {
      name: 'Inter',
      brand: 'VISA',
      color: '300',
      lastFour: null,
      limitCents: 100_000,
      closingDay: 3,
      dueDay: 10,
      paymentAccountId: foreignAccount.id,
      holderId: other.me.member!.id,
    })
    expect(res.status).toBe(400)
  })

  it('rejects duplicate active names and isolates households', async () => {
    const { client } = await signUp()
    const card = await createCard(client)
    expect((await client.post('/api/cards', { ...card, id: undefined })).status).toBe(409)

    const intruder = await signUp()
    expect((await intruder.client.get(`/api/cards/${card.id}`)).status).toBe(404)
    expect((await intruder.client.get(`/api/cards/${card.id}/invoices`)).status).toBe(404)
    expect(
      (
        await intruder.client.post('/api/card-purchases', {
          creditCardId: card.id,
          description: 'x',
          amountCents: 100,
          date: '2026-10-01',
          categoryId: null,
        })
      ).status,
    ).toBe(404)
  })

  it('deletes only unused cards; archived cards refuse purchases', async () => {
    const { client } = await signUp()
    const empty = await createCard(client, { name: 'Vazio' })
    expect((await client.delete(`/api/cards/${empty.id}`)).status).toBe(204)

    const used = await createCard(client)
    await buy(client, used)
    expect((await client.delete(`/api/cards/${used.id}`)).status).toBe(409)

    expect((await client.post(`/api/cards/${used.id}/archive`)).body.archivedAt).not.toBeNull()
    const refused = await client.post('/api/card-purchases', {
      creditCardId: used.id,
      description: 'x',
      amountCents: 100,
      date: '2026-10-01',
      categoryId: null,
    })
    expect(refused.status).toBe(409)
    expect((await client.get('/api/cards')).body).toHaveLength(0)
    expect((await client.get('/api/cards?includeArchived=true')).body).toHaveLength(1)
  })
})

describe('invoice assignment', () => {
  it('assigns by closing day: before closing → this invoice, on closing → next', async () => {
    const { client } = await signUp()
    const card = await createCard(client) // closes 25, due 5

    const before = await buy(client, card, { date: '2026-10-24' })
    expect(before.invoice).toMatchObject({
      referenceMonth: '2026-11',
      periodStart: '2026-09-25',
      closingDate: '2026-10-25',
      dueDate: '2026-11-05',
      totalCents: 10_000,
    })

    const onClosing = await buy(client, card, { date: '2026-10-25' })
    expect(onClosing.invoice).toMatchObject({
      referenceMonth: '2026-12',
      periodStart: '2026-10-25',
      closingDate: '2026-11-25',
      dueDate: '2026-12-05',
    })

    // A second purchase in the same cycle reuses the same invoice.
    const again = await buy(client, card, { date: '2026-10-01', amountCents: 2_500 })
    expect(again.invoice.id).toBe(before.invoice.id)
    expect(again.invoice).toMatchObject({ totalCents: 12_500, itemCount: 2 })
  })

  it('clamps day 31 to February (and to 29 in leap years)', async () => {
    const { client } = await signUp()
    const card = await createCard(client, { closingDay: 31, dueDay: 10 })
    expect((await buy(client, card, { date: '2027-02-27' })).invoice).toMatchObject({
      closingDate: '2027-02-28',
      dueDate: '2027-03-10',
    })
    expect((await buy(client, card, { date: '2027-02-28' })).invoice).toMatchObject({
      closingDate: '2027-03-31',
      dueDate: '2027-04-10',
    })
    expect((await buy(client, card, { date: '2028-02-28' })).invoice).toMatchObject({
      closingDate: '2028-02-29',
      dueDate: '2028-03-10',
    })
  })

  it('keeps existing invoices when the closing day changes (snapshot), without gaps', async () => {
    const { client } = await signUp()
    const card = await createCard(client)
    const first = await buy(client, card, { date: '2026-10-20' }) // 25/09 → 25/10, due 05/11
    await client.patch(`/api/cards/${card.id}`, { closingDay: 5, dueDay: 15 })

    // Still inside the snapshot → same invoice, same dates.
    expect((await buy(client, card, { date: '2026-10-22' })).invoice.id).toBe(first.invoice.id)
    // After it: the next invoice starts exactly where the old one closed.
    const next = await buy(client, card, { date: '2026-10-28' })
    expect(next.invoice.periodStart).toBe('2026-10-25')
    expect(next.invoice.id).not.toBe(first.invoice.id)
  })

  it('a refund (credit) lowers the invoice total and frees limit', async () => {
    const { client } = await signUp()
    const card = await createCard(client)
    await buy(client, card, { amountCents: 30_000 })
    const refund = await buy(client, card, {
      kind: 'REFUND',
      amountCents: 5_000,
      description: 'Estorno',
    })
    expect(refund.items[0]).toMatchObject({ kind: 'REFUND', amountCents: 5_000 })
    expect(refund.invoice.totalCents).toBe(25_000)
    const after = (await client.get(`/api/cards/${card.id}`)).body as CardDto
    expect(after).toMatchObject({ usedCents: 25_000, availableCents: 775_000 })
  })

  it('a late purchase on a paid invoice stays there and warns', async () => {
    const { client, me } = await signUp()
    const card = await createCard(client)
    const first = await buy(client, card, { amountCents: 20_000 })
    // Pay the invoice in full (payments arrive in Phase 4 — insert the TRANSFER directly).
    const account = (
      await client.post('/api/accounts', {
        name: 'Conta',
        type: 'CHECKING',
        color: '700',
        holderId: null,
        initialBalanceCents: 100_000,
        initialBalanceDate: '2026-01-01',
      })
    ).body as AccountDto
    await prisma.transaction.create({
      data: {
        householdId: me.household!.id,
        type: 'TRANSFER',
        status: 'PAID',
        amountCents: 20_000,
        date: toDbDate('2026-11-05'),
        description: 'Pagamento fatura',
        accountId: account.id,
        creditCardId: card.id,
        invoiceId: first.invoice.id!,
      },
    })

    const late = await buy(client, card, { date: '2026-10-10', amountCents: 3_000 })
    expect(late.invoice.id).toBe(first.invoice.id)
    expect(late.landedOnPaidInvoice).toBe(true)
    expect(late.invoice).toMatchObject({ totalCents: 23_000, paidCents: 20_000 })
    expect(['partially_paid', 'overdue']).toContain(late.invoice.status)

    // Paying frees the limit: 23.000 used − 20.000 paid.
    const after = (await client.get(`/api/cards/${card.id}`)).body as CardDto
    expect(after.usedCents).toBe(3_000)
  })
})

describe('installments', () => {
  it('splits R$ 100,00 in 3x across three consecutive invoices; extra cent goes first', async () => {
    const { client } = await signUp()
    const card = await createCard(client)
    const result = await buy(client, card, {
      description: 'Fone',
      amountCents: 10_000,
      installments: 3,
      date: '2026-10-24',
    })
    expect(result.installmentPlanId).not.toBeNull()
    expect(result.items.map((i) => i.amountCents)).toEqual([3_334, 3_333, 3_333])
    expect(result.items.map((i) => [i.installmentNumber, i.installmentCount])).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ])
    expect(result.items.map((i) => i.date)).toEqual(['2026-10-24', '2026-11-24', '2026-12-24'])

    const invoices = await invoicesOf(client, card)
    expect(invoices.map((i) => [i.referenceMonth, i.totalCents])).toEqual([
      ['2027-01', 3_333],
      ['2026-12', 3_333],
      ['2026-11', 3_334],
    ])
    // Consecutive periods with no gaps.
    const ascending = [...invoices].reverse()
    expect(ascending[1]!.periodStart).toBe(ascending[0]!.closingDate)
    expect(ascending[2]!.periodStart).toBe(ascending[1]!.closingDate)

    // Future installments consume the limit up front.
    expect(((await client.get(`/api/cards/${card.id}`)).body as CardDto).usedCents).toBe(10_000)
  })

  it('validates installments', async () => {
    const { client } = await signUp()
    const card = await createCard(client)
    const base = { creditCardId: card.id, description: 'x', date: '2026-10-01', categoryId: null }
    expect(
      (await client.post('/api/card-purchases', { ...base, amountCents: 2, installments: 3 }))
        .status,
    ).toBe(400)
    expect(
      (
        await client.post('/api/card-purchases', {
          ...base,
          amountCents: 900,
          installments: 2,
          kind: 'REFUND',
        })
      ).status,
    ).toBe(400)
    expect(
      (await client.post('/api/card-purchases', { ...base, amountCents: 900, installments: 25 }))
        .status,
    ).toBe(400)
  })

  it('edits and deletes with scopes, and restores ("Desfazer")', async () => {
    const { client, me } = await signUp()
    const card = await createCard(client)
    const categories = (await client.get('/api/categories')).body as CategoryDto[]
    const expense = categories.find((c) => c.kind === 'EXPENSE' && !c.parentId)!
    const income = categories.find((c) => c.kind === 'INCOME')!

    const plan = await buy(client, card, {
      description: 'Sofá',
      amountCents: 60_000,
      installments: 6,
    })
    const third = plan.items[2]!

    // Income categories are refused for purchases.
    expect(
      (await client.patch(`/api/card-purchases/${third.id}`, { categoryId: income.id })).status,
    ).toBe(400)

    const following = await client.patch(`/api/card-purchases/${third.id}?scope=following`, {
      categoryId: expense.id,
    })
    expect(following.status).toBe(200)
    expect(
      (following.body as { installmentNumber: number }[]).map((i) => i.installmentNumber),
    ).toEqual([3, 4, 5, 6])

    const renamed = await client.patch(`/api/card-purchases/${third.id}?scope=all`, {
      description: 'Sofá da sala',
    })
    expect(renamed.body).toHaveLength(6)

    const onlyOne = await client.delete(`/api/card-purchases/${plan.items[5]!.id}?scope=one`)
    expect(onlyOne.body.ids).toHaveLength(1)
    const rest = await client.delete(`/api/card-purchases/${third.id}?scope=following`)
    expect(rest.body.ids).toHaveLength(3) // 3, 4, 5 (6 is already gone)

    let used = ((await client.get(`/api/cards/${card.id}`)).body as CardDto).usedCents
    expect(used).toBe(20_000)

    await client.post('/api/card-purchases/restore', { ids: rest.body.ids })
    used = ((await client.get(`/api/cards/${card.id}`)).body as CardDto).usedCents
    expect(used).toBe(50_000)

    const all = await client.delete(`/api/card-purchases/${plan.items[0]!.id}?scope=all`)
    expect(all.body.ids).toHaveLength(5)

    // Paid-by defaults to the person who entered it.
    expect(plan.items[0]!.paidById).toBe(me.member!.id)
  })

  it('shows an invoice with its items', async () => {
    const { client } = await signUp()
    const card = await createCard(client)
    const a = await buy(client, card, {
      description: 'Padaria',
      amountCents: 1_250,
      date: '2026-10-02',
    })
    await buy(client, card, {
      description: 'Fone',
      amountCents: 30_000,
      installments: 3,
      date: '2026-10-03',
    })
    const detail = (await client.get(`/api/invoices/${a.invoice.id}`)).body as InvoiceDetailDto
    expect(detail.items.map((i) => [i.description, i.amountCents, i.installmentNumber])).toEqual([
      ['Padaria', 1_250, null],
      ['Fone', 10_000, 1],
    ])
    expect(detail.totalCents).toBe(11_250)

    const intruder = await signUp()
    expect((await intruder.client.get(`/api/invoices/${a.invoice.id}`)).status).toBe(404)
  })
})
