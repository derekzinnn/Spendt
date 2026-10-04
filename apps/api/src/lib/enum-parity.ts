/**
 * Compile-time guard: the enums in @spendly/shared (used by the web app and Zod schemas)
 * must match the enums Prisma generates from schema.prisma. If someone adds a value to
 * one side only, `pnpm typecheck` fails right here.
 *
 * This file has no runtime behavior.
 */
import type * as Shared from '@spendly/shared'

import type * as Db from '../generated/prisma/enums'

type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T

export type EnumParity = [
  Assert<Equals<Db.HouseholdRole, Shared.HouseholdRole>>,
  Assert<Equals<Db.CategoryKind, Shared.CategoryKind>>,
  Assert<Equals<Db.AccountType, Shared.AccountType>>,
  Assert<Equals<Db.CardBrand, Shared.CardBrand>>,
  Assert<Equals<Db.TransactionType, Shared.TransactionType>>,
  Assert<Equals<Db.TransactionStatus, Shared.TransactionStatus>>,
  Assert<Equals<Db.RecurrenceFrequency, Shared.RecurrenceFrequency>>,
]
