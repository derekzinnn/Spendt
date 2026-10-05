import { capitalize, formatMonthLabel } from '@spendly/shared'

import { PageHeader } from '@/components/layout/PageHeader'
import { useHouseholdContext } from '@/features/auth/api'
import { useMonth } from '@/lib/month'

import { AccountsGlance } from './panels/AccountsGlance'
import { BudgetAlerts } from './panels/BudgetAlerts'
import { CardsGlance } from './panels/CardsGlance'
import { CategorySpending } from './panels/CategorySpending'
import { GettingStarted } from './panels/GettingStarted'
import { Kpis } from './panels/Kpis'
import { Trend } from './panels/Trend'
import { UpcomingBills } from './panels/UpcomingBills'

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

/**
 * Where the money went and what is coming. Every number is a door: the KPIs, the donut, the
 * budget tags and the months all open the transactions grid already filtered.
 */
export function DashboardPage() {
  const { member, household } = useHouseholdContext()
  const { month } = useMonth()

  return (
    <>
      <PageHeader
        description={`${greeting()}, ${member.displayName}. ${household.name} · ${capitalize(formatMonthLabel(month))}.`}
      />
      <BudgetAlerts />
      <Kpis />
      <div className="grid items-start gap-7 lg:grid-cols-[1.25fr_1fr]">
        <CategorySpending />
        <Trend />
      </div>
      <div className="grid items-start gap-7 lg:grid-cols-2">
        <UpcomingBills />
        <CardsGlance />
      </div>
      <GettingStarted />
      <AccountsGlance />
    </>
  )
}
