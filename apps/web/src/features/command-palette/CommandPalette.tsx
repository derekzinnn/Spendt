import { formatDateBR, formatMonthLabel, type TransactionDto } from '@spendly/shared'
import { CornerDownLeft, Plus, Search, Sheet as SheetIcon } from 'lucide-react'
import { Dialog } from 'radix-ui'
import { useDeferredValue, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router'

import { ALL_NAV_ITEMS, ROUTES } from '@/app/navigation'
import { Money } from '@/components/money/Money'
import { Kbd } from '@/components/ui/misc'
import { overlayClassName } from '@/components/ui/sheet'
import { useTransactions } from '@/features/transactions/api'
import { cn } from '@/lib/cn'
import { normalizeSearch } from '@/lib/search-text'
import { useMonth } from '@/lib/month'

interface Command {
  id: string
  group: 'Lançar' | 'Ir para' | 'Lançamentos'
  label: ReactNode
  hint?: ReactNode
  icon: ReactNode
  /** Text matched against the query. */
  keywords: string
  run: () => void
}

/**
 * Ctrl/⌘+K: one box to launch, jump and find. Typing filters screens and searches the
 * month's transactions; Enter runs the highlighted line; ↑/↓ move.
 */
export function CommandPalette({
  open,
  onOpenChange,
  onQuickAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onQuickAdd: () => void
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={overlayClassName} />
        <Dialog.Content
          aria-describedby={undefined}
          className="blueprint fixed inset-x-3 top-3 z-50 border border-border bg-background shadow-overlay outline-none data-[state=open]:animate-in data-[state=open]:duration-150 data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-2 desk:inset-x-auto desk:top-[14vh] desk:left-1/2 desk:w-150 desk:-translate-x-1/2"
        >
          <Dialog.Title className="sr-only">Lançar ou buscar</Dialog.Title>
          <Palette onClose={() => onOpenChange(false)} onQuickAdd={onQuickAdd} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Palette({ onClose, onQuickAdd }: { onClose: () => void; onQuickAdd: () => void }) {
  const navigate = useNavigate()
  const { month } = useMonth()
  const [text, setText] = useState('')
  const [active, setActive] = useState(0)
  const query = useDeferredValue(normalizeSearch(text))
  const search = useTransactions({ month, q: text.trim() }, { enabled: query.length >= 2 })

  const go = (to: string) => {
    onClose()
    void navigate(to)
  }

  const commands = useMemo<Command[]>(() => {
    const launch: Command[] = [
      {
        id: 'quick-add',
        group: 'Lançar',
        label: 'Lançamento rápido',
        hint: 'valor, categoria, conta ou cartão',
        icon: <Plus />,
        keywords: 'lancar novo gasto despesa receita rapido compra',
        run: () => {
          onClose()
          onQuickAdd()
        },
      },
      {
        id: 'detailed',
        group: 'Lançar',
        label: 'Lançamento detalhado',
        hint: 'transferência, conta a pagar, observação',
        icon: <SheetIcon />,
        keywords: 'transferencia conta a pagar boleto pendente detalhado',
        run: () => go(`${ROUTES.transactions}?novo=1`),
      },
      {
        id: 'purchase',
        group: 'Lançar',
        label: 'Compra parcelada no cartão',
        icon: <Plus />,
        keywords: 'cartao parcelado parcelas compra fatura',
        run: () => go(`${ROUTES.cards}?compra=1`),
      },
    ]
    const screens: Command[] = ALL_NAV_ITEMS.map((item) => {
      const Icon = item.icon
      return {
        id: `nav:${item.to}`,
        group: 'Ir para',
        label: item.label,
        icon: <Icon />,
        keywords: `${item.label} ${item.shortLabel ?? ''}`,
        run: () => go(item.to),
      }
    })
    const found: Command[] =
      query.length >= 2
        ? (search.data?.items ?? []).slice(0, 8).map((t: TransactionDto) => ({
            id: `tx:${t.id}`,
            group: 'Lançamentos',
            label: t.description,
            hint: (
              <span className="flex items-center gap-2">
                {formatDateBR(t.date).slice(0, 5)}
                <Money
                  cents={t.amountCents}
                  size="sm"
                  {...(t.type === 'TRANSFER'
                    ? {}
                    : { flow: t.type === 'INCOME' ? ('in' as const) : ('out' as const) })}
                  signed={t.type !== 'TRANSFER'}
                />
              </span>
            ),
            icon: <Search />,
            keywords: t.description,
            run: () => go(`${ROUTES.transactions}?q=${encodeURIComponent(t.description)}`),
          }))
        : []
    const matches = (c: Command) => !query || normalizeSearch(c.keywords).includes(query)
    return [...launch.filter(matches), ...screens.filter(matches), ...found]
    // eslint-disable-next-line react-hooks/exhaustive-deps -- go/onClose are stable enough per open
  }, [query, search.data])

  const current = Math.min(active, Math.max(commands.length - 1, 0))

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((current + 1) % Math.max(commands.length, 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((current - 1 + commands.length) % Math.max(commands.length, 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      commands[current]?.run()
    }
  }

  let lastGroup = ''
  return (
    <div className="flex max-h-[70dvh] flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search className="size-4 text-muted-foreground" />
        <input
          autoFocus
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setActive(0)
          }}
          onKeyDown={onKeyDown}
          placeholder={`Lançar, ir para uma tela ou buscar em ${formatMonthLabel(month, 'month')}…`}
          aria-label="Lançar ou buscar"
          role="combobox"
          aria-expanded="true"
          aria-controls="palette-list"
          aria-activedescendant={commands[current] ? `palette-${commands[current].id}` : undefined}
          className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-subtle-foreground"
        />
        <Kbd>Esc</Kbd>
      </div>
      <ul id="palette-list" role="listbox" className="relative overflow-y-auto py-1">
        {commands.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">
            {search.isFetching ? 'Buscando…' : 'Nada encontrado.'}
          </li>
        ) : null}
        {commands.map((command, index) => {
          const header = command.group !== lastGroup
          lastGroup = command.group
          return (
            <li key={command.id} role="presentation">
              {header ? (
                <p className="kicker px-4 pt-3 pb-1 text-muted-foreground">{command.group}</p>
              ) : null}
              <button
                type="button"
                id={`palette-${command.id}`}
                role="option"
                aria-selected={index === current}
                onMouseMove={() => setActive(index)}
                onClick={command.run}
                className={cn(
                  'flex min-h-10 w-full cursor-pointer items-center gap-3 px-4 text-left text-sm [&_svg]:size-4 [&_svg]:shrink-0',
                  index === current ? 'bg-steel-100 text-steel-800' : 'text-foreground',
                )}
              >
                <span className="text-muted-foreground">{command.icon}</span>
                <span className="min-w-0 flex-1 truncate">{command.label}</span>
                {command.hint ? (
                  <span className="shrink-0 text-xs text-muted-foreground">{command.hint}</span>
                ) : null}
                {index === current ? <CornerDownLeft className="text-muted-foreground" /> : null}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
