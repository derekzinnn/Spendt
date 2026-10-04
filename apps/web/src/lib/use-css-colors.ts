import { useEffect, useState } from 'react'

import { useTheme } from './theme'

/**
 * Resolves CSS custom properties (e.g. "--steel-700") to concrete colour strings for
 * libraries that need real values, like Recharts' SVG attributes. Re-reads whenever the
 * light/dark mode changes.
 */
export function useCssColors<const T extends readonly string[]>(
  names: T,
): Record<T[number], string> {
  const { resolvedMode } = useTheme()
  const key = names.join('|')
  const read = () => {
    const styles = getComputedStyle(document.documentElement)
    return Object.fromEntries(
      names.map((name) => [name, styles.getPropertyValue(name).trim()]),
    ) as Record<T[number], string>
  }
  const [colors, setColors] = useState(read)

  useEffect(() => {
    // The provider applies the theme in its own effect, which runs after ours (parents
    // commit after children) — wait a frame so we read the new values.
    const frame = requestAnimationFrame(() => setColors(read()))
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures `names`
  }, [resolvedMode, key])

  return colors
}
