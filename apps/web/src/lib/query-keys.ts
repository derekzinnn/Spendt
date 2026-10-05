/**
 * Every TanStack Query cache key in one place. Invalidating a prefix (e.g. `['accounts']`)
 * refreshes every query under it.
 */
export const queryKeys = {
  me: ['me'] as const,
  invites: ['household', 'invites'] as const,
  invitePreview: (token: string) => ['invite-preview', token] as const,
  categories: ['categories'] as const,
  accounts: ['accounts'] as const,
  /** Cards and everything under them (invoices, invoice detail) share one prefix. */
  cards: ['cards'] as const,
  cardInvoices: (cardId: string) => ['cards', cardId, 'invoices'] as const,
  invoice: (invoiceId: string) => ['cards', 'invoice', invoiceId] as const,
  transactions: ['transactions'] as const,
  transactionList: (query: object) => ['transactions', query] as const,
  recurring: ['recurring'] as const,
  bills: ['bills'] as const,
  billList: (query: object) => ['bills', query] as const,
}
