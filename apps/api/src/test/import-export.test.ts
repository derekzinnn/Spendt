import {
  addDays,
  todayIso,
  type AccountDto,
  type CardDto,
  type CategoryDto,
  type ExportDto,
  type ImportPreviewDto,
  type TransactionListDto,
} from '@spendly/shared'
import { beforeEach, describe, expect, it } from 'vitest'

import { createClient, resetDatabase, signUp, type TestClient } from './helpers'

beforeEach(resetDatabase)

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
      initialBalanceDate: addDays(today, -90),
    })
  ).body as AccountDto
  const categories = (await client.get('/api/categories')).body as CategoryDto[]
  const market = categories.find((c) => c.name === 'Mercado' && !c.parentId)!
  const leisure = categories.find((c) => c.name === 'Lazer' && !c.parentId)!
  const salary = categories.find((c) => c.name === 'Salário')!
  return { ...session, account, market, leisure, salary }
}

const row = (overrides: Record<string, unknown> = {}) => ({
  date: today,
  description: 'PADARIA ACUCAR LTDA',
  amountCents: 1_550,
  type: 'EXPENSE',
  ...overrides,
})

const preview = async (client: TestClient, body: Record<string, unknown>) => {
  const res = await client.post('/api/import/preview', body)
  expect(res.status).toBe(200)
  return res.body as ImportPreviewDto
}

describe('import', () => {
  it('guesses the category from how the household filed the same shop before', async () => {
    const { client, account, market } = await setup()
    await client.post('/api/transactions', {
      type: 'EXPENSE',
      amountCents: 2_000,
      date: addDays(today, -10),
      description: 'Padaria Açúcar',
      categoryId: market.id,
      accountId: account.id,
    })

    const result = await preview(client, {
      accountId: account.id,
      rows: [row(), row({ description: 'LOJA QUE NUNCA VIMOS' })],
    })

    expect(result.rows[0]?.categoryId).toBe(market.id)
    expect(result.rows[1]?.categoryId).toBeNull()
    expect(result.guessedCount).toBe(1)
  })

  it('flags lines already in the ledger, one existing row per line', async () => {
    const { client, account } = await setup()
    const made = await client.post('/api/transactions', {
      type: 'EXPENSE',
      amountCents: 1_550,
      date: today,
      description: 'Padaria',
      accountId: account.id,
    })

    // Two identical lines, one existing row: only the first is a duplicate.
    const result = await preview(client, { accountId: account.id, rows: [row(), row()] })

    expect(result.rows[0]?.duplicateOfId).toBe((made.body as { id: string }).id)
    expect(result.rows[1]?.duplicateOfId).toBeNull()
    expect(result.duplicateCount).toBe(1)
  })

  it('writes the confirmed lines and hands back ids for "Desfazer"', async () => {
    const { client, account, market } = await setup()
    const res = await client.post('/api/import/commit', {
      accountId: account.id,
      rows: [
        { ...row(), categoryId: market.id },
        { ...row({ description: 'SALARIO', amountCents: 500_000, type: 'INCOME' }) },
      ],
    })
    expect(res.status).toBe(201)
    const { ids, count } = res.body as { ids: string[]; count: number }
    expect(count).toBe(2)

    const after = (await client.get(`/api/accounts`)).body as AccountDto[]
    expect(after[0]?.balanceCents).toBe(500_000 - 1_550)

    await client.post('/api/import/undo', { ids })
    const undone = (await client.get(`/api/accounts`)).body as AccountDto[]
    expect(undone[0]?.balanceCents).toBe(0)
  })

  it('puts card lines on the invoice of their date', async () => {
    const { client, account } = await setup()
    const card = (
      await client.post('/api/cards', {
        name: 'Cartão',
        brand: 'OTHER',
        color: '700',
        lastFour: null,
        limitCents: 1_000_000,
        closingDay: 20,
        dueDay: 1,
        paymentAccountId: account.id,
        holderId: null,
      })
    ).body as CardDto

    await client.post('/api/import/commit', {
      creditCardId: card.id,
      rows: [{ ...row(), categoryId: null }],
    })

    const invoices = (await client.get(`/api/cards/${card.id}/invoices`)).body as {
      totalCents: number
      itemCount: number
    }[]
    const withItems = invoices.filter((inv) => inv.itemCount > 0)
    expect(withItems).toHaveLength(1)
    expect(withItems[0]?.totalCents).toBe(1_550)
  })

  it('refuses a category of the wrong kind and a foreign account', async () => {
    const { client, account, salary } = await setup()
    const wrongKind = await client.post('/api/import/commit', {
      accountId: account.id,
      rows: [{ ...row(), categoryId: salary.id }],
    })
    expect(wrongKind.status).toBe(400)

    const other = await signUp({}, createClient())
    const foreign = await other.client.post('/api/import/commit', {
      accountId: account.id,
      rows: [row()],
    })
    expect(foreign.status).toBe(404)
  })

  it('needs exactly one target', async () => {
    const { client, account } = await setup()
    const neither = await client.post('/api/import/preview', { rows: [row()] })
    expect(neither.status).toBe(400)
    const both = await client.post('/api/import/preview', {
      accountId: account.id,
      creditCardId: account.id,
      rows: [row()],
    })
    expect(both.status).toBe(400)
  })
})

