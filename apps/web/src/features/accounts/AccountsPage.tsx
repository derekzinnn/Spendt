import { formatDateBR, type AccountDto, type MemberDto, type PaletteKey } from '@spendly/shared'
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  EllipsisVertical,
  Pencil,
  Plus,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { paletteStyle } from '@/components/category/palette-style'
import { KpiCell, KpiGrid } from '@/components/data/Kpi'
import { EmptyState } from '@/components/empty-state/EmptyState'
import { PageHeader } from '@/components/layout/PageHeader'
import { MemberAvatar } from '@/components/member/MemberAvatar'
import { Money } from '@/components/money/Money'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/misc'
import { useHouseholdContext } from '@/features/auth/api'
import { APP_NAME } from '@/lib/brand'
import { undoToast } from '@/lib/undo-toast'

import { ACCOUNT_TYPE_META } from './account-meta'
import { AccountFormSheet } from './AccountFormSheet'
import { useAccounts, useArchiveAccount, useDeleteAccount } from './api'

function useArchiveWithUndo() {
  const archive = useArchiveAccount()
  return (account: AccountDto) =>
    archive.mutate(
      { id: account.id, archived: true },
      {
        onSuccess: () =>
          undoToast(`“${account.name}” arquivada`, {
            description: 'Ela some das listas, mas o histórico fica guardado.',
            onUndo: () => archive.mutate({ id: account.id, archived: false }),
          }),
        onError: (error) => toast.error(error.message),
      },
    )
}

function HolderTag({ holder }: { holder: MemberDto | undefined }) {
  if (!holder) {
    return (
      <Badge tone="outline">
        <Users /> Conjunta
      </Badge>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <MemberAvatar name={holder.displayName} color={holder.color} size="xs" className="ring-0" />
      {holder.displayName}
    </span>
  )
}

function AccountCard({
  account,
  holder,
  onEdit,
  onArchive,
}: {
  account: AccountDto
  holder: MemberDto | undefined
  onEdit: () => void
  onArchive: () => void
}) {
  const meta = ACCOUNT_TYPE_META[account.type]
  const Icon = meta.icon
  return (
    <Card
      style={paletteStyle(account.color)}
      className="group flex flex-col gap-4 p-5 transition-colors duration-150 hover:border-steel"
    >
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Editar ${account.name}`}
        className="absolute inset-0 cursor-pointer focus-visible:outline-offset-[-2px]"
      />
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center bg-(--tint) text-(--tint-fg)">
          <Icon className="size-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-lg leading-tight">{account.name}</p>
          <p className="text-xs text-muted-foreground">{meta.short}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="quiet"
              size="icon-sm"
              className="relative z-10 -mt-1 -mr-2"
              aria-label={`Ações de ${account.name}`}
            >
              <EllipsisVertical />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onArchive}>
              <Archive /> Arquivar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Money cents={account.balanceCents} size="xl" />

      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        <HolderTag holder={holder} />
        <span className="text-xs text-muted-foreground">
          desde {formatDateBR(account.initialBalanceDate)}
        </span>
      </div>
    </Card>
  )
}

function Summary({ accounts, members }: { accounts: AccountDto[]; members: MemberDto[] }) {
  const total = accounts.reduce((sum, a) => sum + a.balanceCents, 0)
  const sumOf = (holderId: string | null) =>
    accounts.filter((a) => a.holderId === holderId).reduce((sum, a) => sum + a.balanceCents, 0)
  return (
    <KpiGrid>
      <KpiCell
        emphasis
        label="Saldo total em contas"
        value={<Money cents={total} size="xl" tone="neutral" className="text-steel-800" />}
        sub={`${accounts.length} ${accounts.length === 1 ? 'conta ativa' : 'contas ativas'}`}
      />
      {members.map((m) => (
        <KpiCell
          key={m.id}
          icon={<MemberAvatar name={m.displayName} color={m.color} size="xs" className="ring-0" />}
          label={`Em nome de ${m.displayName}`}
          value={<Money cents={sumOf(m.id)} size="xl" tone="neutral" />}
        />
      ))}
      <KpiCell
        icon={<Users />}
        label="Conjuntas"
        value={<Money cents={sumOf(null)} size="xl" tone="neutral" />}
      />
    </KpiGrid>
  )
}

function ArchivedList({ accounts }: { accounts: AccountDto[] }) {
  const archive = useArchiveAccount()
  const remove = useDeleteAccount()
  const [toDelete, setToDelete] = useState<AccountDto | null>(null)

  return (
    <details className="group">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
        Arquivadas ({accounts.length})
      </summary>
      <Card className="mt-3">
        {accounts.map((account) => (
          <div
            key={account.id}
            className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
            style={paletteStyle(account.color)}
          >
            <span aria-hidden className="size-2.5 shrink-0 bg-(--tint)" />
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {account.name}
            </span>
            <Money cents={account.balanceCents} size="sm" tone="muted" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                archive.mutate(
                  { id: account.id, archived: false },
                  {
                    onSuccess: () => toast.success(`“${account.name}” restaurada`),
                    onError: (e) => toast.error(e.message),
                  },
                )
              }
            >
              <ArchiveRestore /> Restaurar
            </Button>
            <Button
              variant="quiet"
              size="icon-sm"
              aria-label={`Excluir ${account.name}`}
              onClick={() => setToDelete(account)}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </Card>
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Excluir “${toDelete?.name ?? ''}”?`}
        description="Só dá para excluir contas sem nenhum lançamento. Isso não pode ser desfeito."
        confirmLabel="Excluir de vez"
        pending={remove.isPending}
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, {
            onSuccess: () => toast.success('Conta excluída'),
            onError: (e) => toast.error(e.message),
            onSettled: () => setToDelete(null),
          })
        }
      />
    </details>
  )
}

