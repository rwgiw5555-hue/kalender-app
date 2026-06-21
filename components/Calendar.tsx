'use client'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin, { DateClickArg, EventResizeDoneArg } from '@fullcalendar/interaction'
import { EventClickArg, EventDropArg, EventInput } from '@fullcalendar/core'
import { useRef, useState, useEffect, useCallback } from 'react'
import EventModal, { EventFormData } from './EventModal'
import { CalendarTheme } from './SettingsPanel'
import { getHolidaysForRange } from '@/lib/holidays'

const CATEGORY_COLORS: Record<string, string> = {
  Arbeit: '#3b82f6',
  Privat: '#10b981',
  Sport: '#f59e0b',
  Sonstiges: '#8b5cf6',
}

interface DbEvent {
  id: number
  title: string
  description?: string | null
  startTime: string
  endTime: string
  category?: string | null
  color?: string | null
}

interface Props {
  events: DbEvent[]
  onRefresh: () => void
  theme: CalendarTheme
}

const HOLIDAYS = getHolidaysForRange(2024, 2027)

function toFcEvents(events: DbEvent[]): EventInput[] {
  return events.map(e => ({
    id: String(e.id),
    title: e.title,
    start: e.startTime,
    end: e.endTime,
    backgroundColor: e.color ?? CATEGORY_COLORS[e.category ?? 'Sonstiges'] ?? '#8b5cf6',
    borderColor: 'transparent',
    extendedProps: { description: e.description, category: e.category },
  }))
}

function pad(n: number) { return String(n).padStart(2, '0') }
function toLocalISO(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function Calendar({ events, onRefresh, theme }: Props) {
  const calRef = useRef<FullCalendar>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; initial: Partial<EventFormData> } | null>(null)
  const dragging = useRef(false)
  const drawTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const scheduleDraw = useCallback(() => {
    if (drawTimer.current) clearTimeout(drawTimer.current)
    drawTimer.current = setTimeout(() => {}, 80)
  }, [])

  function handleDateClick(arg: DateClickArg) {
    const start = new Date(arg.date)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    setModal({ mode: 'create', initial: { startTime: toLocalISO(start), endTime: toLocalISO(end) } })
  }

  function handleEventClick(arg: EventClickArg) {
    if (dragging.current) return
    if (arg.event.display === 'background') return
    const ev = arg.event
    setModal({
      mode: 'edit',
      initial: {
        id: Number(ev.id),
        title: ev.title,
        description: ev.extendedProps.description ?? '',
        startTime: toLocalISO(ev.start!),
        endTime: toLocalISO(ev.end ?? new Date(ev.start!.getTime() + 3600000)),
        category: ev.extendedProps.category ?? 'Sonstiges',
      }
    })
  }

  async function handleDrop(arg: EventDropArg) {
    dragging.current = true
    setTimeout(() => { dragging.current = false }, 300)
    const end = arg.event.end ?? new Date(arg.event.start!.getTime() + 3600000)
    await fetch(`/api/events/${arg.event.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startTime: arg.event.start!.toISOString(), endTime: end.toISOString() }),
    })
    onRefresh()
  }

  async function handleResize(arg: EventResizeDoneArg) {
    await fetch(`/api/events/${arg.event.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startTime: arg.event.start!.toISOString(), endTime: arg.event.end!.toISOString() }),
    })
    onRefresh()
  }

  async function handleSave(data: EventFormData) {
    if (modal?.mode === 'edit' && data.id) {
      await fetch(`/api/events/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: data.title, description: data.description, startTime: data.startTime, endTime: data.endTime, category: data.category }),
      })
    } else {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: data.title, description: data.description, startTime: data.startTime, endTime: data.endTime, category: data.category }),
      })
    }
    setModal(null)
    onRefresh()
  }

  async function handleDelete() {
    if (!modal?.initial.id) return
    await fetch(`/api/events/${modal.initial.id}`, { method: 'DELETE' })
    setModal(null)
    onRefresh()
  }

  return (
    <>
      <style>{`
        :root {
          --cal-accent: ${theme.accent};
          --cal-slot-bg: ${theme.slotBg};
          --cal-slot-alt: ${theme.slotAltBg};
          --cal-grid: ${theme.gridLine};
        }
      `}</style>

      <div ref={containerRef} className="flex-1 h-full overflow-hidden px-3 pt-2 pb-24">
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          locale="de"
          firstDay={1}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          buttonText={{ today: 'Heute', month: 'Monat', week: 'Woche', day: 'Tag' }}
          slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          slotDuration="00:30:00"
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          events={[...toFcEvents(events), ...HOLIDAYS]}
          editable
          droppable
          selectable
          nowIndicator
          eventDragMinDistance={10}
          scrollTime="07:00:00"
          datesSet={scheduleDraw}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          eventDrop={handleDrop}
          eventResize={handleResize}
          height="100%"
          eventDisplay="block"
          eventBorderColor="transparent"
        />
      </div>

      {modal && (
        <EventModal
          mode={modal.mode}
          initial={modal.initial}
          onSave={handleSave}
          onDelete={modal.mode === 'edit' ? handleDelete : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </>
  )
}
