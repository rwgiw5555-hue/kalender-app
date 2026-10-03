'use client'
import { useEffect, useId, useRef, useState } from 'react'
import EventModal, { EventFormData } from './EventModal'
import Icon from './Icon'
import RepeatPicker, { taskRule } from './RepeatPicker'
import { describeRecurrence, presetKey, Recurrence } from '@/lib/recurrence'
import { TIME_ZONE } from '@/lib/dates'

// Vorschläge der Spracheingabe als Liste: jeden einzeln mit Ja/Nein bestätigen,
// vorher bearbeiten, dann alle bestätigten auf einmal übernehmen.

export interface ProposedEvent {
  title: string
  description: string
  startTime: string // ISO vom Server oder lokale Zeit nach dem Bearbeiten
  endTime: string
  category: string
  rrule: Recurrence | null
}

export interface ProposedTask {
  title: string
  date: string | null
  rrule: Recurrence | null
}

export type Proposal =
  // forTask: Termin plant eine bestehende Aufgabe ein; die Aufgabe bleibt in der Liste
  | { action: 'create'; message: string; event: ProposedEvent; forTask?: { id: number; title: string } }
  | { action: 'update'; message: string; eventId: number; event: ProposedEvent; current: ProposedEvent }
  | { action: 'delete'; message: string; eventId: number; current: ProposedEvent }
  | { action: 'task'; message: string; task: ProposedTask }

type Decision = 'yes' | 'no' | null
interface Item {
  p: Proposal
  decision: Decision
  status: 'open' | 'saving' | 'done' | 'error'
  error?: string
}

const whenFmt = new Intl.DateTimeFormat('de-DE', {
  timeZone: TIME_ZONE, weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
})
const timeFmt = new Intl.DateTimeFormat('de-DE', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' })
const dayFmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: '2-digit' })

// Der Dialog erwartet lokale Zeit (datetime-local), der Server liefert UTC
function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function eventWhen(e: ProposedEvent) {
  const repeat = e.rrule ? ` · ${describeRecurrence(e.rrule)}${e.rrule.until ? ` bis ${e.rrule.until.split('-').reverse().join('.')}` : ''}` : ''
  return `${whenFmt.format(new Date(e.startTime))}–${timeFmt.format(new Date(e.endTime))}${repeat}`
}

function taskWhen(t: ProposedTask) {
  const parts = [t.date ? dayFmt.format(new Date(t.date + 'T12:00:00Z')) : 'ohne Datum']
  if (t.rrule) parts.push(describeRecurrence(t.rrule))
  return parts.join(' · ')
}

const isNew = (p: Proposal) => p.action === 'create' || p.action === 'task'

const LABEL: Record<Proposal['action'], string> = { create: 'Neuer Termin', update: 'Termin ändern', delete: 'Termin löschen', task: 'Aufgabe' }

async function errorText(res: Response) {
  const body = await res.json().catch(() => null)
  return typeof body?.error === 'string' ? body.error : `Fehler ${res.status}`
}

function request(p: Proposal): Promise<Response> {
  const headers = { 'Content-Type': 'application/json' }
  if (p.action === 'task') {
    return fetch('/api/tasks', { method: 'POST', headers, body: JSON.stringify({ title: p.task.title, date: p.task.date, rrule: p.task.rrule }) })
  }
  if (p.action === 'delete') return fetch(`/api/events/${p.eventId}`, { method: 'DELETE' })
  const e = p.event
  const body = JSON.stringify({
    title: e.title, description: e.description, startTime: e.startTime, endTime: e.endTime, category: e.category, rrule: e.rrule,
    // Eingeplante Aufgabe merken: Ist sie abgehakt, blendet der Kalender den Termin aus
    ...(p.action === 'create' && p.forTask ? { taskId: p.forTask.id } : {}),
  })
  return p.action === 'update'
    ? fetch(`/api/events/${p.eventId}`, { method: 'PUT', headers, body })
    : fetch('/api/events', { method: 'POST', headers, body })
}

