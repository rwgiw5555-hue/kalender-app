export const CATEGORIES = ['Arbeit', 'Privat', 'Sport', 'Sonstiges'] as const

const MAX_TITLE = 200
const MAX_DESCRIPTION = 2000

export interface EventInput {
  title: string
  description: string | null
  startTime: Date
  endTime: Date
  category: string
  color: string | null
}

type Result = { ok: true; data: EventInput } | { ok: false; error: string }

const MIN_DATE = Date.UTC(1970, 0, 1)
const MAX_DATE = Date.UTC(2100, 0, 1)

function toDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const d = new Date(value)
  const t = d.getTime()
  return Number.isNaN(t) || t < MIN_DATE || t > MAX_DATE ? null : d
}

// Übernimmt nur bekannte Felder (kein id, createdAt o. Ä. aus dem Request).
export function validateEvent(body: unknown): Result {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Ungültige Daten' }
  }
  const b = body as Record<string, unknown>

  const title = typeof b.title === 'string' ? b.title.trim() : ''
  if (!title) return { ok: false, error: 'Titel fehlt' }
  if (title.length > MAX_TITLE) return { ok: false, error: 'Titel zu lang' }

  let description: string | null = null
  if (b.description != null) {
    if (typeof b.description !== 'string') return { ok: false, error: 'Ungültige Beschreibung' }
    if (b.description.length > MAX_DESCRIPTION) return { ok: false, error: 'Beschreibung zu lang' }
    description = b.description.trim() || null
  }

  const startTime = toDate(b.startTime)
  const endTime = toDate(b.endTime)
  if (!startTime || !endTime) return { ok: false, error: 'Ungültige Zeitangabe' }
  if (endTime < startTime) return { ok: false, error: 'Ende liegt vor dem Start' }

  const category = typeof b.category === 'string' && (CATEGORIES as readonly string[]).includes(b.category)
    ? b.category
    : 'Sonstiges'

  let color: string | null = null
  if (b.color != null) {
    if (typeof b.color !== 'string' || !/^#[0-9a-fA-F]{3,8}$/.test(b.color)) {
      return { ok: false, error: 'Ungültige Farbe' }
    }
    color = b.color
  }

  return { ok: true, data: { title, description, startTime, endTime, category, color } }
}

// Nur echte JSON-Anfragen: Ein fremdes Formular oder text/plain-POST von einer
// anderen Webseite kann diesen Header nicht ohne CORS-Vorabprüfung setzen.
export async function readJson(req: Request): Promise<unknown> {
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) return undefined
  try {
    return await req.json()
  } catch {
    return undefined
  }
}

const MAX_ID = 2147483647

export function parseId(id: string): number | null {
  if (!/^\d{1,10}$/.test(id)) return null
  const n = Number(id)
  return n >= 1 && n <= MAX_ID ? n : null
}
