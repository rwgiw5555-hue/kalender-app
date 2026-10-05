'use client'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import rrulePlugin from '@fullcalendar/rrule'
import interactionPlugin, { DateClickArg, EventResizeDoneArg } from '@fullcalendar/interaction'
import { DatesSetArg, DayHeaderContentArg, EventClickArg, EventDropArg, EventInput, EventMountArg } from '@fullcalendar/core'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import EventModal, { EventFormData } from './EventModal'
import Icon from './Icon'
import { getHolidaysForRange } from '@/lib/holidays'
import { parseRecurrence } from '@/lib/recurrence'
import { alertSaveError } from '@/lib/client'
import type { DbEvent } from '@/lib/day'

interface Props {
  events: DbEvent[]
  onRefresh: () => void
  // Sprungziel, z. B. aus dem Mini-Monat; `n` zählt hoch, damit auch derselbe Tag erneut springt
  focus?: { date: string; n: number } | null
  // Hochzählen öffnet den Dialog „Neuer Termin“ (z. B. aus dem +-Knopf am Handy)
  createRequest?: number
}

// Schmaler Bildschirm (Handy): kompaktere Monatsansicht, Tag antippen öffnet den Tag
const NARROW = '(max-width: 639px)'
function subscribeNarrow(cb: () => void) {
  const mq = window.matchMedia(NARROW)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}
function useNarrow() {
  return useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW).matches, () => false)
}

const HOLIDAYS = getHolidaysForRange(2024, 2030)
const CATEGORIES = ['Privat', 'Arbeit', 'Sport', 'Sonstiges']
const weekdayFmt = new Intl.DateTimeFormat('de-DE', { weekday: 'short' })

const VIEWS = [
  { key: 'timeGridDay', label: 'Tag' },
  { key: 'timeGridWeek', label: 'Woche' },
  { key: 'dayGridMonth', label: 'Monat' },
]

function pad(n: number) { return String(n).padStart(2, '0') }
function toLocalISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Farben kommen über CSS-Klassen je Kategorie (cat-privat …), damit ein Stilwechsel sofort greift
function categoryClass(category: string | null | undefined) {
  const c = CATEGORIES.includes(category ?? '') ? category! : 'Sonstiges'
  return `cat-${c.toLowerCase()}`
}

function toFcEvents(events: DbEvent[]): EventInput[] {
  return events.map(e => {
    const base: EventInput = {
      id: String(e.id),
      title: e.title,
      classNames: ['cal-event', categoryClass(e.category)],
      extendedProps: { description: e.description, category: e.category, color: e.color, seriesStart: e.startTime, seriesEnd: e.endTime, rrule: null, taskTitle: e.taskTitle ?? null },
    }
    const recurrence = parseRecurrence(e.rrule)
    if (!recurrence.ok || !recurrence.value) return { ...base, start: e.startTime, end: e.endTime }

    // Routine: dtstart ohne Zeitzone, damit FullCalendar die Wochentage in lokaler Zeit rechnet
    const start = new Date(e.startTime)
    const { until, ...rule } = recurrence.value
    // Ausgelassene Vorkommen (eingeplante Aufgabe erledigt) zur selben Uhrzeit wie dtstart
    const time = toLocalISO(start).slice(10)
    const exdate = (e.exdates ?? []).map(d => d + time)
    return {
      ...base,
      rrule: { ...rule, dtstart: toLocalISO(start), ...(until ? { until: `${until}T23:59` } : {}) },
      ...(exdate.length ? { exdate } : {}),
      duration: { milliseconds: Math.max(new Date(e.endTime).getTime() - start.getTime(), 0) },
      // Einzelne Vorkommen nicht verschieben: das würde die ganze Serie versetzen
      editable: false,
      extendedProps: { ...base.extendedProps, rrule: recurrence.value },
    }
  })
}

// Eigene Farbe eines Termins (statt Kategoriefarbe)
function handleEventMount(arg: EventMountArg) {
  const color = arg.event.extendedProps.color
  if (typeof color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(color)) {
    arg.el.style.setProperty('--ev-color', color)
    arg.el.style.setProperty('--ev-soft', `color-mix(in srgb, ${color} 18%, var(--app-surface))`)
  }
}

function dayHeader(arg: DayHeaderContentArg) {
  const day = weekdayFmt.format(arg.date).replace('.', '')
  if (arg.view.type === 'dayGridMonth') return <span className="cal-head-day">{day}</span>
  return (
    <>
      <span className="cal-head-day">{day}</span>
      <span className="cal-head-num">{arg.date.getDate()}</span>
    </>
  )
}

