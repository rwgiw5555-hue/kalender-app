'use client'
import { useRef, useState, useSyncExternalStore } from 'react'
import EventModal, { EventFormData } from './EventModal'
import Icon from './Icon'
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
  timeZone: TIME_ZONE, weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
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
  const [saving, setSaving] = useState(false)

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
    // Doppelklick: nur eine Anfrage gleichzeitig
    if (saving) return
    setSaving(true)
    const res = await request().catch(() => null)
    setSaving(false)
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
            className="w-full h-12 bg-surface-2 text-ink placeholder:text-muted border border-transparent rounded-[calc(var(--app-radius)*0.75)] px-4 text-[15px] focus:outline-none focus:border-accent"
          />
        </div>

        {/* Ohne Browser-Spracherkennung (z. B. iPhone-Homescreen-App) bleibt die Diktier-Taste der Tastatur */}
        {speechSupported && (
          <button
            type="button"
            onClick={toggleMic}
            aria-label={listening ? 'Aufnahme stoppen' : 'Spracherkennung starten'}
            title={listening ? 'Aufnahme stoppen' : 'Spracherkennung starten'}
            className={`w-12 h-12 shrink-0 rounded-[calc(var(--app-radius)*0.75)] flex items-center justify-center transition-colors ${
              listening ? 'bg-danger text-white animate-pulse' : 'bg-accent text-on-accent hover:opacity-90'
            }`}
          >
            <Icon name="mic" size={22} />
          </button>
        )}

        <button
          type="submit"
          disabled={loading || !text.trim()}
          aria-label="Hinzufügen"
          title="Hinzufügen"
          className="w-12 h-12 shrink-0 rounded-[calc(var(--app-radius)*0.75)] bg-surface-2 text-ink flex items-center justify-center hover:bg-line transition-colors disabled:opacity-40"
        >
          {loading ? <span className="text-sm">…</span> : <Icon name="send" size={20} />}
        </button>
      </form>
      {error && <p role="status" className="mt-2 text-xs text-danger">{error}</p>}

      {preview && preview.action !== 'delete' && (
        <EventModal
          mode={preview.action === 'update' ? 'edit' : 'create'}
          heading={preview.action === 'update' ? 'Änderung prüfen' : 'Vorschlag prüfen'}
          note={preview.action === 'update' && preview.current.rrule
          ? `${preview.message} Achtung: Das ändert die ganze Serie, nicht nur einen Termin.`
          : preview.message}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={() => setPreview(null)}>
          <div role="dialog" aria-label="Löschen bestätigen" className="bg-surface text-ink rounded-[var(--app-radius)] shadow-2xl w-full max-w-md mx-4 p-6 animate-scale-in" onClick={e => e.stopPropagation()}>
            <h2 className="font-head text-lg font-bold mb-3">Termin löschen?</h2>
            {preview.message && <p className="text-sm text-muted mb-2">{preview.message}</p>}
            <p className="text-sm font-semibold bg-surface-2 rounded-[calc(var(--app-radius)*0.6)] px-4 py-3">{describe(preview.current)}</p>
            {preview.current.rrule && <p className="text-xs text-muted mt-2">Das löscht die ganze Serie mit allen Schritten.</p>}
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setPreview(null)} className="h-11 px-4 rounded-[calc(var(--app-radius)*0.6)] text-sm font-semibold text-muted hover:bg-surface-2">Abbrechen</button>
              <button
                onClick={() => confirm(() => fetch(`/api/events/${preview.eventId}`, { method: 'DELETE' }))}
              disabled={saving}
                className="h-11 px-5 rounded-[calc(var(--app-radius)*0.6)] text-sm bg-danger text-white hover:opacity-90 font-semibold"
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
