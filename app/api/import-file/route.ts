import { NextResponse } from 'next/server'
import { readJson } from '@/lib/validation'
import { rejectForeign } from '@/lib/request-guard'
import { ImportFile, MAX_LONG_TEXT, parseCommand } from '@/lib/parse'
import { proposalsForClient } from '@/lib/proposals'

// Import aus einer Datei (PDF oder Foto): Claude liest sie und liefert wie die
// Spracheingabe nur VORSCHLÄGE; gespeichert wird erst nach Bestätigung in der App.
// Body: { mediaType, data (base64), text?, withCalendar }
// Antwort: { proposals: [...], notes: [...] }

const MAX_FILE_BYTES = 10 * 1024 * 1024
// Claude nimmt Bilder nur bis 5 MB base64, also ca. 3,75 MB Rohdaten
const MAX_IMAGE_BASE64 = 5 * 1024 * 1024
// base64 ist ~4/3 so groß; dazu etwas Platz für Text und JSON
const MAX_BODY_BYTES = Math.ceil((MAX_FILE_BYTES * 4) / 3) + MAX_LONG_TEXT * 4 + 4096

// Erlaubte Typen mit ihren Erkennungsbytes am Dateianfang: Die Angabe des
// Browsers allein reicht nicht
const SIGNATURES: Record<ImportFile['mediaType'], (b: Buffer) => boolean> = {
  'application/pdf': b => b.subarray(0, 5).toString('latin1') === '%PDF-',
  'image/jpeg': b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': b => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': b => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  'image/gif': b => b.subarray(0, 4).toString('latin1') === 'GIF8',
}

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status })
}

export async function POST(req: Request) {
  const denied = rejectForeign(req)
  if (denied) return denied

  // Zu große Anfragen gar nicht erst einlesen
  const length = Number(req.headers.get('content-length') ?? NaN)
  if (!Number.isFinite(length)) return bad('Größe der Datei unbekannt', 411)
  if (length > MAX_BODY_BYTES) return bad('Datei zu groß (höchstens 10 MB)', 413)

  const body = await readJson(req)
  if (typeof body !== 'object' || body === null) return bad('Ungültige Daten')
  const b = body as { mediaType?: unknown; data?: unknown; text?: unknown; withCalendar?: unknown }

  const mediaType = b.mediaType
  if (typeof mediaType !== 'string' || !(mediaType in SIGNATURES)) return bad('Nur PDF, JPG, PNG, WebP oder GIF')
  if (typeof b.data !== 'string' || !b.data || b.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b.data)) {
    return bad('Datei fehlt oder ist beschädigt')
  }
  if (mediaType !== 'application/pdf' && b.data.length > MAX_IMAGE_BASE64) return bad('Foto zu groß (höchstens ca. 3,5 MB)', 413)

  const bytes = Buffer.from(b.data, 'base64')
  if (bytes.length > MAX_FILE_BYTES) return bad('Datei zu groß (höchstens 10 MB)', 413)
  const type = mediaType as ImportFile['mediaType']
  if (!SIGNATURES[type](bytes)) return bad('Der Inhalt passt nicht zum Dateityp')

  const text = typeof b.text === 'string' ? b.text : ''
  const result = await parseCommand(text, b.withCalendar === true, { mediaType: type, data: b.data })
  if (!result.ok) return bad(result.error, result.status)
  // Aus fremden Dokumenten nur Neues übernehmen: Ändern und Löschen bestehender
  // Termine geht nur per Sprache oder Text
  const proposals = result.proposals.filter(p => p.action === 'create' || p.action === 'task')
  const notes = proposals.length < result.proposals.length
    ? [...result.notes, 'Änderungen an bestehenden Terminen werden beim Import nicht übernommen. Bitte per Sprache oder Text sagen.']
    : result.notes
  return NextResponse.json(await proposalsForClient(proposals, notes))
}