export function AccountsPage() {
  const { members } = useHouseholdContext()
  const { data, isPending, isError, error, refetch } = useAccounts()
  const archiveWithUndo = useArchiveWithUndo()
  const [sheet, setSheet] = useState<{ open: boolean; account?: AccountDto | undefined }>({
    open: false,
  })

  const active = useMemo(() => data?.filter((a) => !a.archivedAt) ?? [], [data])
  const archived = useMemo(() => data?.filter((a) => a.archivedAt) ?? [], [data])
  const usedColors = useMemo<PaletteKey[]>(() => active.map((a) => a.color), [active])
  const membersById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])

  const newAccount = () => setSheet({ open: true })

  return (
    <>
      <PageHeader
        description="Cada conta com seu saldo calculado a partir dos lançamentos — nada de digitar saldo à mão."
        actions={
          <Button onClick={newAccount}>
            <Plus /> Nova conta
          </Button>
        }
      />

      {isPending ? (
        <div
          className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
          aria-busy="true"
          aria-label="Carregando contas"
        >
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <EmptyState
            size="sm"
            icon={Wallet}
            title="Não deu para carregar as contas"
            description={error.message}
            action={<Button onClick={() => void refetch()}>Tentar de novo</Button>}
          />
        </Card>
      ) : active.length === 0 ? (
        <Card className="border-dashed">
          <EmptyState
            icon={Wallet}
            title="Cadastre a primeira conta"
            description={`Conta corrente, reserva, a carteira, o VR… Informe o saldo de hoje e o resto a ${APP_NAME} calcula.`}
            action={
              <Button onClick={newAccount}>
                <Plus /> Nova conta
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <Summary accounts={active} members={members} />
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {active.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                holder={account.holderId ? membersById.get(account.holderId) : undefined}
                onEdit={() => setSheet({ open: true, account })}
                onArchive={() => archiveWithUndo(account)}
              />
            ))}
          </div>
        </>
      )}

      {archived.length > 0 ? <ArchivedList accounts={archived} /> : null}

      <AccountFormSheet
        open={sheet.open}
        onOpenChange={(open) => setSheet((current) => ({ ...current, open }))}
        account={sheet.account}
        usedColors={usedColors}
      />
    </>
  )
}
