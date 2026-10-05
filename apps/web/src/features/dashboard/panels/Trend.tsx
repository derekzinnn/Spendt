import { TrendBars } from '@/components/data/TrendBars'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/misc'
import { useSummary } from '@/features/dashboard/api'
import { useMonth } from '@/lib/month'

/** Income × expense over the last six months. Clicking a month takes the whole app there. */
export function Trend() {
  const { month, setMonth } = useMonth()
  const { data, isPending } = useSummary(month)

  return (
    <Card className="flex flex-col gap-3.5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl">Últimos 6 meses</h2>
        <ul className="flex gap-3.5 text-xs text-muted-foreground" aria-label="Legenda">
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 border border-steel" /> Receitas
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 bg-steel-700" /> Despesas
          </li>
        </ul>
      </div>
      {isPending || !data ? (
        <Skeleton className="h-52" />
      ) : (
        <TrendBars points={data.trend} currentMonth={month} onSelect={setMonth} />
      )}
    </Card>
  )
}
