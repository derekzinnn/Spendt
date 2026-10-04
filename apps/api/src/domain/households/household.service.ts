import {
  isPaletteKey,
  type HouseholdDto,
  type MeDto,
  type MemberDto,
  type PaletteKey,
  type UpdateHouseholdInput,
  type UpdateMemberInput,
} from '@spendly/shared'

import type { Household, HouseholdMember, Prisma } from '../../generated/prisma/client'
import { HttpError } from '../../lib/http-error'
import { prisma } from '../../lib/prisma'
import { createDefaultCategories } from '../categories/default-categories'

/** Members get distinct tones, alternating dark/light so two avatars never look alike. */
const MEMBER_COLOR_ORDER: PaletteKey[] = ['700', '300', '900', '500']

export function pickMemberColor(taken: readonly string[]): PaletteKey {
  return MEMBER_COLOR_ORDER.find((color) => !taken.includes(color)) ?? 'neutral'
}

export function toHouseholdDto(household: Household): HouseholdDto {
  return {
    id: household.id,
    name: household.name,
    currency: household.currency,
    timezone: household.timezone,
  }
}

export function toMemberDto(member: HouseholdMember, viewerUserId: string): MemberDto {
  return {
    id: member.id,
    userId: member.userId,
    displayName: member.displayName,
    color: isPaletteKey(member.color) ? member.color : 'neutral',
    role: member.role,
    isMe: member.userId === viewerUserId,
  }
}

/** First name for friendly defaults ("Casa de Derek"). */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name
}

/** Creates a household owned by `userId`, with the default pt-BR category tree. */
export async function createHouseholdWithDefaults(
  tx: Prisma.TransactionClient,
  input: { ownerUserId: string; ownerName: string; name?: string | undefined },
) {
  const household = await tx.household.create({
    data: { name: input.name ?? `Casa de ${firstName(input.ownerName)}` },
  })
  const member = await tx.householdMember.create({
    data: {
      householdId: household.id,
      userId: input.ownerUserId,
      role: 'OWNER',
      displayName: firstName(input.ownerName),
      color: pickMemberColor([]),
    },
  })
  await createDefaultCategories(tx, household.id)
  return { household, member }
}

/**
 * Which household a fresh session should open: the one used most recently, falling back
 * to the most recently joined membership.
 */
export async function pickActiveHouseholdId(userId: string): Promise<string | null> {
  const recent = await prisma.session.findFirst({
    where: {
      userId,
      activeHouseholdId: { not: null },
      activeHousehold: { members: { some: { userId, leftAt: null } } },
    },
    orderBy: { lastSeenAt: 'desc' },
    select: { activeHouseholdId: true },
  })
  if (recent?.activeHouseholdId) return recent.activeHouseholdId

  const membership = await prisma.householdMember.findFirst({
    where: { userId, leftAt: null },
    orderBy: { joinedAt: 'desc' },
    select: { householdId: true },
  })
  return membership?.householdId ?? null
}

/** Everything the web app needs to boot: user, active household, members, memberships. */
export async function buildMe(userId: string, activeHouseholdId: string | null): Promise<MeDto> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      memberships: {
        where: { leftAt: null },
        include: { household: { select: { id: true, name: true } } },
        orderBy: { joinedAt: 'asc' },
      },
    },
  })

  const active = activeHouseholdId
    ? await prisma.household.findFirst({
        where: { id: activeHouseholdId, members: { some: { userId, leftAt: null } } },
        include: { members: { where: { leftAt: null }, orderBy: { joinedAt: 'asc' } } },
      })
    : null

  const members = active?.members.map((m) => toMemberDto(m, userId)) ?? []

  return {
    user: { id: user.id, name: user.name, email: user.email },
    household: active ? toHouseholdDto(active) : null,
    member: members.find((m) => m.isMe) ?? null,
    members,
    memberships: user.memberships.map((m) => ({
      householdId: m.householdId,
      householdName: m.household.name,
      role: m.role,
    })),
  }
}

export async function updateHousehold(
  householdId: string,
  input: UpdateHouseholdInput,
): Promise<HouseholdDto> {
  const household = await prisma.household.update({
    where: { id: householdId },
    data: {
      name: input.name,
    },
  })
  return toHouseholdDto(household)
}

/** Each member edits their own display name and colour (colours stay distinct). */
export async function updateMember(
  member: HouseholdMember,
  input: UpdateMemberInput,
): Promise<MemberDto> {
  if (input.color !== undefined && input.color !== member.color) {
    const taken = await prisma.householdMember.findFirst({
      where: {
        householdId: member.householdId,
        leftAt: null,
        color: input.color,
        id: { not: member.id },
      },
      select: { displayName: true },
    })
    if (taken) {
      throw HttpError.field('color', `Essa cor já é de ${taken.displayName}.`, 409, 'COLOR_TAKEN')
    }
  }
  const updated = await prisma.householdMember.update({
    where: { id: member.id },
    data: {
      ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
    },
  })
  return toMemberDto(updated, member.userId)
}
