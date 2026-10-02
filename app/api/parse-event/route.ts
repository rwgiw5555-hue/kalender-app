import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { EventInput, readJson } from '@/lib/validation'
import { rejectForeign } from '@/lib/request-guard'
import { parseCommand } from '@/lib/parse'
import { parseRecurrence } from '@/lib/recurrence'

// Wertet gesprochenen/getippten Text aus und liefert eine Liste von VORSCHLÄGEN
// (Termine anlegen, ändern, löschen; Aufgaben anlegen). Gespeichert wird hier nichts;
// das macht die App erst, wenn der Nutzer einzelne Vorschläge bestätigt.
// Body: { text, withCalendar } – withCalendar nur, wenn der Nutzer
// „KI darf Termine und Aufgaben sehen“ eingeschaltet hat.
// Antwort: { proposals: [...], notes: [...] }

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

export async function POST(req: Request) {
  const denied = rejectForeign(req)
  if (denied) return denied
  const body = await readJson(req)
  const b = typeof body === 'object' && body !== null ? (body as { text?: unknown; withCalendar?: unknown }) : {}

  const result = await parseCommand(b.text, b.withCalendar === true)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

  // Ändern/Löschen: aktuellen Stand mitschicken, damit die App „vorher → nachher“ zeigen kann
  const ids = result.proposals.flatMap(p => (p.action === 'update' || p.action === 'delete' ? [p.eventId] : []))
  const current = new Map((ids.length ? await prisma.event.findMany({ where: { id: { in: ids } } }) : []).map(e => [e.id, e]))

  const notes = [...result.notes]
  const proposals = result.proposals.flatMap((p): object[] => {
    if (p.action === 'create') return [{ action: p.action, message: p.message, event: toClient(p.event), ...(p.forTask ? { forTask: p.forTask } : {}) }]
    if (p.action === 'task') {
      const rule = parseRecurrence(p.task.rrule)
      return [{ action: p.action, message: p.message, task: { title: p.task.title, date: p.task.date, rrule: rule.ok ? rule.value : null } }]
    }
    const stored = current.get(p.eventId)
    if (!stored) {
      notes.push('Ein Termin, der geändert werden sollte, existiert nicht mehr.')
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
  return NextResponse.json({ proposals, notes: [...new Set(notes)] })
}
