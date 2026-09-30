import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { EventInput, readJson } from '@/lib/validation'
import { rejectForeign } from '@/lib/request-guard'
import { parseCommand } from '@/lib/parse'
import { parseRecurrence } from '@/lib/recurrence'

// Wertet gesprochenen/getippten Text aus und liefert einen VORSCHLAG
// (anlegen, ändern, löschen). Gespeichert wird hier nichts; das macht die App
// erst nach Bestätigung über /api/events.
// Body: { text, withCalendar } – withCalendar nur, wenn der Nutzer
// „KI darf Termine sehen“ eingeschaltet hat.

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

  const p = result.proposal
  if (p.action === 'unclear') return NextResponse.json({ action: p.action, message: p.message })
  if (p.action === 'create') return NextResponse.json({ action: p.action, message: p.message, event: toClient(p.event) })

  // Ändern/Löschen: aktuellen Stand mitschicken, damit die App „vorher → nachher“ zeigen kann
  const current = await prisma.event.findUnique({ where: { id: p.eventId } })
  if (!current) return NextResponse.json({ action: 'unclear', message: 'Den Termin gibt es nicht mehr.' })
  return NextResponse.json({
    action: p.action,
    eventId: p.eventId,
    message: p.message,
    current: toClient(current),
    ...(p.action === 'update' ? { event: toClient(p.event) } : {}),
  })
}
