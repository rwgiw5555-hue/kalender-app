import prisma from './prisma'
import type { EventInput } from './validation'
import type { Proposal } from './parse'
import { parseRecurrence } from './recurrence'

// Bringt geprüfte Vorschläge in die Form, die die Vorschlagsliste der App erwartet.
// Ändern/Löschen: aktuellen Stand mitschicken, damit die App „vorher → nachher“ zeigen kann.

type EventFields = Pick<EventInput, 'title' | 'description' | 'startTime' | 'endTime' | 'rrule'> & { category: string | null }

function toClient(e: EventFields) {
  const rule = parseRecurrence(e.rrule)
  return {
    title: e.title,
    description: e.description ?? '',
    startTime: e.startTime.toISOString(),
    endTime: e.endTime.toISOString(),
    category: e.category ?? 'Sonstiges',
    rrule: rule.ok ? rule.value : null,
  }
}

export async function proposalsForClient(proposals: Proposal[], notes: string[]) {
  const ids = proposals.flatMap(p => (p.action === 'update' || p.action === 'delete' ? [p.eventId] : []))
  const current = new Map((ids.length ? await prisma.event.findMany({ where: { id: { in: ids } } }) : []).map(e => [e.id, e]))

  const allNotes = [...notes]
  const list = proposals.flatMap((p): object[] => {
    if (p.action === 'create') return [{ action: p.action, message: p.message, event: toClient(p.event), ...(p.forTask ? { forTask: p.forTask } : {}) }]
    if (p.action === 'task') {
      const rule = parseRecurrence(p.task.rrule)
      return [{ action: p.action, message: p.message, task: { title: p.task.title, date: p.task.date, rrule: rule.ok ? rule.value : null } }]
    }
    const stored = current.get(p.eventId)
    if (!stored) {
      allNotes.push('Ein Termin, der geändert werden sollte, existiert nicht mehr.')
      return []
    }
    return [{
      action: p.action,
      eventId: p.eventId,
      message: p.message,
      current: toClient(stored),
      ...(p.action === 'update' ? { event: toClient(p.event) } : {}),
    }]
  })
  return { proposals: list, notes: [...new Set(allNotes)] }
}
