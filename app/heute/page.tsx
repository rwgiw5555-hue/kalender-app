'use client'
import { useState } from 'react'
import AppShell from '@/components/AppShell'
import Icon from '@/components/Icon'
import MiniMonth from '@/components/MiniMonth'
import NaturalInput from '@/components/NaturalInput'
import ProgressRing from '@/components/ProgressRing'
import TaskList from '@/components/TaskList'
import { addDays } from '@/lib/dates'
import { DayEvent, timeFmt, useDay, useToday } from '@/lib/day'
import { getHolidays } from '@/lib/holidays'
import { describeRecurrence, parseRecurrence, PRESETS } from '@/lib/recurrence'
import { categoryColors, usePalette } from '@/lib/theme'

const dayFmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })

export default function Heute() {
  const today = useToday()
  const [selected, setDay] = useState<string | null>(null)
  const day = selected ?? today
  const data = useDay(day)
  const palette = usePalette()

  // Ist der gewählte Tag heute, folgt die Ansicht „heute“ (auch über Mitternacht)
  function go(d: string) {
    setDay(d === today ? null : d)
  }

  const sidebar = day && today ? (
    <MiniMonth today={today} selected={day} onSelect={go} />
  ) : null

  if (!day || !today) return <AppShell active="heute">{null}</AppShell>

  const { dayEvents, tasks, pending } = data
  const steps = (eventId: number) => tasks.filter(t => t.eventId === eventId)
  const looseTasks = tasks.filter(t => t.eventId === null)
  const doneCount = tasks.filter(t => t.done).length
  const holiday = getHolidays(Number(day.slice(0, 4))).find(h => h.start === day)

  // „Als Nächstes“: offener Schritt eines Termins, der noch nicht vorbei ist, sonst der
  // nächste Termin, sonst eine Aufgabe
  const now = timeFmt.format(new Date())
  const notOver = (e: DayEvent) => day !== today || timeFmt.format(new Date(e.endTime)) > now || e.sortKey === ''
  const nextStep = dayEvents.filter(notOver).flatMap(e => steps(e.id)).find(t => !t.done)
  const nextEvent = day === today ? dayEvents.find(e => e.sortKey >= now) : undefined
  const nextTask = looseTasks.find(t => !t.done)
  const next = nextStep ? nextStep.title : nextEvent ? `${nextEvent.label} ${nextEvent.title}` : nextTask?.title

  return (
    <AppShell active="heute" sidebar={sidebar}>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg lg:max-w-5xl mx-auto px-4 lg:px-8 pb-10">
          <header className="sticky top-0 z-10 bg-bg/95 backdrop-blur pt-5 pb-3 lg:pt-8">
            <div className="flex items-center justify-between gap-2">
              <button type="button" onClick={() => go(addDays(day, -1))} aria-label="Vorheriger Tag" className="w-11 h-11 rounded-full bg-surface text-ink flex items-center justify-center hover:bg-surface-2">
                <Icon name="left" size={20} />
              </button>
              <div className="text-center min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-accent-ink h-4">
                  {day === today ? 'Heute' : day === addDays(today, 1) ? 'Morgen' : day === addDays(today, -1) ? 'Gestern' : ''}
                </p>
                <h1 className="font-head text-xl lg:text-2xl font-bold truncate">{dayFmt.format(new Date(day + 'T12:00:00Z'))}</h1>
                {holiday && <p className="text-xs text-muted mt-0.5">{holiday.title}</p>}
              </div>
              <button type="button" onClick={() => go(addDays(day, 1))} aria-label="Nächster Tag" className="w-11 h-11 rounded-full bg-surface text-ink flex items-center justify-center hover:bg-surface-2">
                <Icon name="right" size={20} />
              </button>
            </div>
            {day !== today && (
              <div className="flex justify-center mt-2">
                <button type="button" onClick={() => setDay(null)} className="text-sm font-semibold text-accent-ink px-3 py-1.5 rounded-full hover:bg-surface">
                  Zurück zu heute
                </button>
              </div>
            )}
          </header>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-4 mt-2">
            <div className="flex items-center gap-4 bg-surface rounded-[var(--app-radius)] px-4 py-3.5 shadow-sm">
              <ProgressRing done={doneCount} total={tasks.length} />
              <div className="min-w-0">
                <p className="font-head text-lg font-bold">
                  {tasks.length === 0 ? 'Nichts zu erledigen' : doneCount === tasks.length ? 'Alles erledigt' : `${doneCount} von ${tasks.length} erledigt`}
                </p>
                {next && <p className="text-sm text-muted truncate">Als Nächstes: {next}</p>}
              </div>
            </div>
            <div className="bg-surface rounded-[var(--app-radius)] px-4 py-3.5 shadow-sm flex flex-col justify-center">
              <NaturalInput onChanged={data.reload} />
            </div>
          </div>

          {data.error && (
            <p role="alert" className="mt-4 text-sm text-danger bg-surface rounded-[var(--app-radius)] px-4 py-3">{data.error}</p>
          )}

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] mt-7">
            <section aria-labelledby="termine">
              <h2 id="termine" className="text-xs font-bold uppercase tracking-wider text-muted mb-3">Termine</h2>
              {dayEvents.length === 0 && <p className="text-sm text-muted">Keine Termine</p>}
              <ul className="flex flex-col gap-3">
                {dayEvents.map(e => (
                  <EventCard
                    key={e.id}
                    event={e}
                    colors={categoryColors(palette, e.category)}
                    tinted={palette.tintedCards}
                    steps={steps(e.id)}
                    pending={pending}
                    onToggle={data.toggle}
                    onDelete={t => data.deleteTask(t.id)}
                    onAddStep={title => data.addStep(e.id, title, steps(e.id).length)}
                  />
                ))}
              </ul>
            </section>

            <section aria-labelledby="aufgaben">
              <h2 id="aufgaben" className="text-xs font-bold uppercase tracking-wider text-muted mb-3">Aufgaben</h2>
              <div className={`bg-surface rounded-[var(--app-radius)] px-4 py-3 ${palette.tintedCards ? '' : 'border border-line'}`}>
                {looseTasks.length === 0 && <p className="text-sm text-muted py-2">Keine Aufgaben für diesen Tag</p>}
                <TaskList
                  tasks={looseTasks}
                  pending={pending}
                  onToggle={data.toggle}
                  onDelete={t => data.deleteTask(t.id)}
                  onAdd={(title, repeat) => data.addTask(
                    title,
                    PRESETS.find(p => p.key === repeat)?.rule ?? null,
                    repeat !== 'none' || day !== today ? day : null,
                  )}
                  placeholder="Aufgabe hinzufügen"
                  withRepeat
                />
              </div>
            </section>
          </div>
        </div>
      </div>
    </AppShell>
  )
}