describe('export', () => {
  it('returns readable rows with signed amounts over the window', async () => {
    const { client, account, market } = await setup()
    await client.post('/api/transactions', {
      type: 'EXPENSE',
      amountCents: 4_000,
      date: today,
      description: 'Feira',
      categoryId: market.id,
      accountId: account.id,
    })
    await client.post('/api/transactions', {
      type: 'INCOME',
      amountCents: 900_000,
      date: today,
      description: 'Salário',
      accountId: account.id,
    })
    // Outside the window: must not come along.
    await client.post('/api/transactions', {
      type: 'EXPENSE',
      amountCents: 1_000,
      date: addDays(today, -40),
      description: 'Antigo',
      accountId: account.id,
    })

    const res = await client.get(`/api/export?from=${addDays(today, -7)}&to=${today}`)
    const { rows } = res.body as ExportDto
    expect(rows.map((r) => r.description)).toEqual(['Feira', 'Salário'])
    expect(rows[0]).toMatchObject({
      type: 'Despesa',
      status: 'Pago',
      category: 'Mercado',
      source: 'Conta',
      amountCents: -4_000,
    })
    expect(rows[1]?.amountCents).toBe(900_000)
  })

  it('rejects a backwards window and stays inside the household', async () => {
    const { client, account } = await setup()
    await client.post('/api/transactions', {
      type: 'EXPENSE',
      amountCents: 4_000,
      date: today,
      description: 'Feira',
      accountId: account.id,
    })

    const backwards = await client.get(`/api/export?from=${today}&to=${addDays(today, -1)}`)
    expect(backwards.status).toBe(400)

    const other = await signUp({}, createClient())
    const foreign = (await other.client.get(`/api/export?from=${addDays(today, -7)}&to=${today}`))
      .body as ExportDto
    expect(foreign.rows).toHaveLength(0)
  })
})

describe('change password', () => {
  it('needs the current password, then only the new one works', async () => {
    const { client, email, password } = await signUp()

    const wrong = await client.post('/api/auth/change-password', {
      currentPassword: 'nao-e-essa-123',
      password: 'nova-senha-456',
    })
    expect(wrong.status).toBe(401)

    const ok = await client.post('/api/auth/change-password', {
      currentPassword: password,
      password: 'nova-senha-456',
    })
    expect(ok.status).toBe(204)
    // The session that changed it keeps working.
    expect((await client.get('/api/auth/me')).status).toBe(200)

    const fresh = createClient()
    expect((await fresh.post('/api/auth/login', { email, password })).status).toBe(401)
    expect(
      (await fresh.post('/api/auth/login', { email, password: 'nova-senha-456' })).status,
    ).toBe(200)
  })

  it('logs out the other sessions', async () => {
    const { client, email, password } = await signUp()
    const elsewhere = createClient()
    await elsewhere.post('/api/auth/login', { email, password })
    expect((await elsewhere.get('/api/auth/me')).status).toBe(200)

    await client.post('/api/auth/change-password', {
      currentPassword: password,
      password: 'nova-senha-456',
    })

    expect((await elsewhere.get('/api/auth/me')).status).toBe(401)
  })
})

/** Keeps the grid honest: imported rows are ordinary transactions. */
describe('imported rows', () => {
  it('show up in the month grid', async () => {
    const { client, account } = await setup()
    await client.post('/api/import/commit', { accountId: account.id, rows: [row()] })
    const list = (await client.get(`/api/transactions?month=${today.slice(0, 7)}`))
      .body as TransactionListDto
    expect(list.items.some((item) => item.description === 'PADARIA ACUCAR LTDA')).toBe(true)
  })
})
