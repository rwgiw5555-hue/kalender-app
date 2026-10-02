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
// Automatisch stoppen und auswerten nach so viel Stille (vor dem ersten Wort etwas länger)
const SILENCE_MS = 5000
const FIRST_WORDS_MS = 10000

// Import: PDF und Fotos, höchstens 10 MB (wie in app/api/import-file)
const FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_FILE_BYTES = 10 * 1024 * 1024
// Fotos: Claude nimmt höchstens ca. 3,75 MB; größere oder sehr große Bilder vorher verkleinern
// (Claude rechnet ohnehin mit ca. 1600 px, spart Upload und Kosten)
const MAX_IMAGE_BYTES = 3.5 * 1024 * 1024
const MAX_IMAGE_EDGE = 2000

function readBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

async function shrinkImage(file: File): Promise<{ blob: Blob; type: string }> {
  if (file.type === 'image/gif') return { blob: file, type: file.type }
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size <= MAX_IMAGE_BYTES) {
      bitmap.close()
      return { blob: file, type: file.type }
    }
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const g = canvas.getContext('2d')
    if (g) {
      // Weißer Hintergrund: JPEG kennt keine Transparenz (sonst wird sie schwarz)
      g.fillStyle = '#fff'
      g.fillRect(0, 0, canvas.width, canvas.height)
      g.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    }
    bitmap.close()
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.85))
    return blob ? { blob, type: 'image/jpeg' } : { blob: file, type: file.type }
  } catch {
    return { blob: file, type: file.type }
  }
}

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
  const [busyText, setBusyText] = useState('Werte aus …')
  const [dragging, setDragging] = useState(false)
  // Zähler für dragenter/dragleave: Kindelemente lösen eigene Ereignisse aus (sonst Flackern)
  const dragDepth = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
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
  // Neustart-Kontrolle: automatischer Durchgang?, schon etwas gehört?, Startzeit, sofortige Abbrüche
  const autoRef = useRef(false)
  const heardRef = useRef(false)
  const startedAtRef = useRef(0)
  const quickEndsRef = useRef(0)
  // Stille-Timer läuft über die automatischen Neustarts hinweg; runningRef: Durchgang aktiv?
  const silenceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runningRef = useRef(false)
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

  // Schickt Text oder Datei zur Auswertung und zeigt danach die Vorschlagsliste
  const evaluate = useCallback(async (url: string, body: object, transcript: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, withCalendar }),
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

  const submit = useCallback(async (value: string) => {
    const transcript = value.trim()
    if (!transcript) return
    setBusyText('Werte aus …')
    await evaluate('/api/parse-event', { text: transcript }, transcript)
  }, [evaluate])

  async function importFile(file: File) {
    if (loading || listening) return
    setError('')
    if (!FILE_TYPES.includes(file.type)) {
      setError(/hei[cf]/i.test(file.type || file.name) ? 'HEIC-Fotos bitte als JPG speichern' : 'Nur PDF oder Foto (JPG, PNG, WebP, GIF)')
      return
    }
    setLoading(true)
    setBusyText(`Lese „${file.name}“ …`)
    try {
      const { blob, type } = file.type.startsWith('image/') ? await shrinkImage(file) : { blob: file, type: file.type }
      if (blob.size > (type.startsWith('image/') ? MAX_IMAGE_BYTES : MAX_FILE_BYTES)) {
        setError(type.startsWith('image/') ? 'Foto zu groß (höchstens ca. 3,5 MB)' : 'Datei zu groß (höchstens 10 MB)')
        setLoading(false)
        return
      }
      const data = await readBase64(blob)
      const note = textRef.current.trim()
      await evaluate('/api/import-file', { mediaType: type, data, text: note }, `Datei: ${file.name}${note ? `\n${note}` : ''}`)
    } catch {
      setError('Datei konnte nicht gelesen werden')
      setLoading(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    dragDepth.current = 0
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) importFile(file)
  }
  useEffect(() => { submitRef.current = submit }, [submit])

  // Ein Erkennungs-Durchgang; false, wenn der Browser den Start verweigert
  function startRecognition(auto: boolean): boolean {
    const rec = recognitionRef.current
    if (!rec) return false
    baseRef.current = textRef.current.trim()
    autoRef.current = auto
    heardRef.current = false
    startedAtRef.current = Date.now()
    try {
      rec.start()
      runningRef.current = true
      return true
    } catch {
      return false
    }
  }

  function clearSilence() {
    if (silenceRef.current) clearTimeout(silenceRef.current)
    silenceRef.current = null
  }

  // Nach `ms` ohne neues Wort selbst auf Stopp drücken
  function armSilence(ms: number) {
    clearSilence()
    silenceRef.current = setTimeout(() => {
      silenceRef.current = null
      if (!wantRef.current) return
      wantRef.current = false
      // Zwischen zwei Durchgängen läuft keine Erkennung, dann kommt kein onend mehr
      if (runningRef.current) recognitionRef.current?.stop()
      else finish()
    }, ms)
  }

  // Aufnahme ist zu Ende: auswerten, außer nach einem Fehler
  function finish() {
    clearSilence()
    wantRef.current = false
    setListening(false)
    if (abortRef.current) abortRef.current = false
    else submitRef.current(textRef.current)
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
      // Längere Sprachnachrichten: weiterhören bis „Stopp“, Zwischenstand anzeigen.
      // Chrome auf Android liefert im Dauerbetrieb doppelte Ergebnisse; dort Satz für
      // Satz erkennen und automatisch neu starten.
      rec.continuous = !/Android/i.test(navigator.userAgent)
      rec.interimResults = true
      rec.onresult = e => {
        heardRef.current = true
        if (wantRef.current) armSilence(SILENCE_MS)
        let heard = ''
        for (let i = 0; i < e.results.length; i++) heard += e.results[i][0].transcript
        const value = join(baseRef.current, heard.trim())
        changeText(value.slice(0, MAX_LENGTH))
        if (value.length >= MAX_LENGTH && wantRef.current) {
          // Längenlimit erreicht: nichts mehr still verwerfen, sondern auswerten
          wantRef.current = false
          setError('Maximale Länge erreicht – der Rest bitte in einer zweiten Nachricht.')
          rec.stop()
        }
      }
      rec.onend = () => {
        runningRef.current = false
        // Der Browser beendet die Erkennung nach Pausen oder ca. 1 Minute: weitermachen,
        // solange nicht auf Stopp gedrückt wurde. Endet ein Durchgang mehrmals sofort
        // ohne Ergebnis, aufhören statt endlos neu zu starten.
        if (wantRef.current) {
          const quick = !heardRef.current && Date.now() - startedAtRef.current < 1500
          quickEndsRef.current = quick ? quickEndsRef.current + 1 : 0
          if (quickEndsRef.current < 3 && startRecognition(true)) return
        }
        finish()
      }
      rec.onerror = e => {
        if (e.error === 'no-speech' || e.error === 'aborted') return // onend startet neu bzw. beendet
        wantRef.current = false
        if ((e.error === 'not-allowed' || e.error === 'service-not-allowed') && autoRef.current) {
          // Neustart ohne Tippen verweigert (z. B. Safari): Aufnahme normal beenden und auswerten
          return
        }
        abortRef.current = true
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
          setBlocked(true)
          setError('Mikrofon nicht verfügbar – nutze die Diktier-Taste der Tastatur')
        } else {
          setError('Spracherkennung unterbrochen – der Text bleibt stehen, mit dem Pfeil auswerten')
        }
      }
      recognitionRef.current = rec
    }
    setError('')
    wantRef.current = true
    abortRef.current = false
    quickEndsRef.current = 0
    setListening(true)
    if (!startRecognition(false)) {
      wantRef.current = false
      setListening(false)
      setError('Spracherkennung ließ sich nicht starten')
      return
    }
    armSilence(FIRST_WORDS_MS)
  }

  // Daneben fallen gelassene Dateien nicht vom Browser öffnen lassen (sonst ist die App weg)
  useEffect(() => {
    const block = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault()
    }
    window.addEventListener('dragover', block)
    window.addEventListener('drop', block)
    return () => {
      window.removeEventListener('dragover', block)
      window.removeEventListener('drop', block)
    }
  }, [])

  // Aufnahme beenden, wenn die Komponente verschwindet (z. B. Seitenwechsel)
  useEffect(() => () => {
    clearSilence()
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
    textareaRef.current?.focus()
    if (changed) {
      changeText('')
      onChanged()
    }
  }, [onChanged])

  return (
    <div
      // Am PC: Datei aufs Eingabefeld ziehen
      onDragEnter={e => {
        if (!e.dataTransfer.types.includes('Files')) return
        dragDepth.current++
        if (!loading && !listening) setDragging(true)
      }}
      onDragOver={e => {
        if (e.dataTransfer.types.includes('Files')) e.preventDefault()
      }}
      onDragLeave={e => {
        if (!e.dataTransfer.types.includes('Files')) return
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) setDragging(false)
      }}
      onDrop={handleDrop}
      className={`rounded-[calc(var(--app-radius)*0.75)] transition-shadow ${dragging ? 'ring-2 ring-accent ring-offset-4 ring-offset-bg' : ''}`}
    >
      {/* Schmal (Seitenleiste, Handy): Feld über die ganze Breite, Knöpfe darunter */}
      <form onSubmit={handleSubmit} className={`flex items-end gap-2 ${stacked ? 'flex-wrap justify-end' : 'max-sm:flex-wrap max-sm:justify-end'}`}>
        <div className={`relative min-w-0 ${stacked ? 'w-full' : 'flex-1 max-sm:flex-none max-sm:w-full'}`}>
          <label htmlFor="natural-input" className="sr-only">Termine und Aufgaben eingeben</label>
          <textarea
            id="natural-input"
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={e => changeText(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={MAX_LENGTH}
            placeholder={dragging ? 'Datei hier loslassen zum Importieren' : listening ? 'Ich höre zu …' : withCalendar
              ? 'Sag oder tippe alles auf einmal: Termine, Aufgaben, Änderungen'
              : 'Sag oder tippe Termine und Aufgaben, auch mehrere auf einmal'}
            disabled={loading}
            // Während der Aufnahme schreibt die Erkennung ins Feld; Tippen ginge dabei verloren
            readOnly={listening}
            className="block w-full min-h-12 max-h-48 lg:max-h-72 resize-none overflow-y-auto bg-surface-2 text-ink placeholder:text-muted border border-transparent rounded-[calc(var(--app-radius)*0.75)] px-4 py-3 text-[15px] leading-6 focus:outline-none focus:border-accent"
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={FILE_TYPES.join(',')}
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) importFile(file)
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading || listening}
          aria-label="Datei importieren (PDF oder Foto)"
          title="Datei importieren (PDF oder Foto)"
          className="w-12 h-12 shrink-0 rounded-[calc(var(--app-radius)*0.75)] bg-surface-2 text-ink flex items-center justify-center hover:bg-line transition-colors disabled:opacity-40"
        >
          <Icon name="file" size={20} />
        </button>

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
      {listening && <p role="status" className="mt-2 text-xs text-muted">Sprich einfach drauflos. Nach 5 Sekunden Stille wird automatisch ausgewertet, oder tippe auf das Mikrofon.</p>}
      {loading && <p role="status" className="mt-2 text-xs text-muted">{busyText}</p>}
      {error && <p role="status" className="mt-2 text-xs text-danger">{error}</p>}

      {review && (
        <ProposalReview transcript={review.transcript} proposals={review.proposals} notes={review.notes} onClose={closeReview} />
      )}
    </div>
  )
}
