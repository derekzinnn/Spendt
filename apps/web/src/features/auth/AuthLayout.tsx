import { Mail } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { NavLink } from 'react-router'

import { ROUTES } from '@/app/navigation'
import { BrandMark } from '@/components/layout/BrandMark'
import { APP_NAME } from '@/lib/brand'
import { cn } from '@/lib/cn'

const PROMISES = [
  { value: '5 s', label: 'para lançar um gasto' },
  { value: 'Fatura certa', label: 'pela data de fechamento' },
  { value: 'Tudo a dois', label: 'uma casa, um caixa' },
]

interface AuthLayoutProps {
  title: string
  subtitle?: ReactNode
  /** Shows the "Entrar | Criar conta" switch on top of the form. */
  tab?: 'login' | 'register'
  children: ReactNode
}

const tabClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'grid min-h-(--control-h) place-items-center text-sm transition-colors duration-150 focus-visible:outline-offset-[-2px]',
    isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-foreground/7',
  )

/**
 * The deep steel panel (the one dark field of the system) beside a framed form. On phones
 * the panel shrinks to the brand and the headline, so the form stays within reach.
 */
export function AuthLayout({ title, subtitle, tab, children }: AuthLayoutProps) {
  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`
  }, [title])

  return (
    <div className="grid min-h-dvh grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))]">
      <aside className="flex flex-col justify-between gap-8 bg-emphasis p-6 text-emphasis-foreground sm:gap-12 sm:p-10">
        <BrandMark inverted className="[&_span]:text-2xl" />

        <div className="flex max-w-115 flex-col gap-4">
          <p className="font-display text-[2.5rem] leading-none sm:text-[3.5rem]">
            O Excel da nossa vida, a dois.
          </p>
          <p className="hidden text-base text-emphasis-muted sm:block">
            Gastos, cartões, faturas e contas da casa num só lugar, com o painel mostrando para onde
            o dinheiro vai.
          </p>
        </div>

        <dl className="hidden grid-cols-3 border-t border-emphasis-foreground/20 sm:grid">
          {PROMISES.map((item, index) => (
            <div
              key={item.value}
              className={cn(
                'flex flex-col-reverse pt-4',
                index === 0 ? 'pr-3' : 'border-l border-emphasis-foreground/20 px-3',
              )}
            >
              <dt className="text-[13px] text-emphasis-muted">{item.label}</dt>
              <dd className="font-display text-[1.75rem] leading-tight">{item.value}</dd>
            </div>
          ))}
        </dl>
      </aside>

      <main className="grid place-items-center px-6 py-10">
        <div className="blueprint flex w-full max-w-100 animate-rise-in flex-col gap-4.5 border border-border p-6 sm:p-8">
          {tab ? (
            <nav aria-label="Acesso" className="grid grid-cols-2 border border-border">
              <NavLink to={ROUTES.login} className={tabClass}>
                Entrar
              </NavLink>
              <NavLink
                to={ROUTES.register}
                className={(state) => cn(tabClass(state), 'border-l border-border')}
              >
                Criar conta
              </NavLink>
            </nav>
          ) : null}

          <div>
            <h1 className="text-[2rem]">{title}</h1>
            {subtitle ? (
              <p className="mt-1 text-sm text-pretty text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>

          {children}

          {tab ? (
            <p className="flex items-center gap-2 border-t border-border pt-4 text-[13px] text-muted-foreground">
              <Mail className="size-4 shrink-0" />
              Recebeu um convite? Abra o link que te mandaram para entrar na casa.
            </p>
          ) : null}
        </div>
      </main>
    </div>
  )
}
