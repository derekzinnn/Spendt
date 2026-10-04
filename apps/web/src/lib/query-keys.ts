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
}
