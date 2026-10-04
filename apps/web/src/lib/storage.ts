/**
 * localStorage that never throws (private mode, blocked storage, SSR-like contexts).
 * Only for per-device conveniences — never for data that must persist.
 */
export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writeStorage(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore: preferences are best-effort
  }
}
