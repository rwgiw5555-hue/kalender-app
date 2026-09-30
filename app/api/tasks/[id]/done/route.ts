import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { parseId, readJson } from '@/lib/validation'
import { rejectForeign } from '@/lib/request-guard'
import { isDateString } from '@/lib/dates'

// PUT { date: "YYYY-MM-DD", done: true|false } → Haken für diesen Tag setzen/entfernen
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = rejectForeign(req)
  if (denied) return denied
  const id = parseId((await params).id)
  if (id === null) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })

  const body = await readJson(req) as { date?: unknown; done?: unknown } | undefined
  if (!body || !isDateString(body.date) || typeof body.done !== 'boolean') {
    return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })
  }
  if (!(await prisma.task.findUnique({ where: { id } }))) {
    return NextResponse.json({ error: 'Aufgabe nicht gefunden' }, { status: 404 })
  }

  const where = { taskId_date: { taskId: id, date: body.date } }
  if (body.done) {
    await prisma.taskCompletion.upsert({ where, create: { taskId: id, date: body.date }, update: {} })
  } else {
    await prisma.taskCompletion.deleteMany({ where: { taskId: id, date: body.date } })
  }
  return NextResponse.json({ ok: true, done: body.done })
}
