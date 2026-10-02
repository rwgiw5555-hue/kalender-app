import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { readJson } from '@/lib/validation'
import { rejectForeign } from '@/lib/request-guard'
import { parseEventText, MAX_TEXT } from '@/lib/parse'
import { localDate, TIME_ZONE } from '@/lib/dates'
import { describeRecurrence, parseRecurrence } from '@/lib/recurrence'
import { validateTask } from '@/lib/tasks'
import { checkShortcutToken, shortcutEnabled } from '@/lib/shortcut-auth'

// Endpunkt für den Siri-Kurzbefehl „Mein Kalender“ (Anleitung: docs/SIRI.md).
// Nimmt diktierten Text, legt einen Termin oder eine Aufgabe an und antwortet mit
// einem Satz, den Siri vorlesen kann: { ok, message }.

// „Aufgabe Milch kaufen“, „Aufgabe: Milch kaufen“, „To-do …“, „To do …“
const TASK_PREFIX = /^\s*(?:aufgabe|to[- ]?do)(?:\s*[:,]\s*|\s+)(.+)$/i

const whenFmt = new Intl.DateTimeFormat('de-DE', {
  timeZone: TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
})

function reply(status: number, message: string) {
  return NextResponse.json({ ok: status < 300, message }, { status })
}

export async function POST(req: Request) {
  // Immer mit { ok, message } antworten, damit Siri auch Fehler vorlesen kann
  if (rejectForeign(req)) return reply(403, 'Diese Adresse ist für den Kalender nicht freigegeben.')
  if (!shortcutEnabled()) return reply(404, 'Der Kurzbefehl ist nicht eingerichtet.')
  if (!checkShortcutToken(req.headers.get('authorization'))) return reply(401, 'Zugriff verweigert.')

  const body = await readJson(req)
  const text = typeof body === 'object' && body !== null ? (body as { text?: unknown }).text : undefined
  if (typeof text !== 'string' || !text.trim()) return reply(400, 'Ich habe keinen Text bekommen.')
  if (text.length > MAX_TEXT) return reply(400, 'Der Text ist zu lang.')

  // „Aufgabe Milch kaufen“ → Aufgabe für heute
  try {
    const prefix = TASK_PREFIX.exec(text)
    if (prefix) {
      const task = validateTask({ title: prefix[1].replace(/[\s.!?]+$/, '') }, localDate(new Date()))
      if (!task.ok) {
        return reply(400, task.error === 'Titel fehlt'
          ? 'Ich habe keinen Titel für die Aufgabe verstanden.'
          : `Die Aufgabe konnte ich nicht eintragen: ${task.error}.`)
      }
      await prisma.task.create({ data: { ...task.data, date: localDate(new Date()) } })
      return reply(201, `Aufgabe „${task.data.title}“ eingetragen.`)
    }

    const result = await parseEventText(text)
    if (!result.ok) {
      return reply(result.status, result.status === 502
        ? 'Der Kalender kann den Text gerade nicht auswerten.'
        : result.status === 409
          ? 'Das waren mehrere Einträge. Bitte in der App eintragen, dort kannst du jeden einzeln bestätigen.'
          : `Das habe ich nicht als Termin verstanden: ${result.error}.`)
    }
    const event = await prisma.event.create({ data: result.data })
    const rule = parseRecurrence(event.rrule)
    const described = rule.ok && rule.value ? describeRecurrence(rule.value) : ''
    const repeat = described ? `, ${described[0].toLowerCase()}${described.slice(1)}` : ''
    return reply(201, `${event.title} am ${whenFmt.format(event.startTime)} eingetragen${repeat}.`)
  } catch {
    return reply(500, 'Beim Speichern ist etwas schiefgegangen.')
  }
}
