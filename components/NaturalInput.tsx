'use client'
import { useRef, useState, useSyncExternalStore } from 'react'
import EventModal, { EventFormData } from './EventModal'
import { alertSaveError, useAiContext } from '@/lib/client'
import { describeRecurrence, Recurrence } from '@/lib/recurrence'
import { TIME_ZONE } from '@/lib/dates'

interface Props {
  onChanged: () => void
}

interface ProposedEvent {
  title: string
  description: string
  startTime: string
  endTime: string
  category: string
  rrule: Recurrence | null
}

type Preview =
  | { action: 'create'; message: string; event: ProposedEvent }
  | { action: 'update'; message: string; eventId: number; event: ProposedEvent; current: ProposedEvent }
  | { action: 'delete'; message: string; eventId: number; current: ProposedEvent }

const whenFmt = new Intl.DateTimeFormat('de-DE', {
  timeZone: TIME_ZONE, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
})
const timeFmt = new Intl.DateTimeFormat('de-DE', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' })

// Der Dialog erwartet lokale Zeit (datetime-local), der Server liefert UTC
function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function describe(e: ProposedEvent) {
  const repeat = e.rrule ? `, ${describeRecurrence(e.rrule)}` : ''
  return `${e.title}, ${whenFmt.format(new Date(e.startTime))}–${timeFmt.format(new Date(e.endTime))}${repeat}`
}

// Minimal-Typen für die Web Speech API (nicht in den TypeScript-Standardtypen)
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
  start(): void
  stop(): void
}
type RecognitionConstructor = new () => Recognition

function getRecognition(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor
    webkitSpeechRecognition?: RecognitionConstructor
    navigator: { standalone?: boolean }
  }
  // In einer vom iPhone-Homescreen gestarteten Web-App blockiert iOS die Erkennung;
  // dort die Diktier-Taste der Tastatur nutzen
  if (w.navigator.standalone) return null
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const noSubscribe = () => () => {}

export default function NaturalInput({ onChanged }: Props) {
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [blocked, setBlocked] = useState(false)
  const available = useSyncExternalStore(noSubscribe, () => getRecognition() !== null, () => false)
  const speechSupported = available && !blocked
  const recognitionRef = useRef<Recognition | null>(null)

  function toggleMic() {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    if (!recognitionRef.current) {
      const SR = getRecognition()
      if (!SR) return
      const rec = new SR()
      rec.lang = 'de-DE'
      rec.continuous = false
      rec.interimResults = false
      rec.onresult = e => setText(e.results[0][0].transcript)
      rec.onend = () => setListening(false)
      rec.onerror = e => {
        setListening(false)
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          setBlocked(true)
          setError('Mikrofon nicht verfügbar – nutze die Diktier-Taste der Tastatur')
        }
      }
      recognitionRef.current = rec
    }
    setError('')
    recognitionRef.current.start()
    setListening(true)
  }

  const withCalendar = useAiContext()
  const [preview, setPreview] = useState<Preview | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/parse-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, withCalendar }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Termin nicht erkannt')
      // Nichts wird direkt gespeichert: erst Vorschlag zeigen
      if (data.action === 'unclear') setError(data.message)
      else setPreview(data)
    } catch (err) {
      // fetch wirft TypeError bei fehlender Verbindung (Meldung sonst englisch)
      setError(err instanceof TypeError ? 'Keine Verbindung zum Kalender' : err instanceof Error ? err.message : 'Fehler')
    } finally {
      setLoading(false)
    }
  }

  async function confirm(request: () => Promise<Response>) {
    const res = await request().catch(() => null)
    if (!res) return window.alert('Speichern fehlgeschlagen: keine Verbindung')
    if (!res.ok) return alertSaveError(res)
    setPreview(null)
    setText('')
    onChanged()
  }

  function save(data: EventFormData) {
    const body = JSON.stringify({
      title: data.title, description: data.description, startTime: data.startTime,
      endTime: data.endTime, category: data.category, rrule: data.rrule,
    })
    const headers = { 'Content-Type': 'application/json' }
    confirm(() => preview?.action === 'update'
      ? fetch(`/api/events/${preview.eventId}`, { method: 'PUT', headers, body })
      : fetch('/api/events', { method: 'POST', headers, body }))
  }

  return (
    <div>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={withCalendar ? 'Termin eintragen oder ändern, z. B. „Zahnarzt auf Freitag verschieben“' : 'Termin eintragen, z. B. „Zahnarzt morgen 14 Uhr“'}
            disabled={loading}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
          />
        </div>

        {/* Ohne Browser-Spracherkennung (z. B. iPhone-Homescreen-App) bleibt die Diktier-Taste der Tastatur */}
        {speechSupported && (
          <button
            type="button"
            onClick={toggleMic}
            aria-label={listening ? 'Aufnahme stoppen' : 'Spracherkennung starten'}
            title={listening ? 'Aufnahme stoppen' : 'Spracherkennung starten'}
            className={`p-2.5 rounded-xl border transition-colors shadow-sm ${
              listening
                ? 'border-red-300 bg-red-50 text-red-500'
                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="2" width="6" height="12" rx="3"/>
              <path d="M5 10a7 7 0 0 0 14 0"/>
              <line x1="12" y1="19" x2="12" y2="22"/>
              <line x1="9" y1="22" x2="15" y2="22"/>
            </svg>
          </button>
        )}

        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="px-4 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors shadow-sm disabled:opacity-40"
        >
          {loading ? '…' : 'Hinzufügen'}
        </button>
      </form>
      {error && <p role="status" className="mt-2 text-xs text-red-600">{error}</p>}

      {preview && preview.action !== 'delete' && (
        <EventModal
          mode={preview.action === 'update' ? 'edit' : 'create'}
          heading={preview.action === 'update' ? 'Änderung prüfen' : 'Vorschlag prüfen'}
          note={preview.message}
          previous={preview.action === 'update' ? describe(preview.current) : undefined}
          initial={{
          ...preview.event,
          startTime: toLocalInput(preview.event.startTime),
          endTime: toLocalInput(preview.event.endTime),
          id: preview.action === 'update' ? preview.eventId : undefined,
        }}
          onSave={save}
          onClose={() => setPreview(null)}
        />
      )}

      {preview?.action === 'delete' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setPreview(null)}>
          <div role="dialog" aria-label="Löschen bestätigen" className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Termin löschen?</h2>
            {preview.message && <p className="text-sm text-gray-600 mb-2">{preview.message}</p>}
            <p className="text-sm font-medium text-gray-900 bg-gray-50 rounded-xl px-4 py-3">{describe(preview.current)}</p>
            {preview.current.rrule && <p className="text-xs text-gray-500 mt-2">Das löscht die ganze Serie mit allen Schritten.</p>}
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setPreview(null)} className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100">Abbrechen</button>
              <button
                onClick={() => confirm(() => fetch(`/api/events/${preview.eventId}`, { method: 'DELETE' }))}
                className="px-5 py-2 rounded-xl text-sm bg-red-500 text-white hover:bg-red-600 font-medium"
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
