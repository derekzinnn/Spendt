import type { ChangePasswordInput, LoginInput, RegisterInput } from '@spendly/shared'

import { HttpError } from '../../lib/http-error'
import { hashPassword, verifyPassword } from '../../lib/password'
import { prisma } from '../../lib/prisma'
import { createHouseholdWithDefaults, pickActiveHouseholdId } from '../households/household.service'
import { addMemberFromInvite, findUsableInvite } from '../invites/invite.service'

/**
 * A real Argon2 hash of a throwaway password. Logins for unknown e-mails are checked
 * against it, so they take as long as real ones — response time never reveals which
 * e-mails have accounts (like a bouncer who takes the same time whether or not you're
 * on the list).
 */
let dummyHash: Promise<string> | undefined
const getDummyHash = () => (dummyHash ??= hashPassword('spendly-timing-equalizer'))

const INVALID_CREDENTIALS = () =>
  new HttpError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha incorretos.')

/**
 * Creates the user and either a brand-new household (with default categories) or — when an
 * invite token is given — membership in the inviting household.
 *
 * @returns the user id and the household the session should open.
 */
export async function register(
  input: RegisterInput,
): Promise<{ userId: string; householdId: string }> {
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  })
  if (existing) {
    throw HttpError.field(
      'email',
      'Já existe uma conta com este e-mail. Que tal entrar?',
      409,
      'EMAIL_TAKEN',
    )
  }

  const invite = input.inviteToken ? await findUsableInvite(input.inviteToken) : null
  if (invite && invite.email !== input.email) {
    throw HttpError.field(
      'email',
      `Este convite foi enviado para ${invite.email}.`,
      403,
      'INVITE_EMAIL_MISMATCH',
    )
  }

  const passwordHash = await hashPassword(input.password)

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email: input.email, name: input.name, passwordHash },
    })
    if (invite) {
      const member = await addMemberFromInvite(tx, invite, user)
      return { userId: user.id, householdId: member.householdId }
    }
    const { household } = await createHouseholdWithDefaults(tx, {
      ownerUserId: user.id,
      ownerName: user.name,
      name: input.householdName,
    })
    return { userId: user.id, householdId: household.id }
  })
}

export async function login(
  input: LoginInput,
): Promise<{ userId: string; householdId: string | null }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } })
  if (!user) {
    await verifyPassword(await getDummyHash(), input.password)
    throw INVALID_CREDENTIALS()
  }
  if (!(await verifyPassword(user.passwordHash, input.password))) throw INVALID_CREDENTIALS()

  return { userId: user.id, householdId: await pickActiveHouseholdId(user.id) }
}

/**
 * Changes the password after checking the current one, and ends every **other** session of
 * that user — if someone else was logged in, the new password locks them out, while the
 * person doing it stays where they are.
 */
export async function changePassword(
  userId: string,
  currentSessionId: string,
  input: ChangePasswordInput,
): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  if (!(await verifyPassword(user.passwordHash, input.currentPassword))) {
    throw HttpError.field('currentPassword', 'Senha atual incorreta.', 401, 'INVALID_CREDENTIALS')
  }
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(input.password) },
  })
  await prisma.session.deleteMany({ where: { userId, id: { not: currentSessionId } } })
}
