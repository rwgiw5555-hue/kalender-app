// Wiederholungsregeln für Routinen. Gespeichert als JSON-Text im Feld Event.rrule,
// angezeigt über @fullcalendar/rrule. Wird von Client und Server genutzt.

import { dayNumber, isDateString } from './dates'

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
    if (days.length) {
      // Wochentage gibt es nur bei wöchentlichen Regeln. „Täglich an Werktagen“
      // ist dasselbe wie „wöchentlich Mo–Fr“; alles andere wäre mehrdeutig.
      if (value.freq === 'daily' && !value.interval) value.freq = 'weekly'
      else if (value.freq !== 'weekly') return { ok: false }
      value.byweekday = WEEKDAYS.filter(d => days.includes(d))
    }
  }

  if (r.until != null) {
    if (!isDateString(r.until)) return { ok: false }
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
  if (presetKey({ ...r, until: undefined }) === 'weekdays') return 'Werktags'
  const unit = { daily: ['Täglich', 'Tage'], weekly: ['Wöchentlich', 'Wochen'], monthly: ['Monatlich', 'Monate'], yearly: ['Jährlich', 'Jahre'] }[r.freq]
  let text = n === 1 ? unit[0] : `Alle ${n} ${unit[1]}`
  if (r.byweekday?.length) text += ` (${r.byweekday.map(d => DAY_NAMES[d]).join(', ')})`
  return text
}

// Findet die Serie mit Beginn am Tag `start` (YYYY-MM-DD) auch am Tag `date` statt?
// Tagesgenau und ohne Zeitzonen, passend zu dem, was @fullcalendar/rrule anzeigt
// (Wochen beginnen am Montag).
export function occursOn(rule: Recurrence, start: string, date: string): boolean {
  if (date < start) return false
  if (rule.until && date > rule.until) return false
  const interval = rule.interval ?? 1
  const s = new Date(start + 'T00:00:00Z')
  const d = new Date(date + 'T00:00:00Z')

  switch (rule.freq) {
    case 'daily':
      return (dayNumber(date) - dayNumber(start)) % interval === 0
    case 'weekly': {
      const weekday = WEEKDAYS[(d.getUTCDay() + 6) % 7]
      const days = rule.byweekday ?? [WEEKDAYS[(s.getUTCDay() + 6) % 7]]
      if (!days.includes(weekday)) return false
      // Montag der jeweiligen Woche; 1970-01-01 war ein Donnerstag
      const monday = (n: number) => n - ((n + 3) % 7)
      const weeks = (monday(dayNumber(date)) - monday(dayNumber(start))) / 7
      return weeks % interval === 0
    }
    case 'monthly': {
      if (d.getUTCDate() !== s.getUTCDate()) return false
      const months = (d.getUTCFullYear() - s.getUTCFullYear()) * 12 + d.getUTCMonth() - s.getUTCMonth()
      return months % interval === 0
    }
    case 'yearly':
      return d.getUTCMonth() === s.getUTCMonth() && d.getUTCDate() === s.getUTCDate()
        && (d.getUTCFullYear() - s.getUTCFullYear()) % interval === 0
  }
}
