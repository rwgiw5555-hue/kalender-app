import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { parseId, readJson } from '@/lib/validation'
import { rejectForeign } from '@/lib/request-guard'
import { isDateString } from '@/lib/dates'
import { taskOccursOn } from '@/lib/tasks'
import { Prisma } from '@/app/generated/prisma/client'

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
  const task = await prisma.task.findUnique({ where: { id }, include: { event: true } })
  if (!task) return NextResponse.json({ error: 'Aufgabe nicht gefunden' }, { status: 404 })
  if (taskOccursOn(task, body.date) === false) {
    return NextResponse.json({ error: 'Aufgabe ist an diesem Tag nicht fällig' }, { status: 400 })
  }

  if (body.done) {
    try {
      await prisma.taskCompletion.create({ data: { taskId: id, date: body.date } })
    } catch (e) {
      // Schon abgehakt (z. B. Doppelklick): ist in Ordnung
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e
    }
  } else {
    await prisma.taskCompletion.deleteMany({ where: { taskId: id, date: body.date } })
  }
  return NextResponse.json({ ok: true, done: body.done })
}
