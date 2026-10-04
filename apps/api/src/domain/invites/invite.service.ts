import type { CreatedInviteDto, InviteDto, InvitePreviewDto } from '@spendly/shared'

import { env } from '../../config/env'
import type { HouseholdInvite, HouseholdMember, Prisma, User } from '../../generated/prisma/client'
import { HttpError } from '../../lib/http-error'
import { prisma } from '../../lib/prisma'
import { generateToken, hashToken } from '../../lib/tokens'
import { pickMemberColor } from '../households/household.service'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

type InviteWithInviter = HouseholdInvite & { invitedBy: HouseholdMember }

function toInviteDto(invite: InviteWithInviter): InviteDto {
  return {
    id: invite.id,
    email: invite.email,
    invitedByName: invite.invitedBy.displayName,
    createdAt: invite.createdAt.toISOString(),
    expiresAt: invite.expiresAt.toISOString(),
  }
}

export function inviteUrl(token: string): string {
  return new URL(`/convite/${token}`, env.WEB_ORIGIN).toString()
}

/**
 * Creates a one-time invite link for `email`. Any earlier pending invite for the same
 * e-mail is revoked, so only the newest link works.
 */
export async function createInvite(
  householdId: string,
  inviter: HouseholdMember,
  email: string,
): Promise<CreatedInviteDto> {
  const alreadyMember = await prisma.householdMember.findFirst({
    where: { householdId, leftAt: null, user: { email } },
    select: { id: true },
  })
  if (alreadyMember) {
    throw HttpError.field('email', 'Essa pessoa já faz parte da casa.', 409, 'ALREADY_MEMBER')
  }

  const token = generateToken()
  const invite = await prisma.$transaction(async (tx) => {
    await tx.householdInvite.updateMany({
      where: { householdId, email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    return tx.householdInvite.create({
      data: {
        householdId,
        email,
        role: 'MEMBER',
        tokenHash: hashToken(token),
        invitedById: inviter.id,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
      include: { invitedBy: true },
    })
  })
  return { ...toInviteDto(invite), url: inviteUrl(token) }
}

export async function listPendingInvites(householdId: string): Promise<InviteDto[]> {
  const invites = await prisma.householdInvite.findMany({
    where: { householdId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    include: { invitedBy: true },
    orderBy: { createdAt: 'desc' },
  })
  return invites.map(toInviteDto)
}

export async function revokeInvite(householdId: string, inviteId: string) {
  const { count } = await prisma.householdInvite.updateMany({
    where: { id: inviteId, householdId, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  if (count === 0) throw HttpError.notFound('Convite não encontrado.')
}

/** Finds an invite that can still be used, or explains (in pt-BR) why it can't. */
export async function findUsableInvite(token: string) {
  const invite = await prisma.householdInvite.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { household: true, invitedBy: true },
  })
  if (!invite) throw HttpError.notFound('Convite não encontrado. Confira o link.')
  if (invite.acceptedAt) throw HttpError.gone('Este convite já foi usado.', 'INVITE_USED')
  if (invite.revokedAt)
    throw HttpError.gone('Este convite foi cancelado. Peça um novo link.', 'INVITE_REVOKED')
  if (invite.expiresAt.getTime() <= Date.now()) {
    throw HttpError.gone('Este convite expirou. Peça um novo link.', 'INVITE_EXPIRED')
  }
  return invite
}

export async function previewInvite(token: string): Promise<InvitePreviewDto> {
  const invite = await findUsableInvite(token)
  const account = await prisma.user.findUnique({
    where: { email: invite.email },
    select: { id: true },
  })
  return {
    householdName: invite.household.name,
    invitedByName: invite.invitedBy.displayName,
    email: invite.email,
    expiresAt: invite.expiresAt.toISOString(),
    hasAccount: account !== null,
  }
}

/** Adds `user` to the invite's household and consumes the invite (inside a transaction). */
export async function addMemberFromInvite(
  tx: Prisma.TransactionClient,
  invite: HouseholdInvite,
  user: User,
): Promise<HouseholdMember> {
  const existing = await tx.householdMember.findUnique({
    where: { householdId_userId: { householdId: invite.householdId, userId: user.id } },
  })
  if (existing && !existing.leftAt) throw HttpError.conflict('Você já faz parte desta casa.')

  // Consume first: if two requests race, only one flips acceptedAt from null.
  const { count } = await tx.householdInvite.updateMany({
    where: { id: invite.id, acceptedAt: null },
    data: { acceptedAt: new Date() },
  })
  if (count === 0) throw HttpError.gone('Este convite já foi usado.', 'INVITE_USED')

  const taken = await tx.householdMember.findMany({
    where: { householdId: invite.householdId, leftAt: null },
    select: { color: true },
  })
  const data = {
    role: invite.role,
    displayName: user.name.trim().split(/\s+/)[0] ?? user.name,
    color: pickMemberColor(taken.map((m) => m.color)),
    leftAt: null,
  }
  return existing
    ? tx.householdMember.update({ where: { id: existing.id }, data })
    : tx.householdMember.create({
        data: { ...data, householdId: invite.householdId, userId: user.id },
      })
}

/** Logged-in user accepts an invite; their session switches to the joined household. */
export async function acceptInvite(token: string, user: User, sessionId: string) {
  const invite = await findUsableInvite(token)
  if (invite.email !== user.email) {
    throw HttpError.forbidden(
      `Este convite foi enviado para ${invite.email}. Entre com essa conta para aceitar.`,
      'INVITE_EMAIL_MISMATCH',
    )
  }
  return prisma.$transaction(async (tx) => {
    const member = await addMemberFromInvite(tx, invite, user)
    await tx.session.update({
      where: { id: sessionId },
      data: { activeHouseholdId: member.householdId },
    })
    return member
  })
}
