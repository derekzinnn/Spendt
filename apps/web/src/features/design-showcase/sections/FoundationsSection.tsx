import { PALETTE_KEYS, PALETTE_LABELS } from '@spendly/shared'

import { paletteStyle } from '@/components/category/palette-style'
import { Money } from '@/components/money/Money'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/cn'
import { useTheme } from '@/lib/theme'

import { ShowcaseSection, Specimen } from '../ShowcaseSection'

const STEPS = [100, 200, 300, 400, 500, 600, 700, 800, 900] as const

const SEMANTIC = [
  { token: 'background', label: 'Chão (papel)', className: 'bg-background' },
  { token: 'surface-sunken', label: 'Campos', className: 'bg-surface-sunken' },
  { token: 'foreground', label: 'Tinta', className: 'bg-foreground' },
  { token: 'muted-foreground', label: 'Tinta suave', className: 'bg-muted-foreground' },
  { token: 'steel', label: 'Aço (acento)', className: 'bg-steel' },
  { token: 'primary', label: 'Aço p/ texto', className: 'bg-primary' },
  { token: 'emphasis', label: 'Campo escuro', className: 'bg-emphasis' },
  { token: 'border', label: 'Linha 16%', className: 'bg-border' },
]

const MEANINGS = [
  { sign: '+ ↗', label: 'Receita', className: 'text-positive', use: 'Aço escuro, sinal e seta' },
  { sign: '− ↘', label: 'Despesa', className: 'text-foreground', use: 'Tinta, sinal e seta' },
  { sign: '!', label: 'Atrasada', className: 'text-foreground', use: 'Moldura em tinta + palavra' },
  { sign: '■', label: 'Vence logo', className: 'text-steel-900', use: 'Etiqueta aço profundo' },
]

const NUMBERS = [123456, 9990, 1_250_000, 45, 87_310]

const TYPE_SCALE = [
  { label: 'H1 · 42', className: 'text-[42px]', sample: 'O Excel da nossa vida' },
  { label: 'H2 · 32', className: 'text-[32px]', sample: 'Gastos por categoria' },
  { label: 'H3 · 25', className: 'text-[25px]', sample: 'Contas a pagar' },
  { label: 'H4 · 20', className: 'text-xl', sample: 'Próximas contas' },
]

function Ramp({ name, label }: { name: 'steel' | 'graphite'; label: string }) {
  return (
    <Specimen label={label}>
      <div className="grid grid-cols-9 border border-border">
        {STEPS.map((step) => (
          <div key={step} className="flex flex-col">
            <div className="h-12" style={{ background: `var(--${name}-${step})` }} />
            <span className="border-t border-border py-1 text-center text-[11px] text-muted-foreground">
              {step}
            </span>
          </div>
        ))}
      </div>
    </Specimen>
  )
}

