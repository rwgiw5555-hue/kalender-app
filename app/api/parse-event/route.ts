import { NextResponse } from 'next/server'
import { readJson } from '@/lib/validation'
import { rejectForeign } from '@/lib/request-guard'
import { parseEventText } from '@/lib/parse'

export async function POST(req: Request) {
  const denied = rejectForeign(req)
  if (denied) return denied
  const body = await readJson(req)
  const text = typeof body === 'object' && body !== null ? (body as { text?: unknown }).text : undefined

  const result = await parseEventText(text)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result.data)
}
