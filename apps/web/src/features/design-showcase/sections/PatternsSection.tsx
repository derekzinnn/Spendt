import { formatBRL, type CategoryIconKey, type PaletteKey } from '@spendly/shared'
import { ArrowDownRight, ArrowUpRight, CreditCard, Trash2, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'

import { CategoryIcon } from '@/components/category/CategoryBadge'
import { KpiCell, KpiGrid } from '@/components/data/Kpi'
import { Ruler } from '@/components/data/Ruler'
import { Money } from '@/components/money/Money'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/cn'

import { DEMO_MEMBERS } from '../demo-data'
import { ShowcaseSection, Specimen } from '../ShowcaseSection'

function drillDown(label: string) {
  toast(`Abriria Lançamentos filtrado por “${label}”`, {
    description: 'Painel 100% clicável chega na Fase 5.',
  })
}

const BILLS = [
  {
    day: '01',
    month: 'out',
    title: 'Energia',
    meta: 'Conta da casa · recorrente',
    cents: 21_870,
    when: 'Atrasada',
  },
  {
    day: '05',
    month: 'out',
    title: 'Fatura Nubank',
    meta: 'Cartão · fecha 28/09',
    cents: 213_490,
    when: 'Amanhã',
  },
  {
    day: '10',
    month: 'out',
    title: 'Condomínio',
    meta: 'Itaú · recorrente',
    cents: 65_000,
    when: 'em 6 dias',
  },
  {
    day: '15',
    month: 'out',
    title: 'Internet',
    meta: 'Itaú · recorrente',
    cents: 11_990,
    when: 'em 11 dias',
  },
]

const CARDS = [
  {
    name: 'Nubank',
    status: 'Aberta',
    invoice: 213_490,
    dates: 'fecha 28/10 · vence 05/11',
    used: 335_790,
    limit: 800_000,
  },
  {
    name: 'Inter',
    status: 'Fechada',
    invoice: 98_420,
    dates: 'fechou 03/10 · vence 10/10',
    used: 98_420,
    limit: 500_000,
  },
]

interface Row {
  date: string
  description: string
  category: { name: string; icon: CategoryIconKey; color: PaletteKey }
  source: string
  paidBy: string
  status: 'Paga' | 'Pendente'
  cents: number
  income?: boolean
}

const [ME, HER] = DEMO_MEMBERS
const ROWS: Row[] = [
  {
    date: '03/10',
    description: 'Padaria',
    category: { name: 'Mercado', icon: 'croissant', color: '700' },
    source: 'Nubank',
    paidBy: ME?.name ?? '',
    status: 'Paga',
    cents: 2_350,
  },
  {
    date: '03/10',
    description: 'Salário',
    category: { name: 'Salário', icon: 'briefcase', color: '700' },
    source: 'Itaú',
    paidBy: HER?.name ?? '',
    status: 'Paga',
    cents: 785_000,
    income: true,
  },
  {
    date: '02/10',
    description: 'Feira',
    category: { name: 'Mercado', icon: 'shopping-cart', color: '700' },
    source: 'Itaú',
    paidBy: HER?.name ?? '',
    status: 'Paga',
    cents: 14_230,
  },
  {
    date: '01/10',
    description: 'Energia',
    category: { name: 'Moradia', icon: 'zap', color: '900' },
    source: '—',
    paidBy: '—',
    status: 'Pendente',
    cents: 21_870,
  },
  {
    date: '30/09',
    description: 'Cinema',
    category: { name: 'Lazer', icon: 'clapperboard', color: '500' },
    source: 'Inter',
    paidBy: ME?.name ?? '',
    status: 'Paga',
    cents: 6_400,
  },
]
const ROWS_TOTAL = ROWS.reduce((sum, r) => sum + (r.income ? r.cents : -r.cents), 0)

export function PatternsSection() {
  return (
    <ShowcaseSection
      id="padroes"
      title="Padrões"
      description="Como as peças se combinam nas próximas fases — com dados de exemplo. Tudo que mostra um número leva para os lançamentos por trás dele."
    >
      <div className="flex flex-col gap-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-[13px]">
            <TriangleAlert className="size-4" /> Orçamentos:
          </span>
          <button
            type="button"
            onClick={() => drillDown('Restaurantes')}
            className="cursor-pointer border border-steel px-2.5 py-1 text-xs text-steel-800 hover:bg-steel-100"
          >
            Restaurantes · 107% — estourou
          </button>
          <button
            type="button"
            onClick={() => drillDown('Mercado')}
            className="cursor-pointer border border-steel px-2.5 py-1 text-xs text-steel-800 hover:bg-steel-100"
          >
            Mercado · 86%
          </button>
        </div>

        <KpiGrid>
          <KpiCell
            icon={<ArrowUpRight />}
            label="Receitas"
            value={<Money cents={1_570_000} size="xl" tone="neutral" />}
            sub="2 de 2 salários recebidos"
            onClick={() => drillDown('receitas de outubro')}
          />
          <KpiCell
            icon={<ArrowDownRight />}
            label="Despesas"
            value={<Money cents={630_670} size="xl" tone="neutral" />}
            sub="até hoje, 04/10"
            onClick={() => drillDown('despesas de outubro')}
          />
          <KpiCell
            label="Saldo realizado"
            value={<Money cents={939_330} size="xl" tone="neutral" />}
            sub="só o que já foi pago"
          />
          <KpiCell
            emphasis
            label="Previsão fim do mês"
            value={<Money cents={412_880} size="xl" tone="neutral" className="text-steel-800" />}
            sub="inclui pendentes e recorrentes"
          />
        </KpiGrid>

        <div className="grid items-start gap-7 lg:grid-cols-2">
          <Card className="flex flex-col gap-1.5 p-5">
            <div className="mb-1.5 flex items-baseline justify-between">
              <h3 className="text-xl">Próximas contas</h3>
              <span className="text-[13px] text-steel-700">Ver todas</span>
            </div>
            {BILLS.map((bill) => (
              <div
                key={bill.title}
                className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 border-t border-border py-2"
              >
                <div className="border border-border py-0.5 text-center leading-tight">
                  <div className="font-display text-lg">{bill.day}</div>
                  <div className="text-[10px] text-muted-foreground uppercase">{bill.month}</div>
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm">{bill.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{bill.meta}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Money cents={bill.cents} size="sm" />
                  <Badge
                    tone={
                      bill.when === 'Atrasada'
                        ? 'negative'
                        : bill.when === 'Amanhã'
                          ? 'warning'
                          : 'neutral'
                    }
                    className="h-4.5 px-1.5 text-[10px]"
                  >
                    {bill.when}
                  </Badge>
                </div>
              </div>
            ))}
          </Card>

          <Card className="flex flex-col gap-3.5 p-5">
            <h3 className="text-xl">Cartões</h3>
            {CARDS.map((card) => (
              <button
                key={card.name}
                type="button"
                onClick={() => drillDown(`fatura ${card.name}`)}
                className="flex cursor-pointer flex-col gap-2 border border-border p-3.5 text-left transition-colors duration-150 hover:border-steel"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-display text-lg">
                    <CreditCard className="size-4.5" /> {card.name}
                  </span>
                  <Badge tone={card.status === 'Fechada' ? 'primary' : 'outline'}>
                    {card.status}
                  </Badge>
                </span>
                <span className="flex flex-wrap items-baseline justify-between gap-2">
                  <Money cents={card.invoice} size="lg" className="text-[26px]" />
                  <span className="text-xs text-muted-foreground">{card.dates}</span>
                </span>
                <Ruler
                  value={card.used}
                  max={card.limit}
                  tick={false}
                  label={`Limite usado: ${formatBRL(card.used)} de ${formatBRL(card.limit)}`}
                />
                <span className="text-xs text-muted-foreground">
                  {formatBRL(card.limit - card.used)} disponíveis de {formatBRL(card.limit)}
                </span>
              </button>
            ))}
          </Card>
        </div>

        <Specimen label="Lançamentos — a planilha, com total sempre à vista (Fase 3)">
          <div className="blueprint border border-border">
            {/* relative: keeps absolutely positioned sr-only text inside the scroll box */}
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-215 border-collapse text-sm">
                <thead>
                  <tr className="text-left">
                    {['Data', 'Descrição', 'Categoria', 'Conta / cartão', 'Pago por', 'Status'].map(
                      (head) => (
                        <th
                          key={head}
                          className="kicker border-b border-border px-2 py-2 font-normal text-muted-foreground"
                        >
                          {head}
                        </th>
                      ),
                    )}
                    <th className="kicker border-b border-border px-2 py-2 text-right font-normal text-muted-foreground">
                      Valor
                    </th>
                    <th className="w-10 border-b border-border" />
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row, index) => (
                    <tr key={index} className="border-b border-foreground/8 hover:bg-foreground/4">
                      <td className="px-2 py-2">{row.date}</td>
                      <td className="px-2 py-2">{row.description}</td>
                      <td className="px-2 py-2">
                        <span className="inline-flex items-center gap-1.5">
                          <CategoryIcon
                            icon={row.category.icon}
                            color={row.category.color}
                            size="xs"
                          />
                          {row.category.name}
                        </span>
                      </td>
                      <td className="px-2 py-2">{row.source}</td>
                      <td className="px-2 py-2">{row.paidBy}</td>
                      <td className="px-2 py-2">
                        <Badge tone={row.status === 'Paga' ? 'neutral' : 'outline'}>
                          {row.status}
                        </Badge>
                      </td>
                      <td className="px-2 py-2 text-right">
                        <Money cents={row.cents} flow={row.income ? 'in' : 'out'} signed />
                      </td>
                      <td className="px-1">
                        <Button
                          variant="quiet"
                          size="icon-sm"
                          aria-label={`Excluir ${row.description}`}
                        >
                          <Trash2 />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className={cn('font-medium')}>
                    <td
                      colSpan={6}
                      className="sticky bottom-0 border-t border-foreground bg-background px-2 py-2.5"
                    >
                      Total · {ROWS.length} lançamentos
                    </td>
                    <td className="sticky bottom-0 border-t border-foreground bg-background px-2 py-2.5 text-right">
                      <Money cents={ROWS_TOTAL} signed />
                    </td>
                    <td className="sticky bottom-0 border-t border-foreground bg-background" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          <p className="text-[13px] text-muted-foreground">
            “Pago por” é só informação: tudo é da casa, sem divisão entre vocês.
          </p>
        </Specimen>
      </div>
    </ShowcaseSection>
  )
}
