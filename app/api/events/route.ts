import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { readJson, validateEvent } from '@/lib/validation'
import { rejectForeign } from '@/lib/request-guard'
import { checkTaskLink, eventsForApp } from '@/lib/planned'

// Termine ohne die, deren eingeplante Aufgabe abgehakt ist (siehe lib/planned.ts)
export async function GET(req: Request) {
  const denied = rejectForeign(req)
  if (denied) return denied
  return NextResponse.json(await eventsForApp())
}

export async function POST(req: Request) {
  const denied = rejectForeign(req)
  if (denied) return denied
  const result = validateEvent(await readJson(req))
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  const linkError = await checkTaskLink(result.data.taskId)
  if (linkError) return NextResponse.json({ error: linkError }, { status: 400 })
  const event = await prisma.event.create({ data: result.data })
  return NextResponse.json(event, { status: 201 })
}
