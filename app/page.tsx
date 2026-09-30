'use client'
import Link from 'next/link'
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import CalendarView, { alertSaveError } from '@/components/Calendar'
import EventModal, { EventFormData } from '@/components/EventModal'
import SettingsPanel, { CalendarTheme, PRESETS } from '@/components/SettingsPanel'

export interface DbEvent {
  id: number
  title: string
  description?: string | null
  startTime: string
  endTime: string
  category?: string | null
  color?: string | null
  rrule?: string | null
}

const DEFAULT_THEME = PRESETS[0].theme

const THEME_VERSION = '2'

const THEME_EVENT = 'cal-theme-change'
const HEX = /^#[0-9a-fA-F]{3,8}$/

// Gespeichertes Theme als Text (stabil für useSyncExternalStore)
function readStoredTheme(): string | null {
  try {
    // Versionsprüfung — bei neuer Version altes Theme verwerfen
    if (localStorage.getItem('cal-theme-version') !== THEME_VERSION) {
      localStorage.removeItem('cal-theme')
      localStorage.setItem('cal-theme-version', THEME_VERSION)
    }
    return localStorage.getItem('cal-theme')
  } catch {
    return null
  }
}

function subscribeTheme(cb: () => void) {
  window.addEventListener(THEME_EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(THEME_EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

// Nur gültige Farben übernehmen: die Werte landen direkt im CSS
function parseTheme(raw: string | null): CalendarTheme {
  try {
    const t = raw ? JSON.parse(raw) : null
    if (t && ['accent', 'slotBg', 'slotAltBg', 'gridLine'].every(k => typeof t[k] === 'string' && HEX.test(t[k]))) {
      return { accent: t.accent, slotBg: t.slotBg, slotAltBg: t.slotAltBg, gridLine: t.gridLine }
    }
  } catch {}
  return DEFAULT_THEME
}

function useClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    function tick() {
      setTime(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

export default function Home() {
  const [events, setEvents] = useState<DbEvent[]>([])
  const [addModal, setAddModal] = useState(false)
  const [settings, setSettings] = useState(false)
  const storedTheme = useSyncExternalStore(subscribeTheme, readStoredTheme, () => null)
  const theme = useMemo(() => parseTheme(storedTheme), [storedTheme])
  const clock = useClock()

  function applyTheme(t: CalendarTheme) {
    try {
      localStorage.setItem('cal-theme', JSON.stringify(t))
    } catch {}
    window.dispatchEvent(new Event(THEME_EVENT))
  }

  useEffect(() => {
    document.body.setAttribute('data-theme', theme.slotBg.startsWith('#0') || theme.slotBg.startsWith('#1') ? 'dark' : 'light')
  }, [theme.slotBg])

  const [version, setVersion] = useState(0)
  const loadEvents = () => setVersion(v => v + 1)

  useEffect(() => {
    let cancelled = false
    fetch('/api/events')
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (!cancelled && Array.isArray(data)) setEvents(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [version])

  async function handleSave(data: EventFormData) {
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) return alertSaveError(res)
    setAddModal(false)
    loadEvents()
  }

  return (
    <div className="relative flex flex-col h-screen overflow-hidden" style={{ background: theme.slotBg }}>

      {/* Kopfzeile mit Uhrzeit + Zahnrad */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1 shrink-0">
        {/* Digitale Uhrzeit links */}
        <div className="flex items-center gap-2">
          <span className="text-2xl font-semibold tabular-nums tracking-tight" style={{ color: theme.accent }}>
            {clock}
          </span>
        </div>

        <div className="flex items-center gap-1">
        <Link
          href="/heute"
          className="px-3 h-9 rounded-full flex items-center text-sm font-medium hover:bg-gray-100 transition-colors"
          style={{ color: theme.accent }}
        >
          Mein Tag
        </Link>

        {/* Zahnrad rechts — weit weg von den FullCalendar-Buttons */}
        <button
          onClick={() => setSettings(true)}
          className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Einstellungen"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
        </div>
      </div>

      <CalendarView events={events} onRefresh={loadEvents} theme={theme} />

      {/* + Button unten mittig */}
      <button
        onClick={() => setAddModal(true)}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 w-14 h-14 rounded-full text-white shadow-xl active:scale-95 transition-all flex items-center justify-center"
        style={{ backgroundColor: theme.accent }}
        aria-label="Neuer Termin"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {addModal && (
        <EventModal mode="create" initial={{}} onSave={handleSave} onClose={() => setAddModal(false)} />
      )}

      {settings && (
        <SettingsPanel theme={theme} onChange={applyTheme} onClose={() => setSettings(false)} />
      )}
    </div>
  )
}
