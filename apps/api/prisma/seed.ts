/**
 * Development seed: one demo household for a couple, with the default pt-BR categories,
 * a few accounts, credit cards and recurring rules. No transactions yet — those arrive
 * with the engines that create them (Phases 2–3).
 *
 *   pnpm db:seed                    → creates the demo data (skips if it already exists)
 *   SEED_RESET=true pnpm db:seed    → wipes the demo household and recreates it
 *
 * Refuses to run with NODE_ENV=production.
 */
import { currentMonthKey, firstDayOfMonth } from '@spendly/shared'
import { z } from 'zod'

import { env } from '../src/config/env'
import { createDefaultCategories } from '../src/domain/categories/default-categories'
import { deleteHouseholdData } from '../src/domain/households/delete-household'
import { toDbDate } from '../src/lib/db-dates'
import { hashPassword } from '../src/lib/password'
import { createPrismaClient } from '../src/lib/prisma'

const seedEnv = z
  .object({
    SEED_HOUSEHOLD_NAME: z.string().min(1).default('Nossa casa'),
    SEED_OWNER_NAME: z.string().min(1).default('Derek'),
    SEED_OWNER_EMAIL: z.email().default('eu@spendly.local'),
    SEED_PARTNER_NAME: z.string().min(1).default('Parceira'),
    SEED_PARTNER_EMAIL: z.email().default('parceira@spendly.local'),
    SEED_PASSWORD: z.string().min(8, 'SEED_PASSWORD must have at least 8 characters'),
    SEED_RESET: z.stringbool().default(false),
  })
  .parse(process.env)

if (env.NODE_ENV === 'production') {
  console.error('❌ Refusing to seed demo data with NODE_ENV=production.')
  process.exit(1)
}

const prisma = createPrismaClient()

const reais = (value: number) => Math.round(value * 100)

async function resetDemoData(ownerEmail: string, partnerEmail: string) {
  const emails = [ownerEmail, partnerEmail]
  await prisma.$transaction(async (tx) => {
    const memberships = await tx.householdMember.findMany({
      where: { user: { email: { in: emails } }, role: 'OWNER' },
      select: { householdId: true },
    })
    for (const { householdId } of memberships) await deleteHouseholdData(tx, householdId)
    await tx.user.deleteMany({ where: { email: { in: emails } } })
  })
}

