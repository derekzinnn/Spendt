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

/**
 * "Ocultar valores": masks every amount on screen, for checking the app on the bus.
 * Per-device preference, read by <Money />.
 */
interface PrivacyContextValue {
  hidden: boolean
  toggle: () => void
}

const STORAGE_KEY = 'spendly.hideValues'
const PrivacyContext = createContext<PrivacyContextValue>({ hidden: false, toggle: () => {} })

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [hidden, setHidden] = useState(() => readStorage(STORAGE_KEY, false))

  useEffect(() => writeStorage(STORAGE_KEY, hidden), [hidden])

  const toggle = useCallback(() => setHidden((current) => !current), [])
  const value = useMemo(() => ({ hidden, toggle }), [hidden, toggle])

  return <PrivacyContext value={value}>{children}</PrivacyContext>
}

export function usePrivacy() {
  return use(PrivacyContext)
}
