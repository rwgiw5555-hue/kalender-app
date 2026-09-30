import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { readJson, validateEvent } from '@/lib/validation'
import { rejectForeign } from '@/lib/request-guard'

export async function GET(req: Request) {
  const denied = rejectForeign(req)
  if (denied) return denied
  const events = await prisma.event.findMany({ orderBy: { startTime: 'asc' } })
  return NextResponse.json(events)
}

export async function POST(req: Request) {
  const denied = rejectForeign(req)
  if (denied) return denied
  const result = validateEvent(await readJson(req))
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  const event = await prisma.event.create({ data: result.data })
  return NextResponse.json(event, { status: 201 })
}
