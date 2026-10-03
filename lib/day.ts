'use client'
// Daten für „Mein Tag“: Termine und Aufgaben eines Tages, Abhaken, Anlegen, Löschen.
// Genutzt von der Seite /heute und der Tagesliste in der Kalender-Seitenleiste.

import { useEffect, useState, useSyncExternalStore } from 'react'
import { addDays, localDate, TIME_ZONE } from './dates'
import { occursOn, parseRecurrence, Recurrence } from './recurrence'
import type { DayTask } from './tasks'

export interface DbEvent {
  id: number
  title: string
  description?: string | null
  startTime: string
  endTime: string
  category?: string | null
  color?: string | null
  rrule?: string | null
  // Termin plant eine Aufgabe ein; Tage, an denen er wegen erledigter Aufgabe ausfällt (nur Serien)
  taskId?: number | null
  taskTitle?: string | null
  exdates?: string[]
}

export interface DayEvent extends DbEvent {
  label: string // Uhrzeit, „bis 10:00“ oder „ganztags“ bei mehrtägigen Terminen
  sortKey: string
}

export const timeFmt = new Intl.DateTimeFormat('de-DE', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' })

// Termine an `day`: Serien über occursOn, einmalige Termine an jedem Tag,
// über den sie reichen (Ende um 0:00 zählt zum Vortag)
export function eventsOnDay(events: DbEvent[], day: string): DayEvent[] {
  const result: DayEvent[] = []
  for (const e of events) {
    const start = new Date(e.startTime)
    const end = new Date(e.endTime)
    const startDay = localDate(start)
    const startTime = timeFmt.format(start)
    const rule = parseRecurrence(e.rrule)
    if (rule.ok && rule.value) {
      if (occursOn(rule.value, startDay, day) && !e.exdates?.includes(day)) result.push({ ...e, label: startTime, sortKey: startTime })
      continue
    }
    const endTime = timeFmt.format(end)
    const endDay = endTime === '00:00' && end > start ? addDays(localDate(end), -1) : localDate(end)
    if (day < startDay || day > endDay) continue
    if (day === startDay) result.push({ ...e, label: startTime, sortKey: startTime })
    else if (day === endDay && endTime !== '00:00') result.push({ ...e, label: `bis ${endTime}`, sortKey: '00:00' })
    else result.push({ ...e, label: 'ganztags', sortKey: '' })
  }
  return result.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
}

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.error ?? 'Fehler beim Speichern')
  }
  return res.json()
}

async function getJson(url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error()
  return res.json()
}

// Jede Minute neu prüfen, damit „heute“ nach Mitternacht weiterspringt
const everyMinute = (cb: () => void) => {
  const id = setInterval(cb, 60000)
  return () => clearInterval(id)
}

// Heutiges Datum in deutscher Zeit; auf dem Server null (erst im Browser bestimmen)
export function useToday(): string | null {
  return useSyncExternalStore(everyMinute, () => localDate(new Date()), () => null)
}

const LOAD_ERROR = 'Daten konnten nicht geladen werden'

// `reloadKey` von außen erhöhen, um neu zu laden (z. B. nach Änderungen im Kalender)
export function useDay(day: string | null, reloadKey = 0) {
  const [events, setEvents] = useState<DbEvent[]>([])
  const [tasks, setTasks] = useState<DayTask[]>([])
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const [pending, setPending] = useState<Set<number>>(new Set())
  const reload = () => setVersion(v => v + 1)

  useEffect(() => {
    if (!day) return
    let cancelled = false
    Promise.all([getJson('/api/events'), getJson(`/api/tasks?date=${day}`)])
      .then(([ev, ts]) => {
        if (cancelled) return
        setEvents(ev)
        setTasks(ts)
        setError(e => (e === LOAD_ERROR ? '' : e))
      })
      .catch(() => { if (!cancelled) setError(LOAD_ERROR) })
    return () => { cancelled = true }
  }, [day, version, reloadKey])

  async function run(action: () => Promise<unknown>) {
    setError('')
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler')
    }
    reload()
  }

  // Pro Aufgabe nur eine Anfrage gleichzeitig, damit Doppelklicks sich nicht überholen
  async function toggle(task: DayTask) {
    if (!day || pending.has(task.id)) return
    setPending(p => new Set(p).add(task.id))
    setTasks(ts => ts.map(t => (t.id === task.id ? { ...t, done: !t.done } : t)))
    await run(() => send(`/api/tasks/${task.id}/done`, 'PUT', { date: day, done: !task.done }))
    setPending(p => {
      const next = new Set(p)
      next.delete(task.id)
      return next
    })
  }

  return {
    events,
    tasks,
    error,
    pending,
    reload,
    dayEvents: day ? eventsOnDay(events, day) : [],
    toggle,
    addTask: (title: string, rrule: Recurrence | null, date: string | null) =>
      run(() => send('/api/tasks', 'POST', { title, rrule, date })),
    addStep: (eventId: number, title: string, position: number) =>
      run(() => send('/api/tasks', 'POST', { title, eventId, position })),
    deleteTask: (id: number) => run(() => send(`/api/tasks/${id}`, 'DELETE')),
  }
}