interface Props {
  transcript: string
  proposals: Proposal[]
  notes: string[]
  // Wird nach dem Schließen aufgerufen; changed = mindestens ein Vorschlag wurde gespeichert
  onClose: (changed: boolean) => void
}

export default function ProposalReview({ transcript, proposals, notes, onClose }: Props) {
  const [items, setItems] = useState<Item[]>(() => proposals.map(p => ({ p, decision: null, status: 'open' })))
  const [editing, setEditing] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  // Beim Öffnen Fokus in die Liste, damit Screenreader sie ansagen
  useEffect(() => { headingRef.current?.focus() }, [])

  const changed = items.some(i => i.status === 'done')
  const pending = items.filter(i => i.status !== 'done')
  const yesCount = pending.filter(i => i.decision === 'yes').length

  useEffect(() => {
    // Escape schließt nur die Liste, wenn kein Bearbeiten-Dialog darüber liegt
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && editing === null && !busy && onClose(changed)
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [editing, busy, changed, onClose])

  function update(index: number, patch: Partial<Item>) {
    setItems(list => list.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function decide(index: number, decision: Decision) {
    update(index, { decision, status: 'open', error: undefined })
  }

  async function apply() {
    if (busy) return
    setBusy(true)
    let failed = false
    // Nacheinander, damit Fehler genau beim betroffenen Vorschlag stehen
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.status === 'done' || item.decision !== 'yes') continue
      update(i, { status: 'saving', error: undefined })
      const res = await request(item.p).catch(() => null)
      if (res?.ok) update(i, { status: 'done' })
      else {
        failed = true
        update(i, { status: 'error', error: res ? await errorText(res) : 'Keine Verbindung' })
      }
    }
    setBusy(false)
    // Alles Bestätigte gespeichert und nichts mehr offen: Liste schließen
    const undecided = items.some(i => i.status !== 'done' && i.decision === null)
    if (!failed && !undecided) onClose(true)
  }

  const editItem = editing !== null ? items[editing] : null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-title"
        className="bg-surface text-ink w-full sm:max-w-2xl max-h-[92vh] flex flex-col rounded-t-[calc(var(--app-radius)*1.5)] sm:rounded-[var(--app-radius)] shadow-2xl animate-scale-in"
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
          <div>
            <h2 id="review-title" ref={headingRef} tabIndex={-1} className="font-head text-lg font-bold focus:outline-none">
              {proposals.length === 1 ? '1 Vorschlag' : `${proposals.length} Vorschläge`}
            </h2>
            <p className="text-xs text-muted">Bei jedem Ja oder Nein wählen, bei Bedarf bearbeiten, dann übernehmen.</p>
          </div>
          <button type="button" onClick={() => onClose(changed)} disabled={busy} aria-label="Schließen" className="w-10 h-10 -mr-2 shrink-0 rounded-full flex items-center justify-center text-muted hover:bg-surface-2">
            <Icon name="close" size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-3">
          {transcript && (
            <details className="mb-3 text-sm">
              <summary className="cursor-pointer text-muted font-semibold">Das hast du gesagt</summary>
              <p className="mt-2 whitespace-pre-wrap bg-surface-2 rounded-[calc(var(--app-radius)*0.6)] px-3 py-2">{transcript}</p>
            </details>
          )}

          <ul className="flex flex-col gap-2.5">
            {items.map((item, i) => (
              <ProposalCard
                key={i}
                item={item}
                disabled={busy}
                onDecide={d => decide(i, d)}
                onEdit={() => setEditing(i)}
                onTaskChange={task => update(i, { p: { ...item.p, task } as Proposal, decision: 'yes', status: 'open', error: undefined })}
              />
            ))}
          </ul>

          {notes.length > 0 && (
            <div className="mt-4 rounded-[calc(var(--app-radius)*0.6)] bg-surface-2 px-4 py-3 text-sm" role="note">
              <p className="font-semibold mb-1">Hinweise</p>
              <ul className="list-disc pl-5 text-muted">
                {notes.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 px-5 py-4 border-t border-line">
          <button
            type="button"
            // Nur Neues (Termine, Aufgaben): Ändern und Löschen immer einzeln bestätigen
            onClick={() => setItems(list => list.map(item => (item.status === 'done' || !isNew(item.p) ? item : { ...item, decision: 'yes', status: 'open', error: undefined })))}
            disabled={busy || !pending.some(i => isNew(i.p))}
            className="h-11 px-4 mr-auto rounded-[calc(var(--app-radius)*0.6)] text-sm font-semibold text-accent-ink hover:bg-surface-2 disabled:opacity-40"
          >
            Alle neuen Ja
          </button>
          <button type="button" onClick={() => onClose(changed)} disabled={busy} className="h-11 px-4 rounded-[calc(var(--app-radius)*0.6)] text-sm font-semibold text-muted hover:bg-surface-2">
            {changed ? 'Fertig' : 'Abbrechen'}
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={busy || yesCount === 0}
            className="h-11 px-5 rounded-[calc(var(--app-radius)*0.6)] text-sm font-semibold bg-accent text-on-accent hover:opacity-90 disabled:opacity-40"
          >
            {busy ? 'Speichert …' : `Übernehmen (${yesCount})`}
          </button>
        </div>
      </div>

      {editItem && editing !== null && (editItem.p.action === 'create' || editItem.p.action === 'update') && (
        <EventModal
          mode={editItem.p.action === 'update' ? 'edit' : 'create'}
          heading="Vorschlag bearbeiten"
          saveLabel="Fertig"
          note={editItem.p.message}
          previous={editItem.p.action === 'update' ? `${editItem.p.current.title}, ${eventWhen(editItem.p.current)}` : undefined}
          initial={{
            ...editItem.p.event,
            startTime: toLocalInput(editItem.p.event.startTime),
            endTime: toLocalInput(editItem.p.event.endTime),
          }}
          onSave={(data: EventFormData) => {
            const { id: _id, ...event } = data
            void _id
            const p = editItem.p as Extract<Proposal, { event: ProposedEvent }>
            update(editing, { p: { ...p, event }, decision: 'yes', status: 'open', error: undefined })
            setEditing(null)
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

interface CardProps {
  item: Item
  disabled: boolean
  onDecide: (d: Decision) => void
  onEdit: () => void
  onTaskChange: (t: ProposedTask) => void
}

function ProposalCard({ item, disabled, onDecide, onEdit, onTaskChange }: CardProps) {
  const { p, decision, status } = item
  const [editingTask, setEditingTask] = useState(false)
  const done = status === 'done'
  const locked = disabled || done || status === 'saving'

  let title: string
  let detail: string
  let before: string | null = null
  if (p.action === 'task') {
    title = p.task.title
    detail = taskWhen(p.task)
  } else if (p.action === 'delete') {
    title = p.current.title
    detail = eventWhen(p.current)
  } else {
    title = p.event.title
    detail = eventWhen(p.event)
    if (p.action === 'update') before = `${p.current.title}, ${eventWhen(p.current)}`
  }
  const series = (p.action === 'update' || p.action === 'delete') && p.current.rrule

  const border = done ? 'border-accent' : decision === 'yes' ? 'border-accent' : decision === 'no' ? 'border-line opacity-60' : 'border-line'

  return (
    <li className={`rounded-[calc(var(--app-radius)*0.75)] border-2 ${border} px-4 py-3 transition-colors`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-bold uppercase tracking-wider ${p.action === 'delete' ? 'text-danger' : 'text-accent-ink'}`}>{p.action === 'create' && p.forTask ? 'Aufgabe einplanen' : LABEL[p.action]}</p>
          <p className={`font-semibold ${p.action === 'delete' ? 'line-through' : ''}`}>{title}</p>
          <p className="text-sm text-muted">{detail}</p>
          {before && <p className="text-xs text-muted mt-0.5">Bisher: {before}</p>}
          {series && <p className="text-xs text-muted mt-0.5">Betrifft die ganze Serie.</p>}
          {p.action === 'create' && p.forTask && <p className="text-xs text-muted mt-0.5">Aufgabe „{p.forTask.title}“ bleibt in deiner Liste. Hakst du sie ab, verschwindet der Termin.</p>}
          {item.error && <p role="alert" className="text-xs text-danger mt-1">{item.error}</p>}
        </div>
        {done ? (
          <span className="flex items-center gap-1 text-sm font-semibold text-accent-ink"><Icon name="check" size={16} strokeWidth={3} /> Gespeichert</span>
        ) : (
          <div className="flex shrink-0 gap-1.5" role="group" aria-label={`${LABEL[p.action]}: ${title}`}>
            <button
              type="button"
              aria-pressed={decision === 'yes'}
              disabled={locked}
              onClick={() => onDecide(decision === 'yes' ? null : 'yes')}
              className={`h-10 px-3.5 rounded-full text-sm font-semibold transition-colors ${decision === 'yes' ? 'bg-accent text-on-accent' : 'bg-surface-2 text-ink hover:bg-line'}`}
            >
              Ja
            </button>
            <button
              type="button"
              aria-pressed={decision === 'no'}
              disabled={locked}
              onClick={() => onDecide(decision === 'no' ? null : 'no')}
              className={`h-10 px-3.5 rounded-full text-sm font-semibold transition-colors ${decision === 'no' ? 'bg-ink text-bg' : 'bg-surface-2 text-ink hover:bg-line'}`}
            >
              Nein
            </button>
          </div>
        )}
      </div>

      {!done && p.action !== 'delete' && !editingTask && (
        <button
          type="button"
          disabled={locked}
          onClick={() => (p.action === 'task' ? setEditingTask(true) : onEdit())}
          className="mt-2 text-sm font-semibold text-accent-ink hover:underline disabled:opacity-40"
        >
          Bearbeiten
        </button>
      )}

      {editingTask && p.action === 'task' && (
        <TaskEditor
          task={p.task}
          onSave={t => {
            onTaskChange(t)
            setEditingTask(false)
          }}
          onCancel={() => setEditingTask(false)}
        />
      )}
    </li>
  )
}

function TaskEditor({ task, onSave, onCancel }: { task: ProposedTask; onSave: (t: ProposedTask) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(task.title)
  const [date, setDate] = useState(task.date ?? '')
  const initialKey = presetKey(task.rrule)
  const initialAnytime = !!task.rrule?.anytime
  const [repeat, setRepeat] = useState(initialKey)
  const [anytime, setAnytime] = useState(initialAnytime)
  const titleId = useId()

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    // Unveränderte Auswahl: Regel der KI behalten (samt Enddatum oder eigener Regel)
    const rrule = repeat === initialKey && anytime === initialAnytime ? task.rrule : taskRule(repeat, anytime)
    onSave({ title: title.trim(), date: date || null, rrule })
  }

  const field = 'h-11 text-sm px-3 rounded-[calc(var(--app-radius)*0.6)] bg-surface-2 text-ink border border-transparent focus:border-accent focus:outline-none'
  return (
    <form
      onSubmit={save}
      // Escape bricht nur das Bearbeiten ab, nicht die ganze Liste
      onKeyDown={e => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          onCancel()
        }
      }}
      className="mt-3 flex flex-col gap-2"
    >
      <label className="sr-only" htmlFor={titleId}>Titel</label>
      <input id={titleId} value={title} onChange={e => setTitle(e.target.value)} maxLength={200} className={field} autoFocus />
      <div className="flex flex-wrap gap-2">
        <label className="flex items-center gap-2 text-sm text-muted">
          Tag
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={field} />
        </label>
        <RepeatPicker
          repeat={repeat}
          anytime={anytime}
          onChange={(r, a) => { setRepeat(r); setAnytime(a) }}
          className={field}
          customLabel={initialKey === 'custom' && task.rrule ? describeRecurrence(task.rrule) : undefined}
        />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="h-10 px-3 rounded-[calc(var(--app-radius)*0.6)] text-sm font-semibold text-muted hover:bg-surface-2">Abbrechen</button>
        <button type="submit" disabled={!title.trim()} className="h-10 px-4 rounded-[calc(var(--app-radius)*0.6)] text-sm font-semibold bg-accent text-on-accent disabled:opacity-40">Fertig</button>
      </div>
    </form>
  )
}
