import type { IsoDate } from '@spendly/shared'

/**
 * The one and only bridge between calendar dates ("YYYY-MM-DD") and Prisma `@db.Date`
 * columns. Prisma represents a DATE as a JS Date at UTC midnight, so we always build
 * and read it in UTC — never with the server's local timezone.
 */
export function toDbDate(value: IsoDate): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

export function fromDbDate(value: Date): IsoDate {
  return value.toISOString().slice(0, 10)
}
