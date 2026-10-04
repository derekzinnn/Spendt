import type { Prisma } from '../../generated/prisma/client'

/**
 * Permanently removes a household and everything in it.
 *
 * Never delete a household with a bare `DELETE FROM "Household"`: Postgres checks
 * NO ACTION foreign keys after each cascade step, so a cascade that removes members
 * before the rows that reference them (transactions, rules…) fails. We delete the
 * dependents explicitly, leaves first, and let the final delete cascade the rest
 * (members, invites, tags, sessions' active household).
 */
export async function deleteHouseholdData(tx: Prisma.TransactionClient, householdId: string) {
  const where = { householdId }
  await tx.transaction.deleteMany({ where }) // cascades tag links
  await tx.recurringRule.deleteMany({ where })
  await tx.installmentPlan.deleteMany({ where })
  await tx.invoice.deleteMany({ where })
  await tx.creditCard.deleteMany({ where })
  await tx.account.deleteMany({ where })
  await tx.category.deleteMany({ where: { householdId, NOT: { parentId: null } } })
  await tx.category.deleteMany({ where })
  await tx.household.delete({ where: { id: householdId } })
}
