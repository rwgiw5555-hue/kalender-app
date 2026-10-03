import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { parseId, readJson } from '@/lib/validation'
import { rejectForeign } from '@/lib/request-guard'
import { localDate } from '@/lib/dates'
import { validateTask } from '@/lib/tasks'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = rejectForeign(req)
  if (denied) return denied
  const id = parseId((await params).id)
  if (id === null) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })

  const body = await readJson(req)
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })
  }
  const existing = await prisma.task.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Aufgabe nicht gefunden' }, { status: 404 })

  // Teiländerungen (z. B. nur Titel oder Position) mit dem gespeicherten Stand zusammenführen
  const result = validateTask({ ...existing, ...body }, localDate(new Date()))
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  if (result.data.eventId !== null && !(await prisma.event.findUnique({ where: { id: result.data.eventId } }))) {
    return NextResponse.json({ error: 'Termin nicht gefunden' }, { status: 400 })
  }
  // Wechselt die Aufgabe ihre Art (Routine-Schritt, wiederkehrend, einmalig),
  // passen alte Haken nicht mehr und werden entfernt
  const kindChanged = result.data.eventId !== existing.eventId || result.data.rrule !== existing.rrule
  const update = prisma.task.update({ where: { id }, data: result.data })
  // Wird eine eingeplante Aufgabe zum Routine-Schritt, verlieren ihre Termine die Verknüpfung
  const unlink = result.data.eventId !== null
    ? [prisma.event.updateMany({ where: { taskId: id }, data: { taskId: null } })]
    : []
  const task = kindChanged
    ? (await prisma.$transaction([...unlink, prisma.taskCompletion.deleteMany({ where: { taskId: id } }), update])).at(-1)
    : await update
  return NextResponse.json(task)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = rejectForeign(req)
  if (denied) return denied
  const id = parseId((await params).id)
  if (id === null) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })

  // Eingeplante Termine bleiben, verlieren nur die Verknüpfung (nicht auf SQLite-Fremdschlüssel verlassen)
  const [, , { count }] = await prisma.$transaction([
    prisma.event.updateMany({ where: { taskId: id }, data: { taskId: null } }),
    prisma.taskCompletion.deleteMany({ where: { taskId: id } }),
    prisma.task.deleteMany({ where: { id } }),
  ])
  if (count === 0) return NextResponse.json({ error: 'Aufgabe nicht gefunden' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
