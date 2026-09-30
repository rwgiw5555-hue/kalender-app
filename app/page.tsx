'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import AppShell from '@/components/AppShell'
import CalendarView from '@/components/Calendar'
import MiniMonth from '@/components/MiniMonth'
import NaturalInput from '@/components/NaturalInput'
import TaskList from '@/components/TaskList'
import { DbEvent, useDay, useToday } from '@/lib/day'

function useClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    function tick() {
      setTime(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }))
    }
    tick()
    const id = setInterval(tick, 10000)
    return () => clearInterval(id)
  }, [])
  return time
}

export default function Home() {
  const [events, setEvents] = useState<DbEvent[]>([])
  const [version, setVersion] = useState(0)
  const [focusDate, setFocusDate] = useState<string | null>(null)
  const today = useToday()
  const clock = useClock()
  // Tagesliste in der Seitenleiste lädt mit, wenn sich im Kalender etwas ändert
  const day = useDay(today, version)
  const loadEvents = () => setVersion(v => v + 1)

  useEffect(() => {
    let cancelled = false
    fetch('/api/events')
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (!cancelled && Array.isArray(data)) setEvents(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [version])

  const openCount = day.tasks.filter(t => !t.done).length

  const sidebar = (
    <>
      <p className="-mt-3 text-sm text-muted tabular-nums">{clock}</p>
      <div>
        <h2 className="text-sm font-semibold text-muted mb-2">Neuer Termin</h2>
        <NaturalInput onChanged={loadEvents} />
      </div>
      {today && <MiniMonth today={today} selected={focusDate} onSelect={setFocusDate} />}
      <section aria-labelledby="sidebar-day" className="rounded-[var(--app-radius)] bg-surface-2 px-4 py-3">
        <div className="flex items-baseline justify-between mb-1">
          <h2 id="sidebar-day" className="font-head font-bold">
            <Link href="/heute" className="text-ink hover:text-accent">Mein Tag</Link>
          </h2>
          <span className="text-xs text-muted">{day.tasks.length === 0 ? 'nichts offen' : `${openCount} offen`}</span>
        </div>
        {day.tasks.length > 0 && (
          <TaskList tasks={day.tasks} pending={day.pending} onToggle={day.toggle} compact />
        )}
        <Link href="/heute" className="inline-block mt-2 text-sm font-semibold text-accent hover:underline">Ganzen Tag ansehen</Link>
      </section>
    </>
  )

  return (
    <AppShell active="kalender" sidebar={sidebar}>
      <div className="lg:hidden px-4 pt-3">
        <NaturalInput onChanged={loadEvents} />
      </div>
      <CalendarView events={events} onRefresh={loadEvents} focusDate={focusDate} />
    </AppShell>
  )
}