export function FoundationsSection() {
  const { resolvedMode, setMode } = useTheme()
  const directions = [
    {
      mode: 'light' as const,
      name: 'A · Planta',
      text: 'Papel técnico #f2f2f3, tinta #1d1f20 e um único aço #5980a6. O padrão.',
    },
    {
      mode: 'dark' as const,
      name: 'B · Aço noturno',
      text: 'O mesmo desenho à noite: chão #14181c, tinta #e6e8ea, aço claro #8fb3d6.',
    },
  ]

  return (
    <>
      <ShowcaseSection
        id="direcoes"
        title="Direções"
        description="Duas leituras do mesmo sistema. Os componentes nunca mudam — só os tokens. Clique para trocar."
      >
        <div className="grid gap-7 md:grid-cols-2">
          {directions.map((d) => (
            <button
              key={d.mode}
              type="button"
              onClick={() => setMode(d.mode)}
              aria-pressed={resolvedMode === d.mode}
              className={cn(
                'blueprint flex cursor-pointer flex-col gap-4 border p-5 text-left transition-colors',
                resolvedMode === d.mode
                  ? 'border-steel'
                  : 'border-border hover:border-border-strong',
              )}
            >
              {/* The tokens are scoped by class, so each preview renders its own direction. */}
              <span
                className={cn(
                  d.mode,
                  'flex h-28 items-end gap-3 border border-border bg-background p-4 text-foreground',
                )}
              >
                <span className="font-display text-4xl leading-none">Aa</span>
                <span className="h-8 w-16 bg-steel" />
                <span className="h-8 w-8 border border-steel" />
                <span className="ml-auto text-xs text-muted-foreground">R$ 1.234,56</span>
              </span>
              <span className="flex items-baseline justify-between gap-3">
                <span className="font-display text-xl">{d.name}</span>
                {resolvedMode === d.mode ? (
                  <span className="text-xs text-steel-700">em uso</span>
                ) : null}
              </span>
              <span className="text-sm text-muted-foreground">{d.text}</span>
            </button>
          ))}
        </div>
      </ShowcaseSection>

      <ShowcaseSection
        id="cores"
        title="Cores"
        description="Um esquema mono: chão, tinta e um só acento em aço, cada um com rampa 100–900 de mesmo peso visual. Sem verde nem vermelho — sinal, seta e palavra carregam o significado."
      >
        <div className="flex flex-col gap-7">
          <div className="grid gap-7 lg:grid-cols-2">
            <Ramp name="steel" label="Aço · rampa" />
            <Ramp name="graphite" label="Grafite · rampa" />
          </div>

          <div className="grid gap-7 lg:grid-cols-[1.4fr_1fr]">
            <Specimen label="Papéis">
              <div className="grid grid-cols-4 gap-px border border-border bg-border">
                {SEMANTIC.map((s) => (
                  <div key={s.token} className="flex min-w-0 flex-col gap-1.5 bg-background p-2.5">
                    <div className={cn('h-10 border border-border', s.className)} />
                    <span className="text-xs">{s.label}</span>
                    <code className="truncate text-[11px] text-muted-foreground">--{s.token}</code>
                  </div>
                ))}
              </div>
            </Specimen>

            <Specimen label="Significado sem cor">
              <ul className="flex flex-col">
                {MEANINGS.map((m) => (
                  <li
                    key={m.label}
                    className="grid grid-cols-[3rem_6rem_1fr] items-center gap-3 border-b border-border py-2 text-sm"
                  >
                    <span className={cn('font-display text-lg', m.className)}>{m.sign}</span>
                    <span>{m.label}</span>
                    <span className="text-[13px] text-muted-foreground">{m.use}</span>
                  </li>
                ))}
              </ul>
            </Specimen>
          </div>

          <Specimen label="Tons — categorias, contas e pessoas">
            <div className="grid grid-cols-5 gap-px border border-border bg-border">
              {PALETTE_KEYS.map((key) => (
                <div key={key} className="flex flex-col bg-background" style={paletteStyle(key)}>
                  <div className="grid h-16 place-items-center bg-(--tint) font-display text-lg text-(--tint-fg)">
                    {key === 'neutral' ? '—' : key}
                  </div>
                  <span className="px-2 pt-1.5 text-xs">{PALETTE_LABELS[key]}</span>
                  <code className="px-2 pb-2 text-[11px] text-muted-foreground">{key}</code>
                </div>
              ))}
            </div>
            <p className="text-[13px] text-muted-foreground">
              O banco guarda a <em>chave</em> do tom (“700”), nunca o hex — no escuro a mesma chave
              vira a versão clara. O ícone sempre acompanha o tom; “Grafite” é o neutro de “Outros”.
            </p>
          </Specimen>
        </div>
      </ShowcaseSection>

      <ShowcaseSection
        id="tipografia"
        title="Tipografia"
        description="Barlow Condensed 600 para títulos e números grandes; Barlow para a interface. Todo número usa algarismos tabulares, para as colunas alinharem como numa planilha."
      >
        <div className="grid gap-7 lg:grid-cols-[1.4fr_1fr]">
          <Card className="flex flex-col gap-4 p-6">
            {TYPE_SCALE.map((t) => (
              <div key={t.label} className="flex items-baseline gap-4 border-b border-border pb-3">
                <span className="kicker w-16 shrink-0 text-muted-foreground">{t.label}</span>
                <span className={cn('font-display leading-tight', t.className)}>{t.sample}</span>
              </div>
            ))}
            <div className="flex items-baseline gap-4">
              <span className="kicker w-16 shrink-0 text-muted-foreground">Texto · 15</span>
              <p className="text-[15px] text-pretty">
                Barlow para ler rápido no celular e ainda ter densidade na mesa. Legendas em 12–13px
                com tinta suave; rótulos pequenos em caixa-alta espaçada.
              </p>
            </div>
          </Card>

          <Card className="p-6">
            <Specimen label="Algarismos tabulares">
              <div className="flex flex-col">
                {NUMBERS.map((cents) => (
                  <div
                    key={cents}
                    className="flex items-center justify-between border-b border-border py-2"
                  >
                    <span className="text-[13px] text-muted-foreground">Lançamento</span>
                    <Money cents={cents} alwaysVisible />
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-foreground pt-2.5">
                  <span className="text-[13px] font-medium">Total</span>
                  <Money cents={NUMBERS.reduce((a, b) => a + b, 0)} size="lg" alwaysVisible />
                </div>
              </div>
            </Specimen>
          </Card>
        </div>
      </ShowcaseSection>

      <ShowcaseSection
        id="forma"
        title="Forma & movimento"
        description="Cantos retos, linhas de 1px e marcas de registro “+” nos cantos: cartões, figuras e o botão primário são objetos de um desenho técnico. Sombra só no que flutua."
      >
        <div className="grid gap-7 md:grid-cols-3">
          <Card className="flex flex-col gap-2 p-5">
            <span className="kicker text-steel-700">Moldura</span>
            <h3 className="text-xl">.blueprint</h3>
            <p className="text-[13px] text-muted-foreground">
              Borda de 1px + quatro cruzes de 11px centradas nos cantos. Nunca arredondar, nunca
              preencher um cartão.
            </p>
          </Card>
          <div className="flex flex-col gap-2 bg-background p-5 shadow-raised">
            <span className="kicker text-steel-700">Elevação</span>
            <h3 className="text-xl">Só o que flutua</h3>
            <p className="text-[13px] text-muted-foreground">
              Diálogos, avisos e o botão + do celular. O resto fica no papel.
            </p>
          </div>
          <Card className="flex flex-col gap-2 p-5">
            <span className="kicker text-steel-700">Movimento</span>
            <h3 className="text-xl">Preciso, sem quique</h3>
            <p className="text-[13px] text-muted-foreground">
              120–180ms para cores; 220ms para diálogos (sobem 12px e aparecem); réguas crescem da
              esquerda. Com “reduzir movimento”, tudo para.
            </p>
            <div className="mt-2 h-1.5 border border-border">
              <div className="h-full w-2/3 origin-left animate-grow-x bg-steel" />
            </div>
          </Card>
        </div>
      </ShowcaseSection>
    </>
  )
}
