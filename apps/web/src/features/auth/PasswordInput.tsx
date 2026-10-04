import { CircleAlert, Eye, EyeOff } from 'lucide-react'
import { useState, type ComponentProps } from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/cn'

/** Password field with a show/hide toggle (typing on a phone keyboard is error-prone). */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input type={visible ? 'text' : 'password'} className={cn('pr-11', className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Esconder senha' : 'Mostrar senha'}
        aria-pressed={visible}
        className="absolute top-1/2 right-0.5 grid size-8 -translate-y-1/2 cursor-pointer place-items-center text-muted-foreground transition-colors hover:bg-foreground/7 hover:text-foreground"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

/** Non-field error box for forms (wrong password, network…): ink frame + icon, never red. */
export function FormAlert({ message }: { message: string | undefined }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="flex animate-rise-in items-center gap-2 border border-foreground px-2.5 py-2 text-[13px]"
    >
      <CircleAlert className="size-3.5 shrink-0" />
      {message}
    </div>
  )
}
