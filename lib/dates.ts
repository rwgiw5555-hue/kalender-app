// Kalenderdaten als Text (YYYY-MM-DD) in deutscher Zeit. Damit rechnen
// Server und Browser mit denselben Tagen, egal in welcher Zeitzone sie laufen.

export const TIME_ZONE = 'Europe/Berlin'

export function localDate(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(d)
}

export function isDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const t = Date.parse(value + 'T00:00:00Z')
  if (Number.isNaN(t) || t < Date.UTC(1970, 0, 1) || t > Date.UTC(2100, 0, 1)) return false
  // Unmögliche Daten wie 2026-11-31 nicht still auf den Folgetag schieben
  return new Date(t).toISOString().slice(0, 10) === value
}

// Tage seit 1970-01-01 für ein YYYY-MM-DD
export function dayNumber(date: string): number {
  return Math.floor(Date.parse(date + 'T00:00:00Z') / 86400000)
}

export function addDays(date: string, days: number): string {
  return new Date((dayNumber(date) + days) * 86400000).toISOString().slice(0, 10)
}
