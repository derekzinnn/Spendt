import { Link } from 'react-router'

import { ROUTES } from '@/app/navigation'
import { Money } from '@/components/money/Money'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/misc'
import { ACCOUNT_TYPE_META } from '@/features/accounts/account-meta'
import { useAccounts } from '@/features/accounts/api'

import { CardHead } from './CardHead'

export function AccountsGlance() {
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
