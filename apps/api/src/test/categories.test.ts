import type { CategoryDto } from '@spendly/shared'
import { beforeEach, describe, expect, it } from 'vitest'

import { resetDatabase, signUp, type TestClient } from './helpers'

beforeEach(resetDatabase)

async function list(client: TestClient, includeArchived = false) {
  const res = await client.get(`/api/categories${includeArchived ? '?includeArchived=true' : ''}`)
  expect(res.status).toBe(200)
  return res.body as CategoryDto[]
}

const byName = (categories: CategoryDto[], name: string, parentId: string | null = null) =>
  categories.find((c) => c.name === name && c.parentId === parentId)

describe('categories', () => {
  it('lists the default tree for a new household', async () => {
    const { client } = await signUp()
    const categories = await list(client)
    const housing = byName(categories, 'Moradia')!
    expect(housing).toMatchObject({ kind: 'EXPENSE', icon: 'house', color: '900', parentId: null })
    expect(categories.filter((c) => c.parentId === housing.id).map((c) => c.name)).toContain(
      'Aluguel',
    )
    expect(categories.filter((c) => c.kind === 'INCOME' && !c.parentId)).toHaveLength(5)
  })

  it('creates top-level and subcategories with budgets', async () => {
    const { client } = await signUp()
    const parent = await client.post('/api/categories', {
      name: 'Casamento',
      kind: 'EXPENSE',
      icon: 'gift',
      color: '300',
      monthlyBudgetCents: 200_000,
    })
    expect(parent.status).toBe(201)
    const child = await client.post('/api/categories', {
      name: 'Buffet',
      kind: 'EXPENSE',
      icon: 'utensils',
      color: '300',
      parentId: (parent.body as CategoryDto).id,
    })
    expect(child.status).toBe(201)
    expect(child.body).toMatchObject({
      parentId: (parent.body as CategoryDto).id,
      monthlyBudgetCents: null,
    })
  })

  it('enforces the tree rules', async () => {
    const { client } = await signUp()
    const categories = await list(client)
    const housing = byName(categories, 'Moradia')!
    const rent = byName(categories, 'Aluguel', housing.id)!
    const salary = byName(categories, 'Salário')!

    const grandchild = await client.post('/api/categories', {
      name: 'Reajuste',
      kind: 'EXPENSE',
      icon: 'key',
      color: '700',
      parentId: rent.id,
    })
    expect(grandchild.status).toBe(400)
    expect(grandchild.body.error.details[0].path).toBe('parentId')

    const wrongKind = await client.post('/api/categories', {
      name: 'Bônus',
      kind: 'EXPENSE',
      icon: 'gift',
      color: '700',
      parentId: salary.id,
    })
    expect(wrongKind.status).toBe(400)

    const incomeBudget = await client.patch(`/api/categories/${salary.id}`, {
      monthlyBudgetCents: 1000,
    })
    expect(incomeBudget.status).toBe(400)
  })

  it('keeps sibling names unique, case-insensitively', async () => {
    const { client } = await signUp()
    const res = await client.post('/api/categories', {
      name: 'mercado',
      kind: 'EXPENSE',
      icon: 'apple',
      color: '700',
    })
    expect(res.status).toBe(409)
    expect(res.body.error.details[0]).toMatchObject({ path: 'name' })

    // Same name under a different parent is fine.
    const categories = await list(client)
    const leisure = byName(categories, 'Lazer')!
    const ok = await client.post('/api/categories', {
      name: 'Delivery',
      kind: 'EXPENSE',
      icon: 'pizza',
      color: '500',
      parentId: leisure.id,
    })
    expect(ok.status).toBe(201)
  })

  it('updates name, icon, color and budget', async () => {
    const { client } = await signUp()
    const market = byName(await list(client), 'Mercado')!
    const res = await client.patch(`/api/categories/${market.id}`, {
      name: 'Supermercado & feira',
      icon: 'apple',
      color: '500',
      monthlyBudgetCents: 180_000,
    })
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      name: 'Supermercado & feira',
      icon: 'apple',
      color: '500',
      monthlyBudgetCents: 180_000,
    })

    const cleared = await client.patch(`/api/categories/${market.id}`, { monthlyBudgetCents: null })
    expect((cleared.body as CategoryDto).monthlyBudgetCents).toBeNull()
  })

  it('archives a parent with its children and restores them (undo)', async () => {
    const { client } = await signUp()
    const housing = byName(await list(client), 'Moradia')!

    const archived = await client.post(`/api/categories/${housing.id}/archive`)
    expect(archived.status).toBe(200)
    expect((archived.body as CategoryDto[]).every((c) => c.archivedAt !== null)).toBe(true)
    expect((archived.body as CategoryDto[]).length).toBe(8)

    const active = await list(client)
    expect(active.find((c) => c.id === housing.id)).toBeUndefined()
    expect((await list(client, true)).find((c) => c.id === housing.id)?.archivedAt).not.toBeNull()

    const rent = (archived.body as CategoryDto[]).find((c) => c.name === 'Aluguel')!
    const childFirst = await client.post(`/api/categories/${rent.id}/unarchive`)
    expect(childFirst.status).toBe(409)

    const restored = await client.post(`/api/categories/${housing.id}/unarchive`)
    expect((restored.body as CategoryDto[]).every((c) => c.archivedAt === null)).toBe(true)
  })

  it('deletes only unused leaf categories', async () => {
    const { client } = await signUp()
    const categories = await list(client)
    const housing = byName(categories, 'Moradia')!
    expect((await client.delete(`/api/categories/${housing.id}`)).status).toBe(409)

    const gifts = byName(categories, 'Presentes')!
    expect((await client.delete(`/api/categories/${gifts.id}`)).status).toBe(204)
  })

  it("never exposes another household's categories", async () => {
    const alice = await signUp()
    const bob = await signUp()
    const aliceMarket = byName(await list(alice.client), 'Mercado')!

    expect(
      (await bob.client.patch(`/api/categories/${aliceMarket.id}`, { name: 'Hack' })).status,
    ).toBe(404)
    expect((await bob.client.post(`/api/categories/${aliceMarket.id}/archive`)).status).toBe(404)
    expect((await bob.client.delete(`/api/categories/${aliceMarket.id}`)).status).toBe(404)
    const sub = await bob.client.post('/api/categories', {
      name: 'Intrusa',
      kind: 'EXPENSE',
      icon: 'gift',
      color: '700',
      parentId: aliceMarket.id,
    })
    expect(sub.status).toBe(404)
    expect((await bob.client.get('/api/categories/nao-e-uuid')).status).toBe(404)
  })
})
