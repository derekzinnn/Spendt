import { useCallback, useSyncExternalStore } from 'react'

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const list = window.matchMedia(query)
      list.addEventListener('change', notify)
      return () => list.removeEventListener('change', notify)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}

/** The `desk` breakpoint (900px): sidebar + header actions instead of the bottom nav. */
export const useIsDesktop = () => useMediaQuery('(min-width: 900px)')
