import { Eye, EyeOff, Monitor, Moon, Sun } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/cn'
import { usePrivacy } from '@/lib/privacy'
import { useTheme, type ThemeMode } from '@/lib/theme'

const NEXT_MODE: Record<ThemeMode, ThemeMode> = { light: 'dark', dark: 'system', system: 'light' }
const MODE_LABEL: Record<ThemeMode, string> = {
  light: 'Tema claro',
  dark: 'Tema escuro',
  system: 'Tema do sistema',
}
const MODE_ICON = { light: Sun, dark: Moon, system: Monitor }

export function PrivacyToggle({ className }: { className?: string }) {
  const { hidden, toggle } = usePrivacy()
  const label = hidden ? 'Mostrar valores' : 'Ocultar valores'
  return (
    <Tooltip label={label}>
      <Button
        variant="quiet"
        size="icon"
        aria-label={label}
        aria-pressed={hidden}
        onClick={toggle}
        className={className}
      >
        {hidden ? <EyeOff /> : <Eye />}
      </Button>
    </Tooltip>
  )
}

export function ThemeModeToggle({ className }: { className?: string }) {
  const { mode, setMode } = useTheme()
  const Icon = MODE_ICON[mode]
  const label = `${MODE_LABEL[mode]} (trocar)`
  return (
    <Tooltip label={label}>
      <Button
        variant="quiet"
        size="icon"
        aria-label={label}
        onClick={() => setMode(NEXT_MODE[mode])}
        className={cn(className)}
      >
        <Icon />
      </Button>
    </Tooltip>
  )
}
