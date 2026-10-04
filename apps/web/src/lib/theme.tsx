import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import { readStorage, writeStorage } from './storage'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemePreferences {
  mode: ThemeMode
}

interface ThemeContextValue extends ThemePreferences {
  /** The mode actually on screen ("system" resolved). */
  resolvedMode: 'light' | 'dark'
  setMode: (mode: ThemeMode) => void
}

// Keep in sync with the inline script in index.html.
const STORAGE_KEY = 'spendly.theme'
const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

function readMode(): ThemeMode {
  const saved = readStorage<Partial<ThemePreferences>>(STORAGE_KEY, {}).mode
  return saved === 'light' || saved === 'dark' ? saved : 'system'
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(readMode)
  const [systemDark, setSystemDark] = useState(() => darkQuery().matches)

  useEffect(() => {
    const query = darkQuery()
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const resolvedMode = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolvedMode === 'dark')
    const background = getComputedStyle(root).getPropertyValue('--background').trim()
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background)
    writeStorage(STORAGE_KEY, { mode })
  }, [mode, resolvedMode])

  const changeMode = useCallback((next: ThemeMode) => setMode(next), [])

  const value = useMemo(
    () => ({ mode, resolvedMode, setMode: changeMode }),
    [mode, resolvedMode, changeMode],
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}

export function useTheme() {
  const context = use(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>')
  return context
}