interface EventCardProps {
  event: DayEvent
  colors: { color: string; soft: string }
  tinted: boolean
  steps: ReturnType<typeof useDay>['tasks']
  pending: Set<number>
  onToggle: ReturnType<typeof useDay>['toggle']
  onDelete: (t: ReturnType<typeof useDay>['tasks'][number]) => void
  onAddStep: (title: string) => void
}

function EventCard({ event, colors, tinted, steps, pending, onToggle, onDelete, onAddStep }: EventCardProps) {
  const rule = parseRecurrence(event.rrule)
  const recurring = rule.ok && rule.value
  const color = event.color ?? colors.color
  const doneSteps = steps.filter(s => s.done).length
  return (
    <li className="flex gap-3">
      <span className={`w-14 shrink-0 pt-4 font-head font-semibold text-muted tabular-nums ${event.label.length > 5 ? 'text-xs' : 'text-sm'}`}>{event.label}</span>
      <div
        className={`flex-1 min-w-0 rounded-[var(--app-radius)] px-4 py-3.5 ${tinted ? '' : 'bg-surface border border-line'}`}
        style={tinted ? { background: event.color ? `color-mix(in srgb, ${event.color} 14%, var(--app-surface))` : colors.soft } : undefined}
      >
        <div className="flex items-start gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full shrink-0 mt-[7px]" style={{ background: color }} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">{event.title}</p>
            {recurring && (
              <p className="flex items-center gap-1.5 text-sm text-muted">
                <Icon name="repeat" size={14} />
                {describeRecurrence(rule.value!)}
              </p>
            )}
          </div>
          {steps.length > 0 && (
            <span className="text-xs font-semibold text-muted tabular-nums mt-1">{doneSteps}/{steps.length}</span>
          )}
        </div>
        {(recurring || steps.length > 0) && (
          <div className="mt-2">
            <TaskList tasks={steps} pending={pending} onToggle={onToggle} onDelete={onDelete} onAdd={title => onAddStep(title)} placeholder="Schritt hinzufügen" />
          </div>
        )}
      </div>
    </li>
  )
}
