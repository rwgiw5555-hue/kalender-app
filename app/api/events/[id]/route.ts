import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const event = await prisma.event.update({ where: { id: Number(id) }, data: body })
  return NextResponse.json(event)
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.event.delete({ where: { id: Number(id) } })
  return NextResponse.json({ ok: true })
}
