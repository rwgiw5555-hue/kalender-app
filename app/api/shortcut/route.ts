import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { readJson } from '@/lib/validation'
import { rejectForeign } from '@/lib/request-guard'
import { parseEventText, MAX_TEXT } from '@/lib/parse'
import { localDate, TIME_ZONE } from '@/lib/dates'
import { describeRecurrence, parseRecurrence } from '@/lib/recurrence'
import { checkShortcutToken, shortcutEnabled } from '@/lib/shortcut-auth'

// Endpunkt für den Siri-Kurzbefehl „Termin eintragen“ (Anleitung: docs/SIRI.md).
// Nimmt diktierten Text, legt einen Termin oder eine Aufgabe an und antwortet mit
// einem Satz, den Siri vorlesen kann: { ok, message }.

const TASK_PREFIX = /^\s*(?:aufgabe|to-?do|erinnere mich an)\s*[:,]?\s+(.+)$/i

const whenFmt = new Intl.DateTimeFormat('de-DE', {
  timeZone: TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
})

function reply(status: number, message: string) {
  return NextResponse.json({ ok: status < 300, message }, { status })
}

export async function POST(req: Request) {
  const denied = rejectForeign(req)
  if (denied) return denied
  if (!shortcutEnabled()) return reply(404, 'Der Kurzbefehl ist nicht eingerichtet.')
  if (!checkShortcutToken(req.headers.get('authorization'))) return reply(401, 'Zugriff verweigert.')

  const body = await readJson(req)
  const text = typeof body === 'object' && body !== null ? (body as { text?: unknown }).text : undefined
  if (typeof text !== 'string' || !text.trim()) return reply(400, 'Ich habe keinen Text bekommen.')
  if (text.length > MAX_TEXT) return reply(400, 'Der Text ist zu lang.')

  // „Aufgabe Milch kaufen“ → Aufgabe für heute
  const task = TASK_PREFIX.exec(text)
  if (task) {
    const title = task[1].trim().replace(/[.!]+$/, '').slice(0, 200)
    await prisma.task.create({ data: { title, date: localDate(new Date()) } })
    return reply(201, `Aufgabe „${title}“ eingetragen.`)
  }

  const result = await parseEventText(text)
  if (!result.ok) {
    return reply(result.status, result.status === 502
      ? 'Der Kalender kann den Text gerade nicht auswerten.'
      : `Das habe ich nicht als Termin verstanden: ${result.error}.`)
  }
  const event = await prisma.event.create({ data: result.data })
  const rule = parseRecurrence(event.rrule)
  const described = rule.ok && rule.value ? describeRecurrence(rule.value) : ''
  const repeat = described ? `, ${described[0].toLowerCase()}${described.slice(1)}` : ''
  return reply(201, `${event.title} am ${whenFmt.format(event.startTime)} eingetragen${repeat}.`)
}
