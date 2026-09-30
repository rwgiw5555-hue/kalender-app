'use client'
import { useRef, useState, useSyncExternalStore } from 'react'

interface Props {
  onEventCreated: () => void
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

export default function NaturalInput({ onEventCreated }: Props) {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setLoading(true)
    setError('')
    try {
      const parseRes = await fetch('/api/parse-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const parsed = await parseRes.json().catch(() => null)
      if (!parseRes.ok) throw new Error(parsed?.error ?? 'Termin nicht erkannt')

      const saveRes = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      })
      if (!saveRes.ok) throw new Error((await saveRes.json().catch(() => null))?.error ?? 'Speichern fehlgeschlagen')

      setText('')
      onEventCreated()
    } catch (err) {
      // fetch wirft TypeError bei fehlender Verbindung (Meldung sonst englisch)
      setError(err instanceof TypeError ? 'Keine Verbindung zum Kalender' : err instanceof Error ? err.message : 'Fehler')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className="relative flex-1">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder='Termin eingeben, z.B. "Zahnarzt morgen 14 Uhr"'
          disabled={loading}
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm"
        />
        {error && <p className="absolute left-0 -bottom-5 text-xs text-red-500">{error}</p>}
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
  )
}
