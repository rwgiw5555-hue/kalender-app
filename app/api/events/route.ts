import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { readJson, validateEvent } from '@/lib/validation'

export async function GET() {
  const events = await prisma.event.findMany({ orderBy: { startTime: 'asc' } })
  return NextResponse.json(events)
}

export async function POST(req: Request) {
  const result = validateEvent(await readJson(req))
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  const event = await prisma.event.create({ data: result.data })
  return NextResponse.json(event, { status: 201 })
}
