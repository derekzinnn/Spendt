import { zodResolver } from '@hookform/resolvers/zod'
import {
  changePasswordSchema,
  createInviteSchema,
  householdNameSchema,
  updateMemberSchema,
  type CreatedInviteDto,
  type CreateInviteInput,
} from '@spendly/shared'
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Link2,
  LogOut,
  MessageCircle,
  Monitor,
  Moon,
  Palette,
  Send,
  Share2,
  Sun,
  X,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'

import { ROUTES } from '@/app/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { MemberAvatar } from '@/components/member/MemberAvatar'
import { ColorPicker } from '@/components/pickers/ColorPicker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, SwitchField } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/misc'
import { Segmented } from '@/components/ui/segmented'
import { useChangePassword, useHouseholdContext, useLogout } from '@/features/auth/api'
import {
  useCreateInvite,
  useInvites,
  useRevokeInvite,
  useUpdateHousehold,
  useUpdateMember,
} from '@/features/household/api'
import { APP_NAME } from '@/lib/brand'
import { showFormError } from '@/lib/form-errors'
import { usePrivacy } from '@/lib/privacy'
import { useTheme, type ThemeMode } from '@/lib/theme'

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: ReactNode
  children: ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="grid scroll-mt-24 gap-4 py-7 first:pt-0 lg:grid-cols-[16rem_1fr] lg:gap-10"
    >
      <div>
        <h2 id={`${id}-title`} className="text-xl">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm text-pretty text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <Card className="p-5 sm:p-6">{children}</Card>
    </section>
  )
}

// ───────────── Casa ─────────────

const householdFormSchema = z.object({
  name: householdNameSchema,
})

function HouseholdSection() {
  const { household, member } = useHouseholdContext()
  const update = useUpdateHousehold()
  const isOwner = member.role === 'OWNER'
  const form = useForm<z.infer<typeof householdFormSchema>>({
    resolver: zodResolver(householdFormSchema),
    values: { name: household.name },
  })
  const { errors, isDirty } = form.formState

  const onSubmit = form.handleSubmit((values) =>
    update.mutate(values, {
      onSuccess: () => toast.success('Casa atualizada'),
      onError: (error) => showFormError(error, form.setError),
    }),
  )

  return (
    <Section
      id="casa"
      title="Sua casa"
      description={
        isOwner
          ? 'Tudo aqui é do casal: contas, cartões e despesas são da casa.'
          : 'Só quem administra a casa pode mudar estes dados.'
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <Field label="Nome da casa" htmlFor="household-name" error={errors.name?.message}>
          <Input id="household-name" disabled={!isOwner} {...form.register('name')} />
        </Field>
        {isOwner ? (
          <div className="flex justify-end">
            <Button type="submit" disabled={!isDirty || update.isPending}>
              {update.isPending ? 'Salvando…' : 'Salvar'}
            </Button>
          </div>
        ) : null}
      </form>
    </Section>
  )
}

// ───────────── Pessoas ─────────────

const memberFormSchema = z.object({
  displayName: updateMemberSchema.shape.displayName.unwrap(),
  color: updateMemberSchema.shape.color.unwrap(),
})

function PeopleSection() {
  const { member, members } = useHouseholdContext()
  const update = useUpdateMember()
  const form = useForm<z.infer<typeof memberFormSchema>>({
    resolver: zodResolver(memberFormSchema),
    values: { displayName: member.displayName, color: member.color },
  })
  const { errors, isDirty } = form.formState
  const takenColors = members.filter((m) => !m.isMe).map((m) => m.color)

  const onSubmit = form.handleSubmit((values) =>
    update.mutate(values, {
      onSuccess: () => toast.success('Seu perfil na casa foi atualizado'),
      onError: (error) => showFormError(error, form.setError),
    }),
  )

  return (
    <Section
      id="pessoas"
      title="Pessoas"
      description="Nome e tom de cada um aparecem em “pago por” e nos lançamentos. Tudo é da casa — isso só diz quem pagou."
    >
      <ul className="mb-6 flex flex-col gap-3">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3">
            <MemberAvatar name={m.displayName} color={m.color} size="md" className="ring-0" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">
                {m.displayName}
                {m.isMe ? <span className="font-normal text-muted-foreground"> (você)</span> : null}
              </span>
            </span>
            <Badge tone={m.role === 'OWNER' ? 'primary' : 'neutral'}>
              {m.role === 'OWNER' ? 'Administra' : 'Membro'}
            </Badge>
          </li>
        ))}
      </ul>
      <form
        onSubmit={onSubmit}
        className="flex flex-col gap-5 border-t border-border pt-5"
        noValidate
      >
        <Field label="Como você aparece" htmlFor="display-name" error={errors.displayName?.message}>
          <Input id="display-name" {...form.register('displayName')} />
        </Field>
        <Field
          label="Seu tom"
          error={errors.color?.message}
          hint="Tons já usados por outra pessoa ficam apagados."
        >
          <Controller
            control={form.control}
            name="color"
            render={({ field }) => (
              <ColorPicker
                value={field.value}
                onChange={field.onChange}
                disabledKeys={takenColors}
                label="Seu tom"
              />
            )}
          />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={!isDirty || update.isPending}>
            {update.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </div>
      </form>
    </Section>
  )
}

