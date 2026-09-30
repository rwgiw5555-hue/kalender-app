import { createHash, timingSafeEqual } from 'crypto'

const MIN_TOKEN = 32

// Prüft den geheimen Schlüssel des Siri-Kurzbefehls (Header „Authorization: Bearer …“).
// Ohne SHORTCUT_TOKEN (mind. 32 Zeichen) in .env ist der Zugang abgeschaltet.
export function shortcutEnabled(): boolean {
  return (process.env.SHORTCUT_TOKEN ?? '').length >= MIN_TOKEN
}

export function checkShortcutToken(header: string | null): boolean {
  const expected = process.env.SHORTCUT_TOKEN ?? ''
  if (expected.length < MIN_TOKEN || !header?.startsWith('Bearer ')) return false
  // Über Hashes vergleichen: gleiche Länge, und die Laufzeit verrät nichts über den Schlüssel
  const a = createHash('sha256').update(header.slice(7)).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}
