import { NextResponse } from 'next/server'

// Erlaubte Hostnamen. Weitere (z. B. der Tailscale-Name des Servers) über
// ALLOWED_HOSTS in .env, kommagetrennt.
function allowedHosts(): Set<string> {
  const extra = (process.env.ALLOWED_HOSTS ?? '').split(',').map(h => h.trim().toLowerCase()).filter(Boolean)
  return new Set(['127.0.0.1', 'localhost', '[::1]', ...extra])
}

function hostname(hostWithPort: string): string {
  return hostWithPort.toLowerCase().replace(/:\d+$/, '')
}

// Blockt Anfragen, die nicht von der App selbst kommen: fremde Webseiten
// (Origin) und DNS-Rebinding (Host).
export function rejectForeign(req: Request): NextResponse | null {
  const hosts = allowedHosts()
  const host = req.headers.get('host')
  if (!host || !hosts.has(hostname(host))) {
    return NextResponse.json({ error: 'Nicht erlaubt' }, { status: 403 })
  }
  const origin = req.headers.get('origin')
  if (origin) {
    let originHost: string
    try {
      originHost = new URL(origin).host
    } catch {
      return NextResponse.json({ error: 'Nicht erlaubt' }, { status: 403 })
    }
    if (!hosts.has(hostname(originHost))) {
      return NextResponse.json({ error: 'Nicht erlaubt' }, { status: 403 })
    }
  }
  return null
}