// ───────────── Convite ─────────────

function InviteLink({ invite, onDismiss }: { invite: CreatedInviteDto; onDismiss: () => void }) {
  const [copied, setCopied] = useState(false)
  const message = `Bora organizar as contas da casa juntos? Entra por aqui: ${invite.url}`
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invite.url)
      setCopied(true)
      toast.success('Link copiado')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Não deu para copiar. Selecione o link e copie manualmente.')
    }
  }

  return (
    <div className="animate-rise-in border border-steel bg-steel-100 p-4 text-steel-800">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="text-sm">
          Link para <strong className="font-medium">{invite.email}</strong>
        </p>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Fechar"
          onClick={onDismiss}
          className="-mt-1 -mr-1"
        >
          <X />
        </Button>
      </div>
      <div className="flex gap-2">
        <Input
          readOnly
          value={invite.url}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Link do convite"
          className="bg-background font-mono text-xs"
        />
        <Button variant="secondary" onClick={() => void copy()} aria-label="Copiar link">
          {copied ? <Check /> : <Copy />}
          <span className="hidden sm:inline">{copied ? 'Copiado' : 'Copiar'}</span>
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild variant="secondary" size="sm">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noreferrer"
          >
            <MessageCircle /> Enviar no WhatsApp
          </a>
        </Button>
        {canShare ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              void navigator
                .share({ title: `Convite ${APP_NAME}`, text: message })
                .catch(() => undefined)
            }
          >
            <Share2 /> Compartilhar
          </Button>
        ) : null}
      </div>
      <p className="mt-3 text-xs">
        Por segurança este link aparece só agora e vale por 7 dias. Perdeu? Gere outro — o anterior
        deixa de funcionar.
      </p>
    </div>
  )
}

