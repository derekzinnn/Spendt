import { Check, Shapes, UserPlus, Wallet, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'

import { ROUTES } from '@/app/navigation'
import { Ruler } from '@/components/data/Ruler'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/misc'
import { useAccounts } from '@/features/accounts/api'
import { useHouseholdContext } from '@/features/auth/api'
import { useCategories } from '@/features/categories/api'
import { useInvites } from '@/features/household/api'
import { cn } from '@/lib/cn'

import { CardHead } from './CardHead'

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

export function GettingStarted() {
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
