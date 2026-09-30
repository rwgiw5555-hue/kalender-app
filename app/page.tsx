'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import AppShell from '@/components/AppShell'
import CalendarView from '@/components/Calendar'
import MiniMonth from '@/components/MiniMonth'
import NaturalInput from '@/components/NaturalInput'
import TaskList from '@/components/TaskList'
import { useDay, useToday } from '@/lib/day'

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
  const [focus, setFocus] = useState<{ date: string; n: number } | null>(null)
  const today = useToday()
  const clock = useClock()
  // Eine Abfrage für Kalender und Tagesliste in der Seitenleiste
  const day = useDay(today)
  const loadEvents = day.reload

  const openCount = day.tasks.filter(t => !t.done).length

  const sidebar = (
    <>
      <p className="-mt-3 text-sm text-muted tabular-nums">{clock}</p>
      <div>
        <h2 className="text-sm font-semibold text-muted mb-2">Neuer Termin</h2>
        <NaturalInput onChanged={loadEvents} />
      </div>
      {today && <MiniMonth today={today} selected={focus?.date ?? null} onSelect={date => setFocus(f => ({ date, n: (f?.n ?? 0) + 1 }))} />}
      <section aria-labelledby="sidebar-day" className="rounded-[var(--app-radius)] bg-surface-2 px-4 py-3">
        <div className="flex items-baseline justify-between mb-1">
          <h2 id="sidebar-day" className="font-head font-bold">
            <Link href="/heute" className="text-ink hover:text-accent-ink">Mein Tag</Link>
          </h2>
          <span className="text-xs text-muted">{day.tasks.length === 0 ? 'nichts offen' : `${openCount} offen`}</span>
        </div>
        {day.tasks.length > 0 && (
          <TaskList tasks={day.tasks} pending={day.pending} onToggle={day.toggle} compact />
        )}
        <Link href="/heute" className="inline-block mt-2 text-sm font-semibold text-accent-ink hover:underline">Ganzen Tag ansehen</Link>
      </section>
    </>
  )

  return (
    <AppShell active="kalender" sidebar={sidebar}>
      <div className="lg:hidden px-4 pt-3">
        <NaturalInput onChanged={loadEvents} />
      </div>
      <CalendarView events={day.events} onRefresh={loadEvents} focus={focus} />
    </AppShell>
  )
}
