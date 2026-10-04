import type {
  CreatedInviteDto,
  HouseholdDto,
  InviteDto,
  InvitePreviewDto,
  MeDto,
  MemberDto,
  UpdateHouseholdInput,
  UpdateMemberInput,
} from '@spendly/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { apiFetch } from '@/lib/api'
import { queryKeys } from '@/lib/query-keys'
import { replaceSession } from '@/lib/session-cache'

export function useUpdateHousehold() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateHouseholdInput) =>
      apiFetch<HouseholdDto>('/household', { method: 'PATCH', json: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.me }),
  })
}

export function useUpdateMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateMemberInput) =>
      apiFetch<MemberDto>('/household/members/me', { method: 'PATCH', json: input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.me }),
  })
}

export function useInvites(enabled = true) {
  return useQuery({
    queryKey: queryKeys.invites,
    queryFn: () => apiFetch<InviteDto[]>('/household/invites'),
    enabled,
  })
}

export function useCreateInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (email: string) =>
      apiFetch<CreatedInviteDto>('/household/invites', { method: 'POST', json: { email } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.invites }),
  })
}

export function useRevokeInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<null>(`/household/invites/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.invites }),
  })
}

export function useInvitePreview(token: string) {
  return useQuery({
    queryKey: queryKeys.invitePreview(token),
    queryFn: () => apiFetch<InvitePreviewDto>(`/invites/${encodeURIComponent(token)}`),
    retry: false,
  })
}

export function useAcceptInvite(token: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () =>
      apiFetch<MeDto>(`/invites/${encodeURIComponent(token)}/accept`, { method: 'POST' }),
    onSuccess: (me) => replaceSession(queryClient, me),
  })
}
