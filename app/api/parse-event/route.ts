import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()

export async function POST(req: Request) {
  const { text } = await req.json()
  const today = new Date().toISOString().split('T')[0]

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: `Heute ist ${today}. Wandle diesen deutschen Text in ein Kalender-Event um und antworte NUR mit gültigem JSON ohne Markdown-Umrahmung:
Text: "${text}"

JSON-Format:
{
  "title": "string",
  "description": "string oder null",
  "startTime": "ISO-8601 DateTime",
  "endTime": "ISO-8601 DateTime",
  "category": "Arbeit | Privat | Sport | Sonstiges"
}`
    }]
  })

  const raw = (message.content[0] as { type: string; text: string }).text.trim()
  const parsed = JSON.parse(raw)
  return NextResponse.json(parsed)
}
