import prisma from './prisma'
import { addDays, localDate } from './dates'
import { occursOn, parseRecurrence, periodOf, Recurrence } from './recurrence'

// Termine, die eine Aufgabe einplanen (Event.taskId): Ist die Aufgabe abgehakt, wird der
// Termin ausgeblendet, nicht gelöscht. Haken wieder weg → Termin wieder da.
// - einmalige Aufgabe abgehakt          → alle verknüpften Termine weg
// - wiederkehrend, fester Tag, Haken an D → Vorkommen vom Tag nach dem vorigen Fälligkeitstag
//   bis D weg (ein am Samstag eingeplantes „jeden Sonntag“ gehört zum Sonntag danach)
// - wiederkehrend, „irgendwann“, Haken im Zeitraum P → Vorkommen in P weg

interface PlannedTask {
  rrule: string | null
  date: string | null
  createdAt: Date
  completions: { date: string }[]
}

// Tage (YYYY-MM-DD, deutsche Zeit), an denen verknüpfte Termine ausgeblendet werden;
// 'all' = ganz ausblenden
export function hiddenRanges(task: PlannedTask): 'all' | { from: string; to: string }[] {
  if (task.completions.length === 0) return []
  const rule = parseRecurrence(task.rrule)
  if (!rule.ok || !rule.value) return 'all'
  const recurrence = rule.value
  const start = task.date ?? localDate(task.createdAt)
  return task.completions.map(c => {
    if (recurrence.anytime) return periodOf(recurrence, start, c.date) ?? { from: c.date, to: c.date }
    return { from: previousDue(recurrence, start, c.date), to: c.date }
  })
}

// Erster Tag des Abschnitts, der mit dem Fälligkeitstag `due` endet: Tag nach dem vorigen
// Fälligkeitstag. Beim ersten Fälligkeitstag der Serie (kein voriger) ein ganzer Abstand
// zurück, damit auch ein vorher eingeplanter Termin dazugehört.
const MAX_LOOKBACK = { daily: 1, weekly: 7, monthly: 31, yearly: 366 } as const
function previousDue(rule: Recurrence, start: string, due: string): string {
  const limit = MAX_LOOKBACK[rule.freq] * (rule.interval ?? 1)
  for (let i = 1; i <= limit; i++) {
    const d = addDays(due, -i)
    if (occursOn(rule, start, d)) return addDays(d, 1)
  }
  return addDays(due, 1 - limit)
}

// Ist ein (einzelner) Tag wegen einer abgehakten Aufgabe ausgeblendet?
export function isHiddenDay(ranges: 'all' | { from: string; to: string }[], day: string) {
  return ranges === 'all' || ranges.some(r => day >= r.from && day <= r.to)
}

// Alle Termine für die App, ohne ausgeblendete; Serien bekommen `exdates` (ausgelassene Tage)
export async function eventsForApp() {
  const events = await prisma.event.findMany({
    orderBy: { startTime: 'asc' },
    include: { task: { select: { id: true, title: true, rrule: true, date: true, createdAt: true, completions: { select: { date: true } } } } },
  })
  return events.flatMap(({ task, ...e }) => {
    if (!task) return [{ ...e, exdates: [] as string[], taskTitle: null as string | null }]
    const ranges = hiddenRanges(task)
    if (ranges === 'all') return []
    const startDay = localDate(e.startTime)
    const rule = parseRecurrence(e.rrule)
    const skip = new Set<string>()
    if (rule.ok && rule.value) {
      for (const r of ranges) {
        for (let d = r.from; d <= r.to; d = addDays(d, 1)) {
          if (occursOn(rule.value, startDay, d)) skip.add(d)
        }
      }
    } else if (isHiddenDay(ranges, startDay)) {
      return []
    }
    return [{ ...e, exdates: [...skip].sort(), taskTitle: task.title }]
  })
}

// Darf ein Termin diese Aufgabe einplanen? Nur bestehende, eigenständige Aufgaben (keine Routine-Schritte)
export async function checkTaskLink(taskId: number | null): Promise<string | null> {
  if (taskId === null) return null
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { eventId: true } })
  if (!task) return 'Aufgabe nicht gefunden'
  if (task.eventId !== null) return 'Schritte einer Routine lassen sich nicht einplanen'
  return null
}
