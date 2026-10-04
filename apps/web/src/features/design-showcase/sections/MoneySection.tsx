import { formatBRL } from '@spendly/shared'
import { useState, type ReactNode } from 'react'

import { AmountInput } from '@/components/money/AmountInput'
import { Money } from '@/components/money/Money'
import { Card } from '@/components/ui/card'
import { FieldHint, Label } from '@/components/ui/input'
import { usePrivacy } from '@/lib/privacy'

import { ShowcaseSection, Specimen } from '../ShowcaseSection'

export function MoneySection() {
  const [amount, setAmount] = useState<number | null>(123456)
  const [hero, setHero] = useState<number | null>(null)
  const { hidden } = usePrivacy()

  return (
    <ShowcaseSection
      id="dinheiro"
      title="Dinheiro"
      description={
        <>
          Todo valor é guardado em <strong className="font-medium">centavos inteiros</strong> e
          passa pelo componente <code className="bg-muted px-1 text-[13px]">Money</code>. Receitas
          levam “+” em aço escuro; despesas e saldos negativos ficam em tinta com “−”. O olho no
          cabeçalho oculta todos os valores de uma vez.
        </>
      }
    >
      <div className="grid gap-7 lg:grid-cols-2">
        <Card className="flex flex-col gap-6 p-6">
          <Specimen label="Tamanhos">
            <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
              <Money cents={423015} size="hero" />
              <Money cents={423015} size="xl" />
              <Money cents={423015} size="lg" />
              <Money cents={423015} size="md" />
              <Money cents={423015} size="sm" />
            </div>
          </Specimen>
          <Specimen label="Significado">
            <dl className="grid grid-cols-2 text-[13px]">
              {(
                [
                  ['Receita (flow="in")', <Money key="a" cents={850000} flow="in" />],
                  ['Despesa (flow="out")', <Money key="b" cents={4590} flow="out" />],
                  ['Despesa com sinal', <Money key="c" cents={4590} flow="out" signed />],
                  ['Saldo negativo', <Money key="d" cents={-31250} />],
                  ['Compacto (gráficos)', <Money key="e" cents={1_284_000} compact />],
                  [
                    'Ocultar valores',
                    <span key="f" className="text-muted-foreground">
                      {hidden ? 'ativado' : 'desativado'} — use o olho
                    </span>,
                  ],
                ] satisfies [string, ReactNode][]
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="col-span-2 grid grid-cols-subgrid border-b border-border py-2"
                >
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </Specimen>
        </Card>

        <Card className="flex flex-col gap-6 p-6">
          <Specimen label="Campo de valor — preenche da direita, como maquininha">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount-demo">Valor</Label>
              <AmountInput id="amount-demo" value={amount} onChange={setAmount} />
              <FieldHint>
                Digite 1, 2, 3, 4 → R$ 12,34. Colar “R$ 1.234,56” também funciona. Guardado:{' '}
                <code className="font-money text-foreground">
                  {amount === null ? 'null' : `${amount} centavos`}
                </code>
              </FieldHint>
            </div>
          </Specimen>
          <Specimen label="Versão destaque (lançamento rápido)">
            <AmountInput
              size="hero"
              value={hero}
              onChange={setHero}
              aria-label="Valor em destaque"
            />
            <p className="text-xs text-muted-foreground">
              {hero === null ? 'Teclado numérico no celular, sem caçar a vírgula' : formatBRL(hero)}
            </p>
          </Specimen>
        </Card>
      </div>
    </ShowcaseSection>
  )
}
