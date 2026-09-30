import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { parseId, readJson, validateEvent } from '@/lib/validation'
import { rejectForeign } from '@/lib/request-guard'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = rejectForeign(req)
  if (denied) return denied
  const id = parseId((await params).id)
  if (id === null) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })

  const body = await readJson(req)
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Ungültige Daten' }, { status: 400 })
  }

  const existing = await prisma.event.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: 'Termin nicht gefunden' }, { status: 404 })

  // Teiländerungen (z. B. Verschieben per Drag & Drop) mit dem gespeicherten Stand zusammenführen
  const result = validateEvent({
    ...existing,
    startTime: existing.startTime.toISOString(),
    endTime: existing.endTime.toISOString(),
    ...body,
  })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  const event = await prisma.event.update({ where: { id }, data: result.data })
  return NextResponse.json(event)
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = rejectForeign(req)
  if (denied) return denied
  const id = parseId((await params).id)
  if (id === null) return NextResponse.json({ error: 'Ungültige ID' }, { status: 400 })

  const { count } = await prisma.event.deleteMany({ where: { id } })
  if (count === 0) return NextResponse.json({ error: 'Termin nicht gefunden' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
