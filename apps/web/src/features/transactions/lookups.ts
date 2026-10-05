import type { AccountDto, CardDto, CategoryDto, MemberDto, TransactionDto } from '@spendly/shared'
import { useMemo } from 'react'

import { useAccounts } from '@/features/accounts/api'
import { useHouseholdContext } from '@/features/auth/api'
import { useCards } from '@/features/cards/api'
import { useCategories } from '@/features/categories/api'

export interface Lookups {
  categories: CategoryDto[]
  accounts: AccountDto[]
  cards: CardDto[]
  members: MemberDto[]
  category: (id: string | null) => CategoryDto | undefined
  parentOf: (category: CategoryDto | undefined) => CategoryDto | undefined
  account: (id: string | null) => AccountDto | undefined
  card: (id: string | null) => CardDto | undefined
  member: (id: string | null) => MemberDto | undefined
  /** "Nubank", "Conta → Reserva", "Cartão da casa"… */
  sourceLabel: (t: TransactionDto) => string
}

/** Names by id for everything a ledger row points at (archived included, for history). */
export function useLookups(): Lookups {
  const { members } = useHouseholdContext()
  const categories = useCategories().data
  const accounts = useAccounts().data
  const cards = useCards().data

  return useMemo<Lookups>(() => {
    const byId = <T extends { id: string }>(list: T[] | undefined) =>
      new Map((list ?? []).map((item) => [item.id, item]))
    const c = byId(categories)
    const a = byId(accounts)
    const k = byId(cards)
    const m = byId(members)
    const get =
      <T>(map: Map<string, T>) =>
      (id: string | null) =>
        id ? map.get(id) : undefined
    const account = get(a)
    const card = get(k)
    return {
      categories: categories ?? [],
      accounts: accounts ?? [],
      cards: cards ?? [],
      members,
      category: get(c),
      parentOf: (category) => (category?.parentId ? c.get(category.parentId) : undefined),
      account,
      card,
      member: get(m),
      sourceLabel: (t) => {
        if (t.creditCardId && t.type !== 'TRANSFER') return card(t.creditCardId)?.name ?? 'Cartão'
        if (t.type === 'TRANSFER') {
          const from = account(t.accountId)?.name ?? '—'
          const to = t.toAccountId
            ? (account(t.toAccountId)?.name ?? '—')
            : `fatura ${card(t.creditCardId)?.name ?? ''}`.trim()
          return `${from} → ${to}`
        }
        return account(t.accountId)?.name ?? 'Sem conta'
      },
    }
  }, [categories, accounts, cards, members])
}
