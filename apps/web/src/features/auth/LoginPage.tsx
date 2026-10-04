import { zodResolver } from '@hookform/resolvers/zod'
import { loginSchema, type LoginInput } from '@spendly/shared'
import { useForm } from 'react-hook-form'
import { useNavigate, useSearchParams } from 'react-router'
import type { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { safeNextPath, showFormError } from '@/lib/form-errors'

import { useLogin } from './api'
import { AuthLayout } from './AuthLayout'
import { FormAlert, PasswordInput } from './PasswordInput'

export function LoginPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const login = useLogin()
  const form = useForm<z.input<typeof loginSchema>, unknown, LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit((values) =>
    login.mutate(values, {
      onSuccess: () => void navigate(safeNextPath(params.get('next')), { replace: true }),
      onError: (error) => showFormError(error, form.setError, { root: true }),
    }),
  )

  return (
    <AuthLayout tab="login" title="Bem-vindo de volta" subtitle="Entre para ver as contas da casa.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4.5" noValidate>
        <FormAlert message={errors.root?.server?.message} />
        <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoFocus
            aria-invalid={Boolean(errors.email)}
            {...form.register('email')}
          />
        </Field>
        <Field label="Senha" htmlFor="password" error={errors.password?.message}>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.password)}
            {...form.register('password')}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full" disabled={login.isPending}>
          {login.isPending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </AuthLayout>
  )
}