export default function Calendar({ events, onRefresh, focus, createRequest }: Props) {
  const calRef = useRef<FullCalendar>(null)
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; initial: Partial<EventFormData>; note?: string } | null>(null)
  const [view, setView] = useState({ title: '', type: 'timeGridWeek' })
  const dragging = useRef(false)
  const narrow = useNarrow()
  // Fokus nach dem Schließen des Dialogs dorthin zurück, wo er vorher war
  const returnFocus = useRef<HTMLElement | null>(null)
  const modalOpen = modal !== null
  useEffect(() => {
    if (!modalOpen && returnFocus.current?.isConnected) {
      returnFocus.current.focus()
      returnFocus.current = null
    }
  }, [modalOpen])
  // Beim Öffnen merken (vor dem Dialog-Effekt, der den Fokus ins Titelfeld setzt)
  function openModal(m: NonNullable<typeof modal>) {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setModal(m)
  }

  // Auf schmalen Bildschirmen mit der Tagesansicht starten
  useEffect(() => {
    if (window.innerWidth < 640) calRef.current?.getApi().changeView('timeGridDay')
  }, [])

  useEffect(() => {
    if (focus) calRef.current?.getApi().gotoDate(focus.date)
  }, [focus])

  useEffect(() => {
    if (createRequest) newEvent()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur auf neue Anfragen reagieren
  }, [createRequest])

  const api = () => calRef.current?.getApi()

  function handleDatesSet(arg: DatesSetArg) {
    setView({ title: arg.view.title, type: arg.view.type })
  }

  function openCreate(start: Date) {
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    openModal({ mode: 'create', initial: { startTime: toLocalISO(start), endTime: toLocalISO(end) } })
  }

  function handleDateClick(arg: DateClickArg) {
    // Handy, Monatsansicht: Tag antippen zeigt den Tag (wie im iPhone-Kalender)
    if (narrow && arg.view.type === 'dayGridMonth') return api()?.changeView('timeGridDay', arg.date)
    openCreate(new Date(arg.date))
  }

  function handleEventClick(arg: EventClickArg) {
    if (dragging.current) return
    if (arg.event.classNames.includes('cal-holiday')) return
    const ev = arg.event
    const rrule = ev.extendedProps.rrule ?? null
    // Bei Routinen die Serie bearbeiten, nicht das angeklickte Vorkommen
    const start = rrule ? new Date(ev.extendedProps.seriesStart) : ev.start!
    const end = rrule ? new Date(ev.extendedProps.seriesEnd) : ev.end ?? new Date(ev.start!.getTime() + 3600000)
    openModal({
      mode: 'edit',
      initial: {
        id: Number(ev.id),
        title: ev.title,
        description: ev.extendedProps.description ?? '',
        startTime: toLocalISO(start),
        endTime: toLocalISO(end),
        category: ev.extendedProps.category ?? 'Sonstiges',
        rrule,
      },
      note: ev.extendedProps.taskTitle
        ? `Geplant für die Aufgabe „${ev.extendedProps.taskTitle}“. Ist sie abgehakt, wird der Termin ausgeblendet.`
        : undefined,
    })
  }

  async function saveTimes(id: string, start: Date, end: Date, revert: () => void) {
    const res = await fetch(`/api/events/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startTime: start.toISOString(), endTime: end.toISOString() }),
    }).catch(() => null)
    // Bei Fehler Termin zurücksetzen und Grund zeigen, statt still zurückzuspringen
    if (!res?.ok) {
      revert()
      if (res) await alertSaveError(res)
      else window.alert('Speichern fehlgeschlagen: keine Verbindung')
    }
    onRefresh()
  }

  function handleDrop(arg: EventDropArg) {
    dragging.current = true
    setTimeout(() => { dragging.current = false }, 300)
    const end = arg.event.end ?? new Date(arg.event.start!.getTime() + 3600000)
    saveTimes(arg.event.id, arg.event.start!, end, arg.revert)
  }

  function handleResize(arg: EventResizeDoneArg) {
    saveTimes(arg.event.id, arg.event.start!, arg.event.end!, arg.revert)
  }

  async function handleSave(data: EventFormData) {
    const body = JSON.stringify({ title: data.title, description: data.description, startTime: data.startTime, endTime: data.endTime, category: data.category, rrule: data.rrule })
    const headers = { 'Content-Type': 'application/json' }
    const res = modal?.mode === 'edit' && data.id
      ? await fetch(`/api/events/${data.id}`, { method: 'PUT', headers, body })
      : await fetch('/api/events', { method: 'POST', headers, body })
    // Bei Fehler Dialog offen lassen, damit die Eingabe nicht verloren geht
    if (!res.ok) return alertSaveError(res)
    setModal(null)
    onRefresh()
  }

  async function handleDelete() {
    if (!modal?.initial.id) return
    await fetch(`/api/events/${modal.initial.id}`, { method: 'DELETE' })
    setModal(null)
    onRefresh()
  }

  // Neuer Termin: in der angezeigten Zeitspanne mit heute die nächste volle Stunde,
  // sonst der erste angezeigte Tag um 9 Uhr
  function newEvent() {
    const now = new Date()
    const v = api()?.view
    if (v && (now < v.currentStart || now >= v.currentEnd)) {
      const d = new Date(v.currentStart)
      d.setHours(9, 0, 0, 0)
      return openCreate(d)
    }
    now.setMinutes(0, 0, 0)
    now.setHours(now.getHours() + 1)
    openCreate(now)
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Handy: Titel, Heute und Pfeile in einer Zeile, darunter die Ansicht; neuer Termin über den +-Knopf */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-2 sm:gap-2 px-4 lg:px-6 pt-2 pb-2 sm:pt-3 sm:pb-3">
        <button type="button" onClick={() => api()?.today()} className="order-2 sm:order-none h-8 sm:h-9 px-3 sm:px-3.5 rounded-full border border-line bg-surface text-sm font-semibold hover:bg-surface-2">
          Heute
        </button>
        <button type="button" onClick={() => api()?.prev()} aria-label="Zurück" className="order-3 sm:order-none w-9 h-9 rounded-full flex items-center justify-center hover:bg-surface">
          <Icon name="left" size={20} />
        </button>
        <button type="button" onClick={() => api()?.next()} aria-label="Weiter" className="order-4 sm:order-none w-9 h-9 rounded-full flex items-center justify-center hover:bg-surface">
          <Icon name="right" size={20} />
        </button>
        <h1 className="order-1 sm:order-none flex-1 min-w-0 truncate sm:flex-none sm:mr-auto font-head text-xl lg:text-2xl font-bold">{view.title}</h1>
        <div className="order-5 sm:order-none w-full sm:w-auto grid grid-cols-3 sm:flex gap-1 p-1 rounded-full border border-line bg-surface" role="group" aria-label="Ansicht">
          {VIEWS.map(v => (
            <button
              key={v.key}
              type="button"
              aria-pressed={view.type === v.key}
              onClick={() => api()?.changeView(v.key)}
              className={`h-8 px-3 rounded-full text-sm font-semibold transition-colors ${view.type === v.key ? 'bg-accent text-on-accent' : 'text-muted hover:text-ink'}`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={newEvent} className="hidden lg:flex h-9 pl-2.5 pr-3.5 rounded-full bg-accent text-on-accent text-sm font-semibold items-center gap-1.5 hover:opacity-90">
          <Icon name="plus" size={18} />
          Neuer Termin
        </button>
      </div>

      <div className="flex-1 min-h-0 px-2 lg:px-4 pb-2">
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, rrulePlugin]}
          initialView="timeGridWeek"
          locale="de"
          firstDay={1}
          headerToolbar={false}
          dayHeaderContent={dayHeader}
          allDayText="ganztags"
          slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          slotDuration="00:30:00"
          events={[...toFcEvents(events), ...HOLIDAYS]}
          editable
          selectable
          nowIndicator
          eventDragMinDistance={10}
          scrollTime="07:00:00"
          datesSet={handleDatesSet}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          eventDrop={handleDrop}
          eventResize={handleResize}
          eventDidMount={handleEventMount}
          height="100%"
          eventDisplay="block"
          // Handy: im Monat nur Titel und höchstens 3 Zeilen pro Tag, „+ mehr“ öffnet den Tag;
          // in der Woche kurzer Titel ohne Jahr und Termintitel statt abgeschnittener Uhrzeiten
          views={{
            dayGridMonth: { displayEventTime: !narrow, dayMaxEventRows: narrow ? 3 : false },
            timeGridWeek: narrow ? { displayEventTime: false, titleFormat: { day: 'numeric', month: 'short' } } : {},
          }}
          moreLinkClick="timeGridDay"
          moreLinkContent={arg => `+${arg.num} mehr`}
        />
      </div>

      {modal && (
        <EventModal
          mode={modal.mode}
          initial={modal.initial}
          note={modal.note}
          onSave={handleSave}
          onDelete={modal.mode === 'edit' ? handleDelete : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  )
}