function InviteSection() {
  const { members } = useHouseholdContext()
  const invites = useInvites()
  const create = useCreateInvite()
  const revoke = useRevokeInvite()
  const [created, setCreated] = useState<CreatedInviteDto | null>(null)
  const form = useForm<z.input<typeof createInviteSchema>, unknown, CreateInviteInput>({
    resolver: zodResolver(createInviteSchema),
    defaultValues: { email: '' },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit(({ email }) =>
    create.mutate(email, {
      onSuccess: (invite) => {
        setCreated(invite)
        form.reset()
      },
      onError: (error) => showFormError(error, form.setError),
    }),
  )

  const pending = (invites.data ?? []).filter((i) => i.id !== created?.id)

  return (
    <Section
      id="convite"
      title={members.length < 2 ? 'Convide seu par' : 'Convites'}
      description="Gere um link e mande pelo WhatsApp. Quem entrar por ele passa a ver e lançar tudo da casa."
    >
      <div className="flex flex-col gap-5">
        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-2 sm:flex-row sm:items-start"
          noValidate
        >
          <Field
            label="E-mail de quem você quer chamar"
            htmlFor="invite-email"
            error={errors.email?.message}
            className="flex-1"
          >
            <Input
              id="invite-email"
              type="email"
              inputMode="email"
              placeholder="nome@exemplo.com"
              {...form.register('email')}
            />
          </Field>
          <Button type="submit" className="sm:mt-[26px]" disabled={create.isPending}>
            <Send /> {create.isPending ? 'Gerando…' : 'Gerar convite'}
          </Button>
        </form>

        {created ? <InviteLink invite={created} onDismiss={() => setCreated(null)} /> : null}

        {pending.length > 0 ? (
          <div>
            <p className="kicker mb-2 text-muted-foreground">Aguardando resposta</p>
            <ul className="flex flex-col divide-y divide-border border border-border">
              {pending.map((invite) => (
                <li key={invite.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Link2 className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{invite.email}</span>
                    <span className="block text-xs text-muted-foreground">
                      Expira em {new Date(invite.expiresAt).toLocaleDateString('pt-BR')}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={revoke.isPending}
                    onClick={() =>
                      revoke.mutate(invite.id, {
                        onSuccess: () => toast.success('Convite cancelado'),
                        onError: (e) => toast.error(e.message),
                      })
                    }
                  >
                    Cancelar
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Section>
  )
}

// ───────────── Aparência & conta ─────────────

function AppearanceSection() {
  const { mode, setMode } = useTheme()
  const { hidden, toggle } = usePrivacy()
  return (
    <Section id="aparencia" title="Aparência" description="Preferências deste aparelho.">
      <div className="flex flex-col gap-5">
        <Field label="Tema">
          <Segmented<ThemeMode>
            aria-label="Tema"
            className="self-start"
            value={mode}
            onValueChange={setMode}
            options={[
              {
                value: 'light',
                label: (
                  <>
                    <Sun /> Claro
                  </>
                ),
              },
              {
                value: 'dark',
                label: (
                  <>
                    <Moon /> Escuro
                  </>
                ),
              },
              {
                value: 'system',
                label: (
                  <>
                    <Monitor /> Sistema
                  </>
                ),
              },
            ]}
          />
        </Field>
        <SwitchField
          checked={hidden}
          onCheckedChange={toggle}
          side="end"
          className="border border-border px-4 py-3"
          description="Esconde os valores na tela — bom para usar em público."
        >
          <span className="flex items-center gap-3">
            {hidden ? (
              <EyeOff aria-hidden className="size-5 text-muted-foreground" />
            ) : (
              <Eye aria-hidden className="size-5 text-muted-foreground" />
            )}
            Ocultar valores
          </span>
        </SwitchField>
        <Link
          to={ROUTES.design}
          className="flex items-center gap-2 self-start text-sm text-steel-700 hover:underline"
        >
          <Palette className="size-4" /> Ver o sistema de design
        </Link>
      </div>
    </Section>
  )
}

const passwordFormSchema = z.object({
  currentPassword: changePasswordSchema.shape.currentPassword,
  password: changePasswordSchema.shape.password,
})

function AccountSection() {
  const { user } = useHouseholdContext()
  const logout = useLogout()
  const change = useChangePassword()
  const form = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { currentPassword: '', password: '' },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit((values) =>
    change.mutate(values, {
      onSuccess: () => {
        form.reset()
        toast.success('Senha alterada', {
          description: 'Outros aparelhos vão precisar entrar de novo.',
        })
      },
      onError: (error) => showFormError(error, form.setError),
    }),
  )

  return (
    <Section
      id="conta"
      title="Sua conta"
      description="Seu acesso. O nome que aparece para a casa fica em “Pessoas”."
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="truncate font-medium">{user.name}</p>
          <p className="truncate text-sm text-muted-foreground">{user.email}</p>
        </div>
        <Button variant="secondary" onClick={() => logout.mutate()} disabled={logout.isPending}>
          <LogOut /> Sair
        </Button>
      </div>

      <Separator className="my-6" />

      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <h3 className="text-[15px] font-medium">Trocar a senha</h3>
        <Field
          label="Senha atual"
          htmlFor="current-password"
          error={errors.currentPassword?.message}
        >
          <Input
            id="current-password"
            type="password"
            autoComplete="current-password"
            {...form.register('currentPassword')}
          />
        </Field>
        <Field
          label="Nova senha"
          htmlFor="new-password"
          error={errors.password?.message}
          hint="Pelo menos 8 caracteres."
        >
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            {...form.register('password')}
          />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" disabled={change.isPending}>
            {change.isPending ? 'Salvando…' : 'Trocar a senha'}
          </Button>
        </div>
      </form>
    </Section>
  )
}

export function SettingsPage() {
  const { member } = useHouseholdContext()
  return (
    <>
      <PageHeader description="A casa, as pessoas e as preferências deste aparelho." />
      <div className="divide-y divide-border">
        <HouseholdSection />
        <PeopleSection />
        {member.role === 'OWNER' ? <InviteSection /> : null}
        <AppearanceSection />
        <AccountSection />
      </div>
    </>
  )
}
