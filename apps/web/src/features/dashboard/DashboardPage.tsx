import { capitalize, formatBRL, formatMonthLabel, monthName, parseMonthKey } from '@spendly/shared'
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  LayoutDashboard,
  Shapes,
  UserPlus,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'

import { ROUTES } from '@/app/navigation'
import { CategoryIcon } from '@/components/category/CategoryBadge'
import { KpiCell, KpiGrid } from '@/components/data/Kpi'
import { Ruler } from '@/components/data/Ruler'
import { PageHeader } from '@/components/layout/PageHeader'
import { Money } from '@/components/money/Money'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/misc'
import { ACCOUNT_TYPE_META } from '@/features/accounts/account-meta'
import { useAccounts } from '@/features/accounts/api'
import { useHouseholdContext } from '@/features/auth/api'
import { useCategories } from '@/features/categories/api'
import { useInvites } from '@/features/household/api'
import { cn } from '@/lib/cn'
import { useMonth } from '@/lib/month'

interface Step {
  id: string
  icon: LucideIcon
  title: string
  description: string
  done: boolean
  to: string
  cta: string
}

/** "Ana", "Ana e Bia", "Ana, Bia e Caio" */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} e ${names.at(-1)}`
}

function greeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

/** Card heading row: condensed title on the left, a quiet note or link on the right. */
function CardHead({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-xl">{title}</h2>
      {aside}
    </div>
  )
}

function Kpis() {
  const { month } = useMonth()
  const accounts = useAccounts()
  const active = accounts.data?.filter((a) => !a.archivedAt) ?? []
  const balance = active.reduce((sum, a) => sum + a.balanceCents, 0)
  const short = monthName(parseMonthKey(month).month, 'short')

  return (
    <KpiGrid>
      <KpiCell
        icon={<ArrowUpRight />}
        label="Receitas"
        value={<Money cents={0} size="xl" tone="neutral" />}
        sub={`nada lançado em ${short}`}
      />
      <KpiCell
        icon={<ArrowDownRight />}
        label="Despesas"
        value={<Money cents={0} size="xl" tone="neutral" />}
        sub="lançamentos chegam na Fase 3"
      />
      <KpiCell
        label="Saldo nas contas"
        value={
          accounts.isPending ? (
            <Skeleton className="my-1 h-7 w-36" />
          ) : (
            <Money cents={balance} size="xl" tone="neutral" />
          )
        }
        sub="só o que já foi pago"
      />
      <KpiCell
        emphasis
        label="Previsão fim do mês"
        value={<span className="font-display text-[1.875rem] leading-[1.1]">—</span>}
        sub="inclui pendentes e recorrentes · Fase 5"
      />
    </KpiGrid>
  )
}

function GettingStarted() {
  const { member, members } = useHouseholdContext()
  const accounts = useAccounts()
  const categories = useCategories()
  const invites = useInvites(member.role === 'OWNER')

  if (accounts.isPending || categories.isPending) {
    return <Skeleton className="h-72" aria-label="Carregando primeiros passos" />
  }

  const activeAccounts = accounts.data?.filter((a) => !a.archivedAt) ?? []
  const hasBudget = (categories.data ?? []).some(
    (c) => !c.archivedAt && c.monthlyBudgetCents !== null,
  )
  const others = members.filter((m) => !m.isMe)
  const partnerJoined = others.length > 0
  const invitePending = (invites.data?.length ?? 0) > 0

  const steps: Step[] = [
    {
      id: 'accounts',
      icon: Wallet,
      title: 'Cadastre as contas da casa',
      description: activeAccounts.length
        ? `${activeAccounts.length} ${activeAccounts.length === 1 ? 'conta cadastrada' : 'contas cadastradas'}.`
        : 'Conta corrente, reserva, carteira, VR — com o saldo de hoje.',
      done: activeAccounts.length > 0,
      to: ROUTES.accounts,
      cta: activeAccounts.length ? 'Ver contas' : 'Cadastrar',
    },
    {
      id: 'budgets',
      icon: Shapes,
      title: 'Revise categorias e orçamentos',
      description: hasBudget
        ? 'Orçamentos definidos — os alertas de 80% e 100% chegam com o painel.'
        : 'As categorias já vêm prontas; defina um orçamento para Mercado, por exemplo.',
      done: hasBudget,
      to: ROUTES.categories,
      cta: 'Abrir',
    },
    {
      id: 'partner',
      icon: UserPlus,
      title: 'Traga seu par para a casa',
      description: partnerJoined
        ? `${joinNames(others.map((m) => m.displayName))} já ${others.length > 1 ? 'estão' : 'está'} com você.`
        : invitePending
          ? 'Convite enviado — esperando aceitar.'
          : 'Gere um link de convite e mande pelo WhatsApp.',
      done: partnerJoined,
      to: `${ROUTES.settings}#${partnerJoined ? 'pessoas' : 'convite'}`,
      cta: partnerJoined ? 'Ver pessoas' : invitePending ? 'Ver convite' : 'Convidar',
    },
  ].filter((step) => step.id !== 'partner' || member.role === 'OWNER' || step.done)
  const doneCount = steps.filter((s) => s.done).length

  return (
    <Card className="flex flex-col gap-3.5 p-5">
      <CardHead
        title="Primeiros passos"
        aside={
          <Badge tone={doneCount === steps.length ? 'primary' : 'outline'}>
            {doneCount} de {steps.length}
          </Badge>
        }
      />
      <Ruler
        value={doneCount}
        max={steps.length}
        tick={false}
        label="Progresso dos primeiros passos"
      />
      <ol className="flex flex-col">
        {steps.map((step) => {
          const Icon = step.done ? Check : step.icon
          return (
            <li
              key={step.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-border py-3"
            >
              <Icon
                aria-hidden
                className={cn('size-5', step.done ? 'text-steel' : 'text-foreground')}
              />
              <span className="min-w-0">
                <span className={cn('block', step.done && 'text-muted-foreground line-through')}>
                  {step.title}
                  {step.done ? <span className="sr-only"> (feito)</span> : null}
                </span>
                <span className="block text-[13px] text-pretty text-muted-foreground">
                  {step.description}
                </span>
              </span>
              <Button asChild variant={step.done ? 'ghost' : 'secondary'} size="sm">
                <Link to={step.to}>{step.cta}</Link>
              </Button>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}

function Budgets() {
  const { month } = useMonth()
  const categories = useCategories()
  const budgeted = (categories.data ?? [])
    .filter((c) => !c.archivedAt && c.kind === 'EXPENSE' && c.monthlyBudgetCents !== null)
    .sort((a, b) => (b.monthlyBudgetCents ?? 0) - (a.monthlyBudgetCents ?? 0))
  const spent = 0 // Spending per category arrives with transactions (Phase 3).

  return (
    <Card className="flex flex-col gap-2 p-5">
      <CardHead
        title={`Orçamentos de ${monthName(parseMonthKey(month).month)}`}
        aside={
          <Link to={ROUTES.categories} className="text-[13px] text-steel-700 hover:underline">
            Editar
          </Link>
        }
      />
      {categories.isPending ? (
        <Skeleton className="h-40" />
      ) : budgeted.length === 0 ? (
        <p className="border-t border-border pt-3 text-sm text-muted-foreground">
          Nenhum orçamento ainda. Defina um valor mensal em{' '}
          <Link to={ROUTES.categories} className="text-steel-700 underline">
            Categorias
          </Link>{' '}
          e acompanhe aqui, com alerta em 80% e 100%.
        </p>
      ) : (
        <ul className="flex flex-col">
          {budgeted.slice(0, 6).map((category) => {
            const budget = category.monthlyBudgetCents ?? 0
            return (
              <li
                key={category.id}
                className="flex flex-col gap-1.5 border-b border-border px-1.5 py-2.5"
              >
                <div className="flex items-center gap-2 text-sm">
                  <CategoryIcon icon={category.icon} color={category.color} size="sm" />
                  <span className="flex-1 truncate">{category.name}</span>
                  <Money cents={spent} size="sm" />
                </div>
                <div className="flex items-center gap-2">
                  <Ruler
                    value={spent}
                    max={budget}
                    className="flex-1"
                    label={`${formatBRL(spent)} de ${formatBRL(budget)}`}
                  />
                  <span className="min-w-24 text-right text-[11px] text-muted-foreground">
                    de {formatBRL(budget)}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function AccountsGlance() {
  const accounts = useAccounts()
  const active = accounts.data?.filter((a) => !a.archivedAt) ?? []

  return (
    <Card className="flex flex-col gap-1.5 p-5">
      <CardHead
        title="Contas"
        aside={
          <Link to={ROUTES.accounts} className="text-[13px] text-steel-700 hover:underline">
            Ver todas
          </Link>
        }
      />
      {accounts.isPending ? (
        <Skeleton className="h-32" />
      ) : active.length === 0 ? (
        <p className="border-t border-border pt-3 text-sm text-muted-foreground">
          Nenhuma conta ainda.
        </p>
      ) : (
        active.map((account) => {
          const meta = ACCOUNT_TYPE_META[account.type]
          const Icon = meta.icon
          return (
            <div
              key={account.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-border py-2"
            >
              <Icon aria-hidden className="size-4.5 text-steel" />
              <span className="min-w-0">
                <span className="block truncate text-sm">{account.name}</span>
                <span className="block text-xs text-muted-foreground">{meta.short}</span>
              </span>
              <Money cents={account.balanceCents} />
            </div>
          )
        })
      )}
    </Card>
  )
}

export function DashboardPage() {
  const { member, household } = useHouseholdContext()
  const { month } = useMonth()
  return (
    <>
      <PageHeader
        description={`${greeting()}, ${member.displayName}. ${household.name} · ${capitalize(formatMonthLabel(month))}.`}
      />
      <Kpis />
      <div className="grid items-start gap-7 lg:grid-cols-2">
        <GettingStarted />
        <Budgets />
      </div>
      <div className="grid items-start gap-7 lg:grid-cols-2">
        <AccountsGlance />
        <Card className="flex flex-col items-center gap-2.5 border-dashed p-8 text-center">
          <LayoutDashboard aria-hidden className="size-8 text-steel" />
          <h2 className="text-xl">O painel completo vem aí</h2>
          <p className="max-w-sm text-sm text-pretty text-muted-foreground">
            Gastos por categoria, últimos 6 meses, faturas e contas a vencer — tudo clicável. Chega
            na Fase 5.
          </p>
          <Button asChild variant="secondary" size="sm" className="mt-1">
            <Link to={ROUTES.design}>Ver prévia no sistema de design</Link>
          </Button>
        </Card>
      </div>
    </>
  )
}
