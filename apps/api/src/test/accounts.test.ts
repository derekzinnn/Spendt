import type { AccountDto } from '@spendly/shared'
import { beforeEach, describe, expect, it } from 'vitest'

import { toDbDate } from '../lib/db-dates'

import { prisma, resetDatabase, signUp, type TestClient } from './helpers'

beforeEach(resetDatabase)

async function createAccount(client: TestClient, overrides: Record<string, unknown> = {}) {
  const res = await client.post('/api/accounts', {
    name: 'Nubank',
    type: 'CHECKING',
    color: '300',
    holderId: null,
    initialBalanceCents: 100_000,
    initialBalanceDate: '2026-10-01',
    ...overrides,
  })
  expect(res.status).toBe(201)
  return res.body as AccountDto
}

describe('accounts', () => {
  it('creates and lists accounts; balance starts at the initial balance', async () => {
    const { client, me } = await signUp()
    const created = await createAccount(client, { holderId: me.member!.id })
    expect(created).toMatchObject({
      name: 'Nubank',
      type: 'CHECKING',
      holderId: me.member!.id,
      initialBalanceDate: '2026-10-01',
      balanceCents: 100_000,
    })
    const list = await client.get('/api/accounts')
    expect(list.body).toHaveLength(1)
  })

  it('derives the balance from PAID movements on/after the initial date', async () => {
    const { client, me } = await signUp()
    const householdId = me.household!.id
    const main = await createAccount(client, { initialBalanceCents: 100_000 })
    const savings = await createAccount(client, {
      name: 'Reserva',
      type: 'SAVINGS',
      initialBalanceCents: 0,
    })

    const base = { householdId, description: 'teste' }
    await prisma.transaction.createMany({
      data: [
        // +R$ 5.000 salary
        {
          ...base,
          type: 'INCOME',
          amountCents: 500_000,
          date: toDbDate('2026-10-05'),
          accountId: main.id,
        },
        // −R$ 120 groceries
        {
          ...base,
          type: 'EXPENSE',
          amountCents: 12_000,
          date: toDbDate('2026-10-06'),
          accountId: main.id,
        },
        // −R$ 1.000 moved to savings (+R$ 1.000 there)
        {
          ...base,
          type: 'TRANSFER',
          amountCents: 100_000,
          date: toDbDate('2026-10-07'),
          accountId: main.id,
          toAccountId: savings.id,
        },
        // ignored: pending bill
        {
          ...base,
          type: 'EXPENSE',
          status: 'PENDING',
          amountCents: 99_999,
          date: toDbDate('2026-10-10'),
          dueDate: toDbDate('2026-10-10'),
          accountId: main.id,
        },
        // ignored: soft-deleted
        {
          ...base,
          type: 'EXPENSE',
          amountCents: 77_777,
          date: toDbDate('2026-10-08'),
          accountId: main.id,
          deletedAt: new Date(),
        },
        // ignored: before the initial balance date (already inside the initial balance)
        {
          ...base,
          type: 'EXPENSE',
          amountCents: 55_555,
          date: toDbDate('2026-09-30'),
          accountId: main.id,
        },
      ],
    })

    const accounts = (await client.get('/api/accounts')).body as AccountDto[]
    const byId = Object.fromEntries(accounts.map((a) => [a.id, a.balanceCents]))
    expect(byId[main.id]).toBe(100_000 + 500_000 - 12_000 - 100_000)
    expect(byId[savings.id]).toBe(100_000)
  })

  it('allows negative initial balances (cheque especial)', async () => {
    const { client } = await signUp()
    const account = await createAccount(client, { initialBalanceCents: -25_000 })
    expect(account.balanceCents).toBe(-25_000)
  })

  it('validates the holder and unique names', async () => {
    const { client } = await signUp()
    const other = await signUp()
    const res = await client.post('/api/accounts', {
      name: 'Itaú',
      type: 'CHECKING',
      color: '500',
      holderId: other.me.member!.id,
      initialBalanceCents: 0,
      initialBalanceDate: '2026-10-01',
    })
    expect(res.status).toBe(400)
    expect(res.body.error.details[0].path).toBe('holderId')

    await createAccount(client)
    const dup = await client.post('/api/accounts', {
      name: 'nubank',
      type: 'CASH',
      color: '900',
      holderId: null,
      initialBalanceCents: 0,
      initialBalanceDate: '2026-10-01',
    })
    expect(dup.status).toBe(409)
  })

  it('updates, archives (undo) and deletes unused accounts', async () => {
    const { client, me } = await signUp()
    const account = await createAccount(client)

    const updated = await client.patch(`/api/accounts/${account.id}`, {
      name: 'Nubank PJ',
      holderId: me.member!.id,
      initialBalanceCents: 50_000,
      initialBalanceDate: '2026-10-02',
    })
    expect(updated.body).toMatchObject({
      name: 'Nubank PJ',
      balanceCents: 50_000,
      initialBalanceDate: '2026-10-02',
    })

    await client.post(`/api/accounts/${account.id}/archive`)
    expect((await client.get('/api/accounts')).body).toHaveLength(0)
    expect((await client.get('/api/accounts?includeArchived=true')).body).toHaveLength(1)
    await client.post(`/api/accounts/${account.id}/unarchive`)
    expect((await client.get('/api/accounts')).body).toHaveLength(1)

    expect((await client.delete(`/api/accounts/${account.id}`)).status).toBe(204)
  })

  it('refuses to delete an account with movements', async () => {
    const { client, me } = await signUp()
    const account = await createAccount(client)
    await prisma.transaction.create({
      data: {
        householdId: me.household!.id,
        type: 'EXPENSE',
        amountCents: 1000,
        date: toDbDate('2026-10-03'),
        description: 'café',
        accountId: account.id,
      },
    })
    expect((await client.delete(`/api/accounts/${account.id}`)).status).toBe(409)
  })

  it("never exposes another household's accounts", async () => {
    const alice = await signUp()
    const bob = await signUp()
    const account = await createAccount(alice.client)
    expect((await bob.client.get('/api/accounts')).body).toHaveLength(0)
    expect((await bob.client.patch(`/api/accounts/${account.id}`, { name: 'Hack' })).status).toBe(
      404,
    )
    expect((await bob.client.delete(`/api/accounts/${account.id}`)).status).toBe(404)
  })
})
