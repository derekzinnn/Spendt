import { useNavigate } from 'react-router'

import { ROUTES } from '@/app/navigation'

import { AuthLayout } from './AuthLayout'
import { RegisterForm } from './RegisterForm'

export function RegisterPage() {
  const navigate = useNavigate()
  return (
    <AuthLayout
      tab="register"
      title="Criar a casa"
      subtitle="Você vira dona(o) da casa e convida a outra pessoa depois."
    >
      <RegisterForm onSuccess={() => navigate(ROUTES.dashboard, { replace: true })} />
    </AuthLayout>
  )
}
