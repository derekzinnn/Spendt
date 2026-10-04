import { z } from 'zod'

import { CATEGORY_ICON_KEYS } from '../category-icons'
import { isMonthKey } from '../dates'
import {
  ACCOUNT_TYPES,
  CARD_BRANDS,
  CATEGORY_KINDS,
  HOUSEHOLD_ROLES,
  RECURRENCE_FREQUENCIES,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
} from '../enums'
import { MAX_CENTS } from '../money'
import { PALETTE_KEYS } from '../palette'

/** Any amount of cents that fits the database column (may be negative, e.g. a balance). */
export const centsSchema = z.int().min(-MAX_CENTS).max(MAX_CENTS)

/** A strictly positive amount: what every transaction stores. */
export const positiveCentsSchema = z.int().min(1, 'Informe um valor maior que zero').max(MAX_CENTS)

/** Calendar date, "YYYY-MM-DD". */
export const isoDateSchema = z.iso.date()

/** Calendar month, "YYYY-MM". */
export const monthKeySchema = z.string().refine(isMonthKey, 'Mês inválido')

export const idSchema = z.uuid()

/** 0–10000, where 5000 = 50%. */
export const basisPointsSchema = z.int().min(0).max(10_000)

export const dayOfMonthSchema = z.int().min(1).max(31)

export const paletteKeySchema = z.enum(PALETTE_KEYS)
export const categoryIconKeySchema = z.enum(CATEGORY_ICON_KEYS)

export const householdRoleSchema = z.enum(HOUSEHOLD_ROLES)
export const categoryKindSchema = z.enum(CATEGORY_KINDS)
export const accountTypeSchema = z.enum(ACCOUNT_TYPES)
export const cardBrandSchema = z.enum(CARD_BRANDS)
export const transactionTypeSchema = z.enum(TRANSACTION_TYPES)
export const transactionStatusSchema = z.enum(TRANSACTION_STATUSES)
export const recurrenceFrequencySchema = z.enum(RECURRENCE_FREQUENCIES)
