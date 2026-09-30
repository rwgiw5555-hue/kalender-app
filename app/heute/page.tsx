'use client'
import Link from 'next/link'
import { useEffect, useState, useSyncExternalStore } from 'react'
import NaturalInput from '@/components/NaturalInput'
import { addDays, localDate, TIME_ZONE } from '@/lib/dates'
import { describeRecurrence, occursOn, parseRecurrence, PRESETS } from '@/lib/recurrence'
import type { DayTask } from '@/lib/tasks'

interface DbEvent {
  id: number
  title: string
  startTime: string
  endTime: string
  category?: string | null
  color?: string | null
  rrule?: string | null
}

const CATEGORY_COLORS: Record<string, string> = {
  Arbeit: '#3b82f6',
  Privat: '#10b981',
  Sport: '#f59e0b',
  Sonstiges: '#8b5cf6',
}

const timeFmt = new Intl.DateTimeFormat('de-DE', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })

function eventsOnDay(events: DbEvent[], day: string) {
  return events
    .filter(e => {
      const start = localDate(new Date(e.startTime))
      const rule = parseRecurrence(e.rrule)
      return rule.ok && rule.value ? occursOn(rule.value, start, day) : start === day
    })
    .sort((a, b) => timeFmt.format(new Date(a.startTime)).localeCompare(timeFmt.format(new Date(b.startTime))))
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

function loadAccent(): string {
  try {
    const saved = localStorage.getItem('cal-theme')
    const accent = saved ? JSON.parse(saved).accent : null
    return typeof accent === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(accent) ? accent : '#3b82f6'
  } catch {
    return '#3b82f6'
  }
}

const noSubscribe = () => () => {}

export default function Heute() {
  // Datum und Farbe erst im Browser bestimmen (auf dem Server null),
  // damit vorgerenderte Seite und Browser nicht auseinanderlaufen
  const today = useSyncExternalStore(noSubscribe, () => localDate(new Date()), () => null)
  const accent = useSyncExternalStore(noSubscribe, loadAccent, () => '#3b82f6')
  const [selected, setDay] = useState<string | null>(null)
  const day = selected ?? today
  const [events, setEvents] = useState<DbEvent[]>([])
  const [tasks, setTasks] = useState<DayTask[]>([])
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  const load = () => setVersion(v => v + 1)

  useEffect(() => {
    if (!day) return
    let cancelled = false
    Promise.all([
      fetch('/api/events').then(r => r.json()),
      fetch(`/api/tasks?date=${day}`).then(r => r.json()),
    ])
      .then(([ev, ts]) => {
        if (cancelled) return
        setEvents(ev)
        setTasks(ts)
      })
      .catch(() => { if (!cancelled) setError('Daten konnten nicht geladen werden') })
    return () => { cancelled = true }
  }, [day, version])

  async function run(action: () => Promise<unknown>) {
    setError('')
    try {
      await action()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler')
    }
    load()
  }

  function toggle(task: DayTask) {
    setTasks(ts => ts.map(t => (t.id === task.id ? { ...t, done: !t.done } : t)))
    run(() => send(`/api/tasks/${task.id}/done`, 'PUT', { date: day, done: !task.done }))
  }

  if (!day || !today) return null

  const dayEvents = eventsOnDay(events, day)
  const steps = (eventId: number) => tasks.filter(t => t.eventId === eventId)
  const looseTasks = tasks.filter(t => t.eventId === null)
  const openCount = tasks.filter(t => !t.done).length

  return (
    <div className="h-full overflow-y-auto bg-gray-50">
      <div className="max-w-lg mx-auto px-4 pb-16">
        <header className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur pt-4 pb-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="text-sm font-medium px-3 py-2 -ml-3 rounded-xl hover:bg-gray-100" style={{ color: accent }}>
              ‹ Kalender
            </Link>
            {day !== today && (
              <button onClick={() => setDay(today)} className="text-sm font-medium px-3 py-2 rounded-xl hover:bg-gray-100" style={{ color: accent }}>
                Heute
              </button>
            )}
          </div>
          <div className="flex items-center justify-between mt-1">
            <button onClick={() => setDay(addDays(day, -1))} aria-label="Vorheriger Tag" className="w-11 h-11 rounded-full text-2xl text-gray-400 hover:bg-gray-100">‹</button>
            <div className="text-center">
              <h1 className="text-xl font-semibold text-gray-900">{dayFmt.format(new Date(day + 'T12:00:00Z'))}</h1>
              <p className="text-xs text-gray-400">{openCount === 0 ? 'Alles erledigt' : `${openCount} offen`}</p>
            </div>
            <button onClick={() => setDay(addDays(day, 1))} aria-label="Nächster Tag" className="w-11 h-11 rounded-full text-2xl text-gray-400 hover:bg-gray-100">›</button>
          </div>
        </header>
        <div className="mt-1">
          <NaturalInput onEventCreated={load} />
        </div>

        {error && (
          <p role="alert" className="mt-4 text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3">{error}</p>
        )}

        <section className="mt-6">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Termine</h2>
          {dayEvents.length === 0 && <p className="text-sm text-gray-400">Keine Termine</p>}
          <ul className="space-y-3">
            {dayEvents.map(e => {
              const rule = parseRecurrence(e.rrule)
              const color = e.color ?? CATEGORY_COLORS[e.category ?? 'Sonstiges'] ?? '#8b5cf6'
              return (
                <li key={e.id} className="bg-white rounded-2xl shadow-sm border-l-4 px-4 py-3" style={{ borderColor: color }}>
                  <div className="flex items-baseline gap-3">
                    <span className="text-sm font-semibold tabular-nums text-gray-500">{timeFmt.format(new Date(e.startTime))}</span>
                    <span className="font-medium text-gray-900 flex-1">{e.title}</span>
                  </div>
                  {rule.ok && rule.value && (
                    <>
                      <p className="text-xs text-gray-400 mt-0.5 ml-14">{describeRecurrence(rule.value)}</p>
                      <TaskList
                        tasks={steps(e.id)}
                        accent={accent}
                        onToggle={toggle}
                        onDelete={t => run(() => send(`/api/tasks/${t.id}`, 'DELETE'))}
                        onAdd={title => run(() => send('/api/tasks', 'POST', { title, eventId: e.id, position: steps(e.id).length }))}
                        placeholder="Schritt hinzufügen"
                      />
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Aufgaben</h2>
          <div className="bg-white rounded-2xl shadow-sm px-4 py-2">
            <TaskList
              tasks={looseTasks}
              accent={accent}
              onToggle={toggle}
              onDelete={t => run(() => send(`/api/tasks/${t.id}`, 'DELETE'))}
              onAdd={(title, repeat) => run(() => send('/api/tasks', 'POST', {
                title,
                rrule: PRESETS.find(p => p.key === repeat)?.rule ?? null,
                date: repeat !== 'none' || day !== today ? day : null,
              }))}
              placeholder="Aufgabe hinzufügen"
              withRepeat
            />
          </div>
        </section>
      </div>
    </div>
  )
}

interface TaskListProps {
  tasks: DayTask[]
  accent: string
  onToggle: (t: DayTask) => void
  onDelete: (t: DayTask) => void
  onAdd: (title: string, repeat: string) => void
  placeholder: string
  withRepeat?: boolean
}

function TaskList({ tasks, accent, onToggle, onDelete, onAdd, placeholder, withRepeat }: TaskListProps) {
  const [title, setTitle] = useState('')
  const [repeat, setRepeat] = useState('none')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    onAdd(title.trim(), repeat)
    setTitle('')
    setRepeat('none')
  }

  return (
    <div className="mt-1">
      <ul>
        {tasks.map(t => (
          <li key={t.id} className="group flex items-center gap-3 min-h-11">
            <button
              onClick={() => onToggle(t)}
              role="checkbox"
              aria-checked={t.done}
              aria-label={t.title}
              className="w-7 h-7 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors"
              style={t.done ? { backgroundColor: accent, borderColor: accent } : { borderColor: '#d1d5db' }}
            >
              {t.done && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
            <span className={`flex-1 text-sm ${t.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
              {t.title}
              {t.rrule && <span className="ml-2 text-xs text-gray-400">{describeRecurrence(t.rrule)}</span>}
              {t.overdue && <span className="ml-2 text-xs text-red-500">seit {t.date?.split('-').reverse().join('.')}</span>}
            </span>
            <button
              onClick={() => onDelete(t)}
              aria-label={`${t.title} löschen`}
              className="w-9 h-9 shrink-0 rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={submit} className="flex items-center gap-2 py-2">
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={placeholder}
          maxLength={200}
          className="flex-1 min-w-0 text-sm px-3 py-2 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {withRepeat && (
          <select
            value={repeat}
            onChange={e => setRepeat(e.target.value)}
            aria-label="Wiederholen"
            className="text-sm px-2 py-2 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PRESETS.map(p => <option key={p.key} value={p.key}>{p.key === 'none' ? 'Einmal' : p.label}</option>)}
          </select>
        )}
        <button type="submit" disabled={!title.trim()} className="px-3 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40" style={{ backgroundColor: accent }}>
          +
        </button>
      </form>
    </div>
  )
}
