import { useQuery } from '@tanstack/react-query'
import { Monitor, Moon, Smartphone, Sun } from 'lucide-react'

import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Segmented } from '@/components/ui/segmented'
import { QuickAddForm } from '@/features/quick-add/QuickAddForm'
import { useQuickAdd } from '@/features/quick-add/QuickAddProvider'
import { apiFetch } from '@/lib/api'
import { useTheme, type ThemeMode } from '@/lib/theme'

import { ShowcaseSection } from './ShowcaseSection'
import { CategoriesSection } from './sections/CategoriesSection'
import { ChartsSection } from './sections/ChartsSection'
import { ComponentsSection } from './sections/ComponentsSection'
import { FoundationsSection } from './sections/FoundationsSection'
import { MoneySection } from './sections/MoneySection'
import { PatternsSection } from './sections/PatternsSection'

const SECTIONS = [
  { id: 'direcoes', label: 'Direções' },
  { id: 'cores', label: 'Cores' },
  { id: 'tipografia', label: 'Tipografia' },
  { id: 'forma', label: 'Forma & movimento' },
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'categorias', label: 'Categorias' },
  { id: 'componentes', label: 'Componentes' },
  { id: 'padroes', label: 'Padrões' },
  { id: 'graficos', label: 'Gráficos' },
  { id: 'lancamento-rapido', label: 'Lançamento rápido' },
]

interface Health {
  status: 'ok' | 'degraded'
  database: 'up' | 'down'
}

function ApiStatus() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['health'],
    queryFn: () => apiFetch<Health>('/health'),
    retry: false,
    refetchInterval: 30_000,
  })
  if (isPending) return <Badge tone="neutral">Verificando API…</Badge>
  if (isError) return <Badge tone="negative">API offline</Badge>
  return data.database === 'up' ? (
    <Badge tone="primary">API e banco no ar</Badge>
  ) : (
    <Badge tone="warning">API no ar · banco fora</Badge>
  )
}

export function DesignShowcasePage() {
  const { mode, setMode } = useTheme()
  const { setOpen } = useQuickAdd()

  return (
    <>
      <PageHeader
        description={
          <span className="flex flex-col gap-2">
            <span>
              Casa sobre o sistema Industry: um desenho técnico em aço sobre papel. Troque o modo
              para ver a direção B — Aço noturno.
            </span>
            <span className="flex flex-wrap items-center gap-2">
              <Badge tone="outline">Fase 0 · Fundação</Badge>
              <ApiStatus />
            </span>
          </span>
        }
        actions={
          <Segmented<ThemeMode>
            aria-label="Modo de cor"
            value={mode}
            onValueChange={setMode}
            options={[
              { value: 'light', label: <Sun />, ariaLabel: 'Planta (claro)' },
              { value: 'dark', label: <Moon />, ariaLabel: 'Aço noturno (escuro)' },
              { value: 'system', label: <Monitor />, ariaLabel: 'Seguir o sistema' },
            ]}
          />
        }
      />

      <nav aria-label="Seções do sistema de design" className="-my-3 border-y border-border">
        <ul className="flex scrollbar-none overflow-x-auto">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="inline-flex h-10 items-center px-3 text-[13px] whitespace-nowrap text-muted-foreground transition-colors hover:bg-foreground/6 hover:text-foreground"
              >
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <FoundationsSection />
      <MoneySection />
      <CategoriesSection />
      <ComponentsSection />
      <PatternsSection />
      <ChartsSection />

      <ShowcaseSection
        id="lancamento-rapido"
        title="Lançamento rápido"
        description="Cinco segundos: valor primeiro, depois categoria, conta e quem pagou. Se a categoria não existe, “Criar” aparece ali mesmo — nunca sair do fluxo. Abre pelo quadrado + no celular, pelo cabeçalho ou com Ctrl/⌘+K."
      >
        <div className="grid items-start gap-7 lg:grid-cols-[480px_1fr]">
          <Card className="p-4">
            <QuickAddForm autoFocus={false} />
          </Card>

          <Card className="flex flex-col gap-4 p-6">
            <h3 className="text-xl">Por que assim</h3>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-[15px] text-pretty text-muted-foreground marker:text-steel">
              <li>
                <strong className="font-medium text-foreground">Valor primeiro</strong>, em 48px,
                com teclado numérico e preenchimento da direita: “4590” vira R$ 45,90.
              </li>
              <li>
                <strong className="font-medium text-foreground">Categoria por busca</strong> — as
                fichas filtram enquanto digita; Enter escolhe a única ou cria a nova.
              </li>
              <li>
                <strong className="font-medium text-foreground">Tudo é da casa.</strong> “Pago por”
                só registra quem pagou; não existe “minha” ou “sua” despesa.
              </li>
              <li>
                <strong className="font-medium text-foreground">Salvar</strong> só acende quando
                está completo, e a dica ao lado diz o que falta. Enter salva, Esc fecha.
              </li>
            </ul>
            <div className="pt-2">
              <Button onClick={() => setOpen(true)}>
                <Smartphone /> Abrir como no app
              </Button>
            </div>
          </Card>
        </div>
      </ShowcaseSection>
    </>
  )
}