async function main() {
  const ownerEmail = seedEnv.SEED_OWNER_EMAIL.toLowerCase()
  const partnerEmail = seedEnv.SEED_PARTNER_EMAIL.toLowerCase()

  const existing = await prisma.user.findUnique({ where: { email: ownerEmail } })
  if (existing && !seedEnv.SEED_RESET) {
    console.log(
      `ℹ️  Demo data already exists for ${ownerEmail}. Run with SEED_RESET=true to recreate it.`,
    )
    return
  }
  if (existing) {
    await resetDemoData(ownerEmail, partnerEmail)
    console.log('🧹 Previous demo household removed.')
  }

  const passwordHash = await hashPassword(seedEnv.SEED_PASSWORD)
  const monthStart = toDbDate(firstDayOfMonth(currentMonthKey()))
  const dayOfThisMonth = (day: number) =>
    toDbDate(`${currentMonthKey()}-${String(day).padStart(2, '0')}`)

  await prisma.$transaction(
    async (tx) => {
      const owner = await tx.user.create({
        data: { email: ownerEmail, name: seedEnv.SEED_OWNER_NAME, passwordHash },
      })
      const partner = await tx.user.create({
        data: { email: partnerEmail, name: seedEnv.SEED_PARTNER_NAME, passwordHash },
      })

      const household = await tx.household.create({ data: { name: seedEnv.SEED_HOUSEHOLD_NAME } })
      const householdId = household.id

      const me = await tx.householdMember.create({
        data: {
          householdId,
          userId: owner.id,
          role: 'OWNER',
          displayName: owner.name,
          color: '700',
        },
      })
      const her = await tx.householdMember.create({
        data: {
          householdId,
          userId: partner.id,
          role: 'MEMBER',
          displayName: partner.name,
          color: '300',
        },
      })

      // ── Categories (+ a few demo budgets) ──
      const categories = await createDefaultCategories(tx, householdId)
      const category = (name: string) => {
        const id = categories.get(name)
        if (!id) throw new Error(`Seed references unknown category "${name}"`)
        return id
      }
      const budgets: Record<string, number> = {
        Mercado: reais(1500),
        Restaurantes: reais(600),
        Transporte: reais(500),
        Lazer: reais(400),
        Assinaturas: reais(150),
      }
      for (const [name, monthlyBudgetCents] of Object.entries(budgets)) {
        await tx.category.update({ where: { id: category(name) }, data: { monthlyBudgetCents } })
      }

      // ── Accounts ──
      const account = (data: {
        name: string
        type: 'CHECKING' | 'SAVINGS' | 'CASH' | 'BENEFIT'
        color: string
        holderId: string | null
        initial: number
      }) =>
        tx.account.create({
          data: {
            householdId,
            name: data.name,
            type: data.type,
            color: data.color,
            holderId: data.holderId,
            initialBalanceCents: reais(data.initial),
            initialBalanceDate: monthStart,
          },
        })

      const myBank = await account({
        name: 'Nubank',
        type: 'CHECKING',
        color: '300',
        holderId: me.id,
        initial: 3200,
      })
      const herBank = await account({
        name: 'Itaú',
        type: 'CHECKING',
        color: '500',
        holderId: her.id,
        initial: 2750,
      })
      const joint = await account({
        name: 'Conta da casa',
        type: 'CHECKING',
        color: '900',
        holderId: null,
        initial: 4100,
      })
      await account({
        name: 'Reserva',
        type: 'SAVINGS',
        color: '700',
        holderId: null,
        initial: 15000,
      })
      await account({ name: 'Carteira', type: 'CASH', color: '300', holderId: null, initial: 180 })
      await account({ name: 'VR', type: 'BENEFIT', color: '500', holderId: me.id, initial: 640 })

      // ── Credit cards ──
      const myCard = await tx.creditCard.create({
        data: {
          householdId,
          name: 'Nubank Roxinho',
          brand: 'MASTERCARD',
          color: '300',
          lastFour: '4821',
          limitCents: reais(8000),
          closingDay: 28,
          dueDay: 5,
          holderId: me.id,
          paymentAccountId: myBank.id,
        },
      })
      await tx.creditCard.create({
        data: {
          householdId,
          name: 'Itaú Click',
          brand: 'VISA',
          color: '500',
          lastFour: '1307',
          limitCents: reais(5500),
          closingDay: 3,
          dueDay: 10,
          holderId: her.id,
          paymentAccountId: herBank.id,
        },
      })
      const sharedCard = await tx.creditCard.create({
        data: {
          householdId,
          name: 'Cartão da casa',
          brand: 'ELO',
          color: '900',
          lastFour: '9050',
          limitCents: reais(4000),
          closingDay: 31,
          dueDay: 10,
          holderId: null,
          paymentAccountId: joint.id,
        },
      })

      // ── Recurring rules ──
      const rules = [
        {
          description: 'Aluguel',
          amount: 2400,
          categoryName: 'Moradia › Aluguel',
          day: 5,
          accountId: joint.id,
        },
        {
          description: 'Condomínio',
          amount: 650,
          categoryName: 'Moradia › Condomínio',
          day: 10,
          accountId: joint.id,
        },
        {
          description: 'Internet',
          amount: 119.9,
          categoryName: 'Moradia › Internet',
          day: 15,
          accountId: joint.id,
        },
        {
          description: 'Netflix',
          amount: 44.9,
          categoryName: 'Assinaturas › Streaming',
          day: 12,
          creditCardId: sharedCard.id,
        },
        {
          description: 'Spotify',
          amount: 34.9,
          categoryName: 'Assinaturas › Música',
          day: 18,
          creditCardId: myCard.id,
          paidById: me.id,
        },
      ]
      for (const rule of rules) {
        await tx.recurringRule.create({
          data: {
            householdId,
            type: 'EXPENSE',
            description: rule.description,
            amountCents: reais(rule.amount),
            categoryId: category(rule.categoryName),
            accountId: rule.accountId ?? null,
            creditCardId: rule.creditCardId ?? null,
            paidById: rule.paidById ?? null,
            startDate: dayOfThisMonth(rule.day),
          },
        })
      }

      const salaries = [
        { member: me, accountId: myBank.id, amount: 8500 },
        { member: her, accountId: herBank.id, amount: 7200 },
      ]
      for (const salary of salaries) {
        await tx.recurringRule.create({
          data: {
            householdId,
            type: 'INCOME',
            description: `Salário ${salary.member.displayName}`,
            amountCents: reais(salary.amount),
            categoryId: category('Salário'),
            accountId: salary.accountId,
            paidById: salary.member.id,
            startDate: dayOfThisMonth(5),
          },
        })
      }
    },
    { timeout: 30_000 },
  )

  console.log(`✅ Seeded "${seedEnv.SEED_HOUSEHOLD_NAME}" for ${ownerEmail} and ${partnerEmail}.`)
}

main()
  .catch((error: unknown) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => void prisma.$disconnect())
