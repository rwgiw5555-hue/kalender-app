import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { readJson } from '@/lib/validation'
import { rejectForeign } from '@/lib/request-guard'
import { isDateString, localDate } from '@/lib/dates'
import { tasksForDay, validateTask } from '@/lib/tasks'

// GET ?date=YYYY-MM-DD → Aufgaben für diesen Tag (Standard: heute)
// GET ?eventId=N       → Schritte einer Routine
export async function GET(req: Request) {
  const denied = rejectForeign(req)
  if (denied) return denied

  const params = new URL(req.url).searchParams
  const eventId = params.get('eventId')
  if (eventId !== null) {
    if (!/^\d{1,10}$/.test(eventId)) return NextResponse.json({ error: 'Ungültiger Termin' }, { status: 400 })
    const steps = await prisma.task.findMany({
      where: { eventId: Number(eventId) },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    })
    return NextResponse.json(steps)
  }

  const date = params.get('date') ?? localDate(new Date())
  if (!isDateString(date)) return NextResponse.json({ error: 'Ungültiges Datum' }, { status: 400 })
  return NextResponse.json(await tasksForDay(date))
}

export async function POST(req: Request) {
  const denied = rejectForeign(req)
  if (denied) return denied

  const result = validateTask(await readJson(req), localDate(new Date()))
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  if (result.data.eventId !== null && !(await prisma.event.findUnique({ where: { id: result.data.eventId } }))) {
    return NextResponse.json({ error: 'Termin nicht gefunden' }, { status: 400 })
  }
  const task = await prisma.task.create({ data: result.data })
  return NextResponse.json(task, { status: 201 })
}
