import {
  CalendarCheck2,
  CircleAlert,
  CircleCheck,
  Clock3,
  CreditCard,
  EllipsisVertical,
  Pencil,
  Plus,
  Receipt,
  SearchX,
  Trash2,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/empty-state/EmptyState'
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
import { ChoiceChips, Field, NativeSelect, SwitchField } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Kbd, Skeleton } from '@/components/ui/misc'
import { Segmented } from '@/components/ui/segmented'
import { Tooltip } from '@/components/ui/tooltip'
import { undoToast } from '@/lib/undo-toast'

import { ShowcaseSection, Specimen } from '../ShowcaseSection'

export function ComponentsSection() {
  const [kind, setKind] = useState<'all' | 'exp' | 'inc' | 'pend'>('all')
  const [source, setSource] = useState('nubank')
  const [auto, setAuto] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <ShowcaseSection
      id="componentes"
      title="Componentes"
      description="Radix por baixo (teclado e leitor de tela de graça), desenho técnico por cima: quadrados, linha de 1px, foco em aço de 2px."
    >
      <div className="grid gap-7 lg:grid-cols-2">
        <Card className="flex flex-col gap-6 p-6">
          <Specimen label="Botões — o primário é o único objeto sólido">
            <div className="flex flex-wrap items-center gap-3">
              <Button>
                <Plus /> Lançamento
              </Button>
              <Button variant="secondary">Secundário</Button>
              <Button variant="ghost">Fantasma</Button>
              <Button variant="soft">Suave</Button>
              <Button variant="destructive">
                <Trash2 /> Excluir de vez
              </Button>
              <Button variant="link">Link</Button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="sm">Pequeno</Button>
              <Button size="lg">Grande · 44px</Button>
              <Tooltip label="Mais ações">
                <Button size="icon" variant="quiet" aria-label="Mais ações">
                  <EllipsisVertical />
                </Button>
              </Tooltip>
              <Button disabled>Desabilitado</Button>
            </div>
          </Specimen>
          <Specimen label="Etiquetas — sempre com palavra (e ícone quando é status)">
            <div className="flex flex-wrap gap-2">
              <Badge tone="primary">
                <CircleCheck /> Paga
              </Badge>
              <Badge tone="neutral">
                <Clock3 /> Pendente
              </Badge>
              <Badge tone="warning">Vence amanhã</Badge>
              <Badge tone="negative">
                <CircleAlert /> Atrasada
              </Badge>
              <Badge tone="outline">
                <CreditCard /> Aberta
              </Badge>
              <Badge tone="primary">92% · estourando</Badge>
            </div>
          </Specimen>
          <Specimen label="Atalhos">
            <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
              Lançamento rápido em qualquer tela: <Kbd>Ctrl</Kbd>
              <Kbd>K</Kbd> ou <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </p>
          </Specimen>
        </Card>

        <Card className="flex flex-col gap-6 p-6">
          <Specimen label="Campos">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Descrição" htmlFor="desc-demo">
                <Input id="desc-demo" placeholder="Ex.: Feira de sábado" />
              </Field>
              <Field label="Conta" htmlFor="select-demo">
                <NativeSelect id="select-demo" defaultValue="itau">
                  <option value="itau">Itaú · conjunta</option>
                  <option value="nubank">Nubank</option>
                </NativeSelect>
              </Field>
              <Field
                label="Com erro"
                htmlFor="err-demo"
                error="Não encontramos esse cartão. Quer criar “Cartão Nubak”?"
                className="sm:col-span-2"
              >
                <Input id="err-demo" aria-invalid defaultValue="Cartão Nubak" />
              </Field>
            </div>
          </Specimen>
          <Specimen label="Escolhas">
            <Segmented
              aria-label="Filtro de tipo"
              value={kind}
              onValueChange={setKind}
              options={[
                { value: 'all', label: 'Todos' },
                { value: 'exp', label: 'Despesas' },
                { value: 'inc', label: 'Receitas' },
                { value: 'pend', label: 'Pendentes' },
              ]}
            />
            <ChoiceChips
              name="Conta / cartão"
              value={source}
              onChange={setSource}
              options={[
                { value: 'nubank', label: 'Nubank' },
                { value: 'inter', label: 'Inter' },
                { value: 'itau', label: 'Itaú' },
                { value: 'vr', label: 'VR' },
              ]}
            />
            <SwitchField checked={auto} onCheckedChange={setAuto}>
              Confirmar recorrências sozinho
            </SwitchField>
          </Specimen>
        </Card>

        <Card className="flex flex-col gap-6 p-6">
          <Specimen label="Avisos — campo escuro, 6 s, “Desfazer” em toda exclusão">
            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                onClick={() =>
                  undoToast('“Padaria” excluído', {
                    onUndo: () => toast('Lançamento restaurado'),
                  })
                }
              >
                <Trash2 /> Excluir com desfazer
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  toast.success('Fatura paga', { description: 'Nubank · vence 05/11' })
                }
              >
                Sucesso
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  toast.error('Não foi possível salvar', {
                    description: 'Sem conexão. Tentaremos de novo.',
                  })
                }
              >
                Erro
              </Button>
            </div>
          </Specimen>
          <Specimen label="Menu e confirmação (só para o que não volta)">
            <div className="flex flex-wrap items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary">
                    Ações <EllipsisVertical />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem>
                    <Pencil /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem tone="danger" onSelect={() => setConfirmOpen(true)}>
                    <Trash2 /> Excluir de vez
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title="Excluir “Viagem 2025”?"
                description="Só dá para excluir categorias nunca usadas. Isso não pode ser desfeito."
                confirmLabel="Excluir de vez"
                onConfirm={() => setConfirmOpen(false)}
              />
            </div>
          </Specimen>
        </Card>

        <Card className="p-6">
          <Specimen label="Esqueleto — o formato do conteúdo, nunca um spinner">
            <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center gap-3">
                  <Skeleton className="size-9" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-3.5 w-2/5" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </Specimen>
        </Card>
      </div>

      <div className="mt-7 grid gap-7 md:grid-cols-3">
        <Card>
          <EmptyState
            size="sm"
            icon={Receipt}
            title="Nenhum gasto em out"
            description="Comece pelo que saiu hoje — leva 5 segundos."
            action={<Button variant="secondary">Lançar o primeiro</Button>}
          />
        </Card>
        <Card>
          <EmptyState
            size="sm"
            icon={CalendarCheck2}
            title="Nada vencendo em 7 dias"
            description="Contas e faturas aparecem aqui sozinhas."
          />
        </Card>
        <Card>
          <EmptyState
            size="sm"
            icon={SearchX}
            title="Nada por aqui com esses filtros"
            description="Limpe os filtros ou use a barra acima para lançar."
            action={<Button variant="secondary">Limpar filtros</Button>}
          />
        </Card>
      </div>
    </ShowcaseSection>
  )
}
