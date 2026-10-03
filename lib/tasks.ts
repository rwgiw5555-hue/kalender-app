import prisma from './prisma'
import { isDateString, localDate } from './dates'
import { occursOn, parseRecurrence, periodOf, Recurrence, serializeRecurrence } from './recurrence'

const MAX_TITLE = 200
const MAX_POSITION = 100000

export interface TaskInput {
  title: string
  date: string | null
  rrule: string | null
  eventId: number | null
  position: number
}

type Result = { ok: true; data: TaskInput } | { ok: false; error: string }

// Prüft eine Aufgabe und übernimmt nur bekannte Felder. `today` ist das
// Startdatum für Wiederholungen ohne eigenes Datum.
export function validateTask(body: unknown, today: string): Result {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Ungültige Daten' }
  }
  const b = body as Record<string, unknown>

  const title = typeof b.title === 'string' ? b.title.trim() : ''
  if (!title) return { ok: false, error: 'Titel fehlt' }
  if (title.length > MAX_TITLE) return { ok: false, error: 'Titel zu lang' }

  let position = 0
  if (b.position != null) {
    if (typeof b.position !== 'number' || !Number.isInteger(b.position) || b.position < 0 || b.position > MAX_POSITION) {
      return { ok: false, error: 'Ungültige Position' }
    }
    position = b.position
  }

  let eventId: number | null = null
  if (b.eventId != null) {
    if (typeof b.eventId !== 'number' || !Number.isInteger(b.eventId) || b.eventId < 1) {
      return { ok: false, error: 'Ungültiger Termin' }
    }
    eventId = b.eventId
  }

  // Schritte einer Routine folgen deren Terminen und haben kein eigenes Datum
  if (eventId !== null) return { ok: true, data: { title, date: null, rrule: null, eventId, position } }

  let date: string | null = null
  if (b.date != null && b.date !== '') {
    if (!isDateString(b.date)) return { ok: false, error: 'Ungültiges Datum' }
    date = b.date
  }

  const recurrence = parseRecurrence(b.rrule)
  if (!recurrence.ok) return { ok: false, error: 'Ungültige Wiederholung' }
  if (recurrence.value) {
    date ??= today
    if (recurrence.value.until && recurrence.value.until < date) {
      return { ok: false, error: 'Wiederholung endet vor dem Start' }
    }
  }

  return { ok: true, data: { title, date, rrule: serializeRecurrence(recurrence.value), eventId, position } }
}

type TaskWithEvent = {
  date: string | null
  rrule: string | null
  event: { startTime: Date; rrule: string | null } | null
}

// Findet eine Routine-Aufgabe oder wiederkehrende Aufgabe an `day` statt?
// null bei einmaligen Aufgaben (die haben keine festen Tage).
export function taskOccursOn(t: TaskWithEvent, day: string): boolean | null {
  if (t.event) {
    const eventRule = parseRecurrence(t.event.rrule)
    const start = localDate(t.event.startTime)
    return eventRule.ok && eventRule.value ? occursOn(eventRule.value, start, day) : start === day
  }
  const rule = parseRecurrence(t.rrule)
  if (rule.ok && rule.value) return occursOn(rule.value, t.date ?? day, day)
  return null
}

export interface DayTask {
  id: number
  title: string
  date: string | null
  rrule: Recurrence | null
  eventId: number | null
  eventTitle: string | null
  eventStart: string | null // ISO-Zeitpunkt des Serienbeginns, für die Uhrzeit
  position: number
  done: boolean
  overdue: boolean
}

// Alle Aufgaben, die an `day` angezeigt werden:
// - Schritte einer Routine, wenn die Routine an dem Tag stattfindet
// - wiederkehrende Aufgaben, wenn sie an dem Tag fällig sind; „irgendwann im Zeitraum“
//   an jedem Tag des Zeitraums, bis sie abgehakt sind, danach nur noch am Tag des Hakens
// - einmalige Aufgaben ohne Datum oder mit Datum bis `day`, solange offen;
//   erledigte nur an dem Tag, an dem sie abgehakt wurden
export async function tasksForDay(day: string): Promise<DayTask[]> {
  const tasks = await prisma.task.findMany({
    include: { completions: true, event: true },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
  })

  const result: DayTask[] = []
  for (const t of tasks) {
    const doneToday = t.completions.some(c => c.date === day)
    const rule = parseRecurrence(t.rrule)
    const recurrence = rule.ok ? rule.value : null
    let show = taskOccursOn(t, day)
    let overdue = false

    if (show && recurrence?.anytime && !t.event) {
      // Schon an einem anderen Tag dieses Zeitraums erledigt: bis zum nächsten Zeitraum ausblenden
      const period = periodOf(recurrence, t.date ?? day, day)
      show = !period || doneToday || !t.completions.some(c => c.date >= period.from && c.date <= period.to)
    } else if (show !== null) {
      // Routine-Schritt oder wiederkehrende Aufgabe: steht fest
    } else if (t.completions.length > 0) {
      show = doneToday
    } else {
      show = !t.date || t.date <= day
      overdue = !!t.date && t.date < day
    }
    if (!show) continue

    result.push({
      id: t.id,
      title: t.title,
      date: t.date,
      rrule: recurrence,
      eventId: t.eventId,
      eventTitle: t.event?.title ?? null,
      eventStart: t.event?.startTime.toISOString() ?? null,
      position: t.position,
      done: doneToday,
      overdue,
    })
  }
  return result
}
