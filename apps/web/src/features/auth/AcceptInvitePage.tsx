import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type InvitePreviewDto, type LoginInput, type MeDto } from '@spendly/shared'
import { useQuery } from '@tanstack/react-query'
import { HeartHandshake, LinkIcon } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'
import type { z } from 'zod'

import { ROUTES } from '@/app/navigation'
import { EmptyState } from '@/components/empty-state/EmptyState'
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/misc'
import { useAcceptInvite, useInvitePreview } from '@/features/household/api'
import { APP_NAME } from '@/lib/brand'
import { showFormError } from '@/lib/form-errors'

import { meQueryOptions, useLogin, useLogout } from './api'
import { AuthLayout } from './AuthLayout'
import { FormAlert, PasswordInput } from './PasswordInput'
import { RegisterForm } from './RegisterForm'

function InviteCard({ preview }: { preview: InvitePreviewDto }) {
  return (
    <div className="flex items-center gap-3 bg-steel-100 p-3.5 text-steel-800">
      <HeartHandshake className="size-6 shrink-0 text-steel" />
      <p className="text-sm text-pretty">
        <strong>{preview.invitedByName}</strong> te chamou para dividir a casa{' '}
        <strong>“{preview.householdName}”</strong>.
      </p>
    </div>
  )
}

function LoginAndAccept({
  preview,
  onJoined,
}: {
  preview: InvitePreviewDto
  onJoined: (me: MeDto) => void
}) {
  const { token = '' } = useParams()
  const login = useLogin()
  const accept = useAcceptInvite(token)
  const form = useForm<z.input<typeof loginSchema>, unknown, LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: preview.email, password: '' },
  })
  const { errors } = form.formState
  const pending = login.isPending || accept.isPending

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values)
      onJoined(await accept.mutateAsync())
    } catch (error) {
      showFormError(error, form.setError, { root: true })
    }
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <FormAlert message={errors.root?.server?.message} />
      <Field label="E-mail" htmlFor="email">
        <Input
          id="email"
          readOnly
          className="bg-surface-sunken text-muted-foreground"
          {...form.register('email')}
        />
      </Field>
      <Field label="Senha" htmlFor="password" error={errors.password?.message}>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          autoFocus
          {...form.register('password')}
        />
      </Field>
      <Button type="submit" size="lg" className="mt-2 w-full" disabled={pending}>
        {pending ? 'Entrando…' : 'Entrar e aceitar'}
      </Button>
    </form>
  )
}

/** /convite/:token — works for: new people, people with an account, people already logged in. */
export function AcceptInvitePage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const preview = useInvitePreview(token)
  const { data: me } = useQuery(meQueryOptions)
  const accept = useAcceptInvite(token)
  const logout = useLogout()

  const onJoined = (joined: MeDto) => {
    toast.success(`Boas-vindas! Agora você faz parte de “${joined.household?.name ?? 'casa'}”.`)
    void navigate(ROUTES.dashboard, { replace: true })
  }

  if (preview.isPending) {
    return (
      <AuthLayout title="Abrindo o convite…">
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </AuthLayout>
    )
  }

  if (preview.isError) {
    return (
      <AuthLayout title="Convite indisponível">
        <EmptyState
          size="sm"
          icon={LinkIcon}
          title={preview.error.message}
          description="Peça para quem te convidou gerar um novo link em Configurações."
          action={
            <Button asChild variant="secondary">
              <Link to={ROUTES.login}>Ir para o login</Link>
            </Button>
          }
        />
      </AuthLayout>
    )
  }

  const invite = preview.data

  if (me && me.user.email === invite.email) {
    return (
      <AuthLayout
        title={`Entrar em “${invite.householdName}”`}
        subtitle="Você já entrou com o e-mail do convite."
      >
        <InviteCard preview={invite} />
        <Button
          size="lg"
          className="w-full"
          disabled={accept.isPending}
          onClick={() =>
            accept.mutate(undefined, {
              onSuccess: onJoined,
              onError: (e) => toast.error(e.message),
            })
          }
        >
          {accept.isPending ? 'Entrando…' : 'Aceitar convite'}
        </Button>
      </AuthLayout>
    )
  }

  if (me) {
    return (
      <AuthLayout
        title="Convite para outra conta"
        subtitle={`Este convite foi enviado para ${invite.email}.`}
      >
        <InviteCard preview={invite} />
        <p className="text-sm text-muted-foreground">
          Você está usando <strong className="text-foreground">{me.user.email}</strong>. Saia para
          entrar ou criar a conta certa.
        </p>
        <Button size="lg" variant="secondary" className="w-full" onClick={() => logout.mutate()}>
          Sair e continuar
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={invite.hasAccount ? 'Entre para aceitar' : 'Crie sua conta'}
      subtitle={
        invite.hasAccount ? `Você já tem conta no ${APP_NAME}.` : 'Leva menos de um minuto.'
      }
    >
      <InviteCard preview={invite} />
      {invite.hasAccount ? (
        <LoginAndAccept preview={invite} onJoined={onJoined} />
      ) : (
        <RegisterForm
          invite={{ token, email: invite.email }}
          submitLabel="Criar conta e entrar"
          onSuccess={onJoined}
        />
      )}
    </AuthLayout>
  )
}
