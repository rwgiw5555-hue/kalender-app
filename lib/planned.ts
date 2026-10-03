import prisma from './prisma'
import { addDays, localDate } from './dates'
import { occursOn, parseRecurrence, periodOf } from './recurrence'

// Termine, die eine Aufgabe einplanen (Event.taskId): Ist die Aufgabe abgehakt, wird der
// Termin ausgeblendet, nicht gelöscht. Haken wieder weg → Termin wieder da.
// - einmalige Aufgabe abgehakt          → alle verknüpften Termine weg
// - wiederkehrend, fester Tag, Haken an D → Vorkommen an D weg
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
  return task.completions.map(c => (recurrence.anytime && periodOf(recurrence, start, c.date)) || { from: c.date, to: c.date })
}

const inRanges = (day: string, ranges: { from: string; to: string }[]) => ranges.some(r => day >= r.from && day <= r.to)

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
    const exdates: string[] = []
    if (rule.ok && rule.value) {
      for (const r of ranges) {
        for (let d = r.from; d <= r.to; d = addDays(d, 1)) {
          if (occursOn(rule.value, startDay, d) && !exdates.includes(d)) exdates.push(d)
        }
      }
    } else if (inRanges(startDay, ranges)) {
      return []
    }
    return [{ ...e, exdates, taskTitle: task.title }]
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
