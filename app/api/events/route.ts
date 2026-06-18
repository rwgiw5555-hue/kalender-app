import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  const events = await prisma.event.findMany({ orderBy: { startTime: 'asc' } })
  return NextResponse.json(events)
}

export async function POST(req: Request) {
  const body = await req.json()
  const event = await prisma.event.create({ data: body })
  return NextResponse.json(event, { status: 201 })
}
