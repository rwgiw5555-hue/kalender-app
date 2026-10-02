'use client'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Icon from './Icon'
import ProposalReview, { Proposal } from './ProposalReview'
import { useAiContext } from '@/lib/client'

interface Props {
  onChanged: () => void
  // Schmale Spalte (Seitenleiste am PC): Knöpfe unter dem Feld statt daneben
  stacked?: boolean
}

// Ca. 2–3 Minuten Sprache; muss zu MAX_LONG_TEXT in lib/parse.ts passen
const MAX_LENGTH = 6000

// Minimal-Typen für die Web Speech API (nicht in den TypeScript-Standardtypen)
interface RecognitionResult {
  isFinal: boolean
  0: { transcript: string }
}
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: { resultIndex: number; results: ArrayLike<RecognitionResult> }) => void) | null
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

const join = (a: string, b: string) => (a && b ? `${a} ${b}` : a || b)

interface Review {
  transcript: string
  proposals: Proposal[]
  notes: string[]
}

export default function NaturalInput({ onChanged, stacked }: Props) {
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [blocked, setBlocked] = useState(false)
  const [review, setReview] = useState<Review | null>(null)
  const available = useSyncExternalStore(noSubscribe, () => getRecognition() !== null, () => false)
  const speechSupported = available && !blocked
  const withCalendar = useAiContext()

  const recognitionRef = useRef<Recognition | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Aufnahme: Text vor dem aktuellen Erkennungs-Durchgang, gewünschter Zustand, aktueller Text
  const baseRef = useRef('')
  const wantRef = useRef(false)
  const textRef = useRef('')
  const abortRef = useRef(false)
  const submitRef = useRef<(value: string) => void>(() => {})

  function changeText(value: string) {
    textRef.current = value
    setText(value)
  }

  // Eingabefeld wächst mit dem Text (auch am PC), bis es scrollt
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text])

  const submit = useCallback(async (value: string) => {
    const transcript = value.trim()
    if (!transcript) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/parse-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcript, withCalendar }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error ?? 'Nichts erkannt')
      const proposals: Proposal[] = Array.isArray(data?.proposals) ? data.proposals : []
      const notes: string[] = Array.isArray(data?.notes) ? data.notes : []
      // Nichts wird direkt gespeichert: erst die Vorschläge zeigen
      if (proposals.length === 0) setError(notes.join(' ') || 'Darin habe ich keinen Termin und keine Aufgabe gefunden.')
      else setReview({ transcript, proposals, notes })
    } catch (err) {
      // fetch wirft TypeError bei fehlender Verbindung (Meldung sonst englisch)
      setError(err instanceof TypeError ? 'Keine Verbindung zum Kalender' : err instanceof Error ? err.message : 'Fehler')
    } finally {
      setLoading(false)
    }
  }, [withCalendar])
  useEffect(() => { submitRef.current = submit }, [submit])

  function startRecognition() {
    const rec = recognitionRef.current
    if (!rec) return
    baseRef.current = textRef.current.trim()
    try {
      rec.start()
    } catch {
      // läuft bereits
    }
  }

  function toggleMic() {
    if (listening) {
      // Stoppen: Nach dem letzten Ergebnis (onend) wird automatisch ausgewertet
      wantRef.current = false
      recognitionRef.current?.stop()
      return
    }
    if (!recognitionRef.current) {
      const SR = getRecognition()
      if (!SR) return
      const rec = new SR()
      rec.lang = 'de-DE'
      // Längere Sprachnachrichten: weiterhören bis „Stopp“, Zwischenstand anzeigen
      rec.continuous = true
      rec.interimResults = true
      rec.onresult = e => {
        let heard = ''
        for (let i = 0; i < e.results.length; i++) heard += e.results[i][0].transcript
        changeText(join(baseRef.current, heard.trim()).slice(0, MAX_LENGTH))
      }
      rec.onend = () => {
        // Der Browser beendet die Erkennung nach Pausen oder ca. 1 Minute: weitermachen,
        // solange nicht auf Stopp gedrückt wurde
        if (wantRef.current && textRef.current.length < MAX_LENGTH) {
          startRecognition()
          return
        }
        wantRef.current = false
        setListening(false)
        // Nach einem Fehler nichts automatisch abschicken
        if (abortRef.current) abortRef.current = false
        else submitRef.current(textRef.current)
      }
      rec.onerror = e => {
        if (e.error === 'no-speech' || e.error === 'aborted') return // onend startet neu bzw. beendet
        wantRef.current = false
        abortRef.current = true
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          setBlocked(true)
          setError('Mikrofon nicht verfügbar – nutze die Diktier-Taste der Tastatur')
        } else {
          setError('Spracherkennung unterbrochen')
        }
      }
      recognitionRef.current = rec
    }
    setError('')
    wantRef.current = true
    abortRef.current = false
    setListening(true)
    startRecognition()
  }

  // Aufnahme beenden, wenn die Komponente verschwindet (z. B. Seitenwechsel)
  useEffect(() => () => {
    wantRef.current = false
    abortRef.current = true
    recognitionRef.current?.stop()
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (listening) return
    submit(text)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter schickt ab, Umschalt+Enter macht eine neue Zeile
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      if (!listening) submit(text)
    }
  }

  const closeReview = useCallback((changed: boolean) => {
    setReview(null)
    if (changed) {
      changeText('')
      onChanged()
    }
  }, [onChanged])

  return (
    <div>
      <form onSubmit={handleSubmit} className={`flex items-end gap-2 ${stacked ? 'flex-wrap justify-end' : ''}`}>
        <div className={`relative min-w-0 ${stacked ? 'w-full' : 'flex-1'}`}>
          <label htmlFor="natural-input" className="sr-only">Termine und Aufgaben eingeben</label>
          <textarea
            id="natural-input"
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={e => changeText(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={MAX_LENGTH}
            placeholder={listening ? 'Ich höre zu …' : withCalendar
              ? 'Sag oder tippe alles auf einmal: Termine, Aufgaben, Änderungen'
              : 'Sag oder tippe Termine und Aufgaben, auch mehrere auf einmal'}
            disabled={loading}
            className="block w-full min-h-12 max-h-48 lg:max-h-72 resize-none overflow-y-auto bg-surface-2 text-ink placeholder:text-muted border border-transparent rounded-[calc(var(--app-radius)*0.75)] px-4 py-3 text-[15px] leading-6 focus:outline-none focus:border-accent"
          />
        </div>

        {/* Ohne Browser-Spracherkennung (z. B. iPhone-Homescreen-App) bleibt die Diktier-Taste der Tastatur */}
        {speechSupported && (
          <button
            type="button"
            onClick={toggleMic}
            disabled={loading}
            aria-label={listening ? 'Aufnahme stoppen und auswerten' : 'Spracherkennung starten'}
            title={listening ? 'Aufnahme stoppen und auswerten' : 'Spracherkennung starten'}
            className={`w-12 h-12 shrink-0 rounded-[calc(var(--app-radius)*0.75)] flex items-center justify-center transition-colors disabled:opacity-40 ${
              listening ? 'bg-danger text-on-danger animate-pulse' : 'bg-accent text-on-accent hover:opacity-90'
            }`}
          >
            <Icon name="mic" size={22} />
          </button>
        )}

        <button
          type="submit"
          disabled={loading || listening || !text.trim()}
          aria-label="Auswerten"
          title="Auswerten"
          className="w-12 h-12 shrink-0 rounded-[calc(var(--app-radius)*0.75)] bg-surface-2 text-ink flex items-center justify-center hover:bg-line transition-colors disabled:opacity-40"
        >
          {loading ? <span className="text-sm">…</span> : <Icon name="send" size={20} />}
        </button>
      </form>
      {listening && <p role="status" className="mt-2 text-xs text-muted">Sprich einfach drauflos. Zum Auswerten auf das Mikrofon tippen.</p>}
      {loading && <p role="status" className="mt-2 text-xs text-muted">Werte aus …</p>}
      {error && <p role="status" className="mt-2 text-xs text-danger">{error}</p>}

      {review && (
        <ProposalReview transcript={review.transcript} proposals={review.proposals} notes={review.notes} onClose={closeReview} />
      )}
    </div>
  )
}
