// Wiederholungsregeln für Routinen. Gespeichert als JSON-Text im Feld Event.rrule,
// angezeigt über @fullcalendar/rrule. Wird von Client und Server genutzt.

export const FREQS = ['daily', 'weekly', 'monthly', 'yearly'] as const
export const WEEKDAYS = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'] as const

export type Freq = (typeof FREQS)[number]
export type Weekday = (typeof WEEKDAYS)[number]

export interface Recurrence {
  freq: Freq
  interval?: number
  byweekday?: Weekday[]
  until?: string // YYYY-MM-DD, letzter Tag der Serie (inklusive)
}

type ParseResult = { ok: true; value: Recurrence | null } | { ok: false }

// Akzeptiert null/undefined (keine Wiederholung), ein Objekt oder JSON-Text
// und gibt eine bereinigte Regel zurück.
export function parseRecurrence(input: unknown): ParseResult {
  if (input == null || input === '') return { ok: true, value: null }
  let raw = input
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw)
    } catch {
      return { ok: false }
    }
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false }
  const r = raw as Record<string, unknown>

  const freq = typeof r.freq === 'string' ? r.freq.toLowerCase() : r.freq
  if (!(FREQS as readonly unknown[]).includes(freq)) return { ok: false }
  const value: Recurrence = { freq: freq as Freq }

  if (r.interval != null && r.interval !== 1) {
    if (typeof r.interval !== 'number' || !Number.isInteger(r.interval) || r.interval < 1 || r.interval > 52) {
      return { ok: false }
    }
    value.interval = r.interval
  }

  if (r.byweekday != null) {
    if (!Array.isArray(r.byweekday)) return { ok: false }
    const days = r.byweekday.map(d => (typeof d === 'string' ? d.toLowerCase() : d))
    if (!days.every(d => (WEEKDAYS as readonly unknown[]).includes(d))) return { ok: false }
    // Sortiert und ohne Doppelte, damit gleiche Regeln gleich aussehen; leere Liste = keine Einschränkung
    if (days.length) value.byweekday = WEEKDAYS.filter(d => days.includes(d))
  }

  if (r.until != null) {
    if (typeof r.until !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.until)) return { ok: false }
    const t = Date.parse(r.until + 'T00:00:00Z')
    if (Number.isNaN(t) || t < Date.UTC(1970, 0, 1) || t > Date.UTC(2100, 0, 1)) return { ok: false }
    // Unmögliche Daten wie 2026-11-31 nicht still auf den Folgetag schieben
    if (new Date(t).toISOString().slice(0, 10) !== r.until) return { ok: false }
    value.until = r.until
  }

  return { ok: true, value }
}

export function serializeRecurrence(r: Recurrence | null): string | null {
  return r ? JSON.stringify(r) : null
}

// Vorlagen für die Auswahl im Dialog
export const PRESETS: { key: string; label: string; rule: Recurrence | null }[] = [
  { key: 'none', label: 'Nie', rule: null },
  { key: 'daily', label: 'Täglich', rule: { freq: 'daily' } },
  { key: 'weekdays', label: 'Werktags (Mo–Fr)', rule: { freq: 'weekly', byweekday: ['mo', 'tu', 'we', 'th', 'fr'] } },
  { key: 'weekly', label: 'Wöchentlich', rule: { freq: 'weekly' } },
  { key: 'biweekly', label: 'Alle 2 Wochen', rule: { freq: 'weekly', interval: 2 } },
  { key: 'monthly', label: 'Monatlich', rule: { freq: 'monthly' } },
  { key: 'yearly', label: 'Jährlich', rule: { freq: 'yearly' } },
]

function sameRule(a: Recurrence, b: Recurrence) {
  return a.freq === b.freq
    && (a.interval ?? 1) === (b.interval ?? 1)
    && (a.byweekday ?? []).join() === (b.byweekday ?? []).join()
}

// Welche Vorlage passt zu einer gespeicherten Regel? 'custom', wenn keine passt.
export function presetKey(r: Recurrence | null): string {
  if (!r) return 'none'
  return PRESETS.find(p => p.rule && sameRule(p.rule, r))?.key ?? 'custom'
}

const DAY_NAMES: Record<Weekday, string> = { mo: 'Mo', tu: 'Di', we: 'Mi', th: 'Do', fr: 'Fr', sa: 'Sa', su: 'So' }

export function describeRecurrence(r: Recurrence): string {
  const n = r.interval ?? 1
  const unit = { daily: ['Täglich', 'Tage'], weekly: ['Wöchentlich', 'Wochen'], monthly: ['Monatlich', 'Monate'], yearly: ['Jährlich', 'Jahre'] }[r.freq]
  let text = n === 1 ? unit[0] : `Alle ${n} ${unit[1]}`
  if (r.byweekday?.length) text += ` (${r.byweekday.map(d => DAY_NAMES[d]).join(', ')})`
  return text
}
