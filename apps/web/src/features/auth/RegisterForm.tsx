import { zodResolver } from '@hookform/resolvers/zod'
import { registerSchema, type MeDto, type RegisterInput } from '@spendly/shared'
import { useForm, useWatch } from 'react-hook-form'
import type { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { showFormError } from '@/lib/form-errors'

import { useRegister } from './api'
import { FormAlert, PasswordInput } from './PasswordInput'

interface RegisterFormProps {
  onSuccess: (me: MeDto) => void
  /** Joining through an invite: e-mail is fixed and no household is created. */
  invite?: { token: string; email: string }
  submitLabel?: string
}

/** Shared by the sign-up page and the accept-invite page. */
export function RegisterForm({
  onSuccess,
  invite,
  submitLabel = 'Criar conta',
}: RegisterFormProps) {
  const register = useRegister()
  const form = useForm<z.input<typeof registerSchema>, unknown, RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: invite?.email ?? '',
      password: '',
      ...(invite ? { inviteToken: invite.token } : {}),
    },
  })
  const { errors } = form.formState
  const name = useWatch({ control: form.control, name: 'name' })
  const firstName = name.trim().split(/\s+/)[0]

  const onSubmit = form.handleSubmit((values) => {
    const input = invite ? { ...values, inviteToken: invite.token } : values
    register.mutate(input, {
      onSuccess,
      onError: (error) => showFormError(error, form.setError, { root: true }),
    })
  })

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4.5" noValidate>
      <FormAlert message={errors.root?.server?.message} />
      <Field label="Seu nome" htmlFor="name" error={errors.name?.message}>
        <Input
          id="name"
          autoComplete="name"
          autoFocus
          aria-invalid={Boolean(errors.name)}
          {...form.register('name')}
        />
      </Field>
      <Field
        label="E-mail"
        htmlFor="email"
        error={errors.email?.message}
        hint={invite ? 'O convite foi enviado para este e-mail.' : undefined}
      >
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          readOnly={Boolean(invite)}
          className={invite ? 'bg-surface-sunken text-muted-foreground' : undefined}
          aria-invalid={Boolean(errors.email)}
          {...form.register('email')}
        />
      </Field>
      <Field
        label="Senha"
        htmlFor="password"
        error={errors.password?.message}
        hint="Pelo menos 8 caracteres."
      >
        <PasswordInput
          id="password"
          autoComplete="new-password"
          aria-invalid={Boolean(errors.password)}
          {...form.register('password')}
        />
      </Field>
      {invite ? null : (
        <Field
          label="Nome da casa"
          htmlFor="householdName"
          error={errors.householdName?.message}
          hint="Opcional — dá para mudar depois."
        >
          <Input
            id="householdName"
            placeholder={firstName ? `Casa de ${firstName}` : 'Nossa casa'}
            aria-invalid={Boolean(errors.householdName)}
            {...form.register('householdName', {
              // An empty optional field means "use the default name", not "".
              setValueAs: (value: string) => (value.trim() === '' ? undefined : value),
            })}
          />
        </Field>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={register.isPending}>
        {register.isPending ? 'Criando…' : submitLabel}
      </Button>
    </form>
  )
}
