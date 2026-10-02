import { NextResponse } from 'next/server'
import { readJson } from '@/lib/validation'
import { rejectForeign } from '@/lib/request-guard'
import { parseCommand } from '@/lib/parse'
import { proposalsForClient } from '@/lib/proposals'

// Wertet gesprochenen/getippten Text aus und liefert eine Liste von VORSCHLÄGEN
// (Termine anlegen, ändern, löschen; Aufgaben anlegen). Gespeichert wird hier nichts;
// das macht die App erst, wenn der Nutzer einzelne Vorschläge bestätigt.
// Body: { text, withCalendar } – withCalendar nur, wenn der Nutzer
// „KI darf Termine und Aufgaben sehen“ eingeschaltet hat.
// Antwort: { proposals: [...], notes: [...] }

// Text bis 6000 Zeichen, großzügig für JSON und Umlaute
const MAX_BODY_BYTES = 64 * 1024

export async function POST(req: Request) {
  const denied = rejectForeign(req)
  if (denied) return denied
  const length = Number(req.headers.get('content-length') ?? NaN)
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return NextResponse.json({ error: 'Text zu lang' }, { status: 413 })
  const body = await readJson(req)
  const b = typeof body === 'object' && body !== null ? (body as { text?: unknown; withCalendar?: unknown }) : {}

  const result = await parseCommand(b.text, b.withCalendar === true)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(await proposalsForClient(result.proposals, result.notes))
}
