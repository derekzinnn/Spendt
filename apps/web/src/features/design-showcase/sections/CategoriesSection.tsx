import { currentMonthKey, DEFAULT_CATEGORIES, formatMonthLabel, monthKeyOf } from '@spendly/shared'
import { useState } from 'react'

import { CategoryBadge, CategoryIcon } from '@/components/category/CategoryBadge'
import { MonthPicker } from '@/components/month-picker/MonthPicker'
import { ColorPicker } from '@/components/pickers/ColorPicker'
import { Card } from '@/components/ui/card'

import { ShowcaseSection, Specimen } from '../ShowcaseSection'

const expenses = DEFAULT_CATEGORIES.filter((c) => c.kind === 'EXPENSE')
const incomes = DEFAULT_CATEGORIES.filter((c) => c.kind === 'INCOME')
const housing = DEFAULT_CATEGORIES.find((c) => c.name === 'Moradia')!

export function CategoriesSection() {
  const [month, setMonth] = useState(currentMonthKey())
  const [tone, setTone] = useState<(typeof expenses)[number]['color']>('700')

  return (
    <ShowcaseSection
      id="categorias"
      title="Categorias, tons e mês"
      description="As categorias padrão que toda casa nova recebe. Identidade = nome + ícone + tom, nunca só o tom: com um acento só, o ícone é quem diferencia."
    >
      <div className="grid gap-7 lg:grid-cols-[1.6fr_1fr]">
        <Card className="flex flex-col gap-6 p-6">
          <Specimen label={`Despesas (${expenses.length})`}>
            <div className="flex flex-wrap gap-2">
              {expenses.map((c) => (
                <CategoryBadge key={c.name} name={c.name} icon={c.icon} color={c.color} />
              ))}
            </div>
          </Specimen>
          <Specimen label={`Receitas (${incomes.length})`}>
            <div className="flex flex-wrap gap-2">
              {incomes.map((c) => (
                <CategoryBadge key={c.name} name={c.name} icon={c.icon} color={c.color} />
              ))}
            </div>
          </Specimen>
        </Card>

        <Card className="flex flex-col gap-6 p-6">
          <Specimen label="Variações">
            <div className="flex flex-col items-start gap-2.5">
              <CategoryBadge name="Mercado" icon="shopping-cart" color="700" size="sm" />
              <CategoryBadge
                name="Aluguel"
                parentName="Moradia"
                icon="key"
                color="900"
                variant="outline"
              />
              <CategoryBadge name="Delivery" icon="pizza" color="300" variant="plain" />
            </div>
          </Specimen>
          <Specimen label="Subcategorias herdam o tom">
            <ul className="flex flex-col">
              {housing.children?.slice(0, 4).map((child) => (
                <li
                  key={child.name}
                  className="flex items-center gap-3 border-b border-border py-2 last:border-b-0"
                >
                  <CategoryIcon icon={child.icon} color={housing.color} size="sm" />
                  <span className="text-sm">{child.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{housing.name}</span>
                </li>
              ))}
            </ul>
          </Specimen>
        </Card>
      </div>

      <div className="mt-7 grid gap-7 lg:grid-cols-2">
        <Card className="flex flex-col gap-4 p-6">
          <Specimen label="Escolher tom">
            <ColorPicker value={tone} onChange={setTone} label="Tom" />
          </Specimen>
        </Card>
        <Card className="flex flex-col gap-4 p-6">
          <Specimen label="Seletor de mês — o mesmo do cabeçalho">
            <MonthPicker
              value={month}
              onChange={setMonth}
              max={monthKeyOf('2027-12-01')}
              className="self-start"
            />
            <p className="text-[13px] text-muted-foreground">
              Selecionado: <code className="font-money text-foreground">{month}</code> ·{' '}
              {formatMonthLabel(month)} — um mês de calendário, nunca uma data com fuso.
            </p>
          </Specimen>
        </Card>
      </div>
    </ShowcaseSection>
  )
}
