'use client'
import { useEffect, useRef, useState } from 'react'
import { PRESETS, Recurrence, describeRecurrence, presetKey } from '@/lib/recurrence'

export interface EventFormData {
  id?: number
  title: string
  description: string
  startTime: string
  endTime: string
  category: string
  rrule: Recurrence | null
}

interface Props {
  mode: 'create' | 'edit'
  initial: Partial<EventFormData>
  onSave: (data: EventFormData) => void
  onDelete?: () => void
  onClose: () => void
  // Für Vorschläge der Spracheingabe: Überschrift, Erklärung und bisheriger Stand
  heading?: string
  note?: string
  previous?: string
}

const CATEGORIES = ['Arbeit', 'Privat', 'Sport', 'Sonstiges']

function toLocal(iso: string) {
  if (!iso) return ''
  return iso.slice(0, 16)
}

export default function EventModal({ mode, initial, onSave, onDelete, onClose, heading, note, previous }: Props) {
  const titleRef = useRef<HTMLInputElement>(null)
  const initialRule = initial.rrule ?? null
  const [repeat, setRepeat] = useState(presetKey(initialRule))

  useEffect(() => {
    titleRef.current?.focus()
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  function buildRule(key: string, until: string | null): Recurrence | null {
    const base = key === 'custom' ? initialRule : PRESETS.find(p => p.key === key)?.rule ?? null
    if (!base) return null
    const rule: Recurrence = { ...base }
    delete rule.until
    if (until) rule.until = until
    return rule
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    onSave({
      id: initial.id,
      title: fd.get('title') as string,
      description: fd.get('description') as string,
      startTime: new Date(fd.get('startTime') as string).toISOString(),
      endTime: new Date(fd.get('endTime') as string).toISOString(),
      category: fd.get('category') as string,
      rrule: buildRule(repeat, fd.get('until') as string | null),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-gray-900 mb-5">
          {heading ?? (mode === 'create' ? 'Neuer Termin' : 'Termin bearbeiten')}
        </h2>
        {(note || previous) && (
          <div className="-mt-3 mb-5 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
            {note && <p>{note}</p>}
            {previous && <p className="mt-1 text-xs text-blue-700">Bisher: {previous}</p>}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              ref={titleRef}
              name="title"
              defaultValue={initial.title ?? ''}
              placeholder="Titel"
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <textarea
              name="description"
              defaultValue={initial.description ?? ''}
              placeholder="Beschreibung (optional)"
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Start</label>
              <input
                name="startTime"
                type="datetime-local"
                defaultValue={toLocal(initial.startTime ?? '')}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Ende</label>
              <input
                name="endTime"
                type="datetime-local"
                defaultValue={toLocal(initial.endTime ?? '')}
                required
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <select
              name="category"
              defaultValue={initial.category ?? 'Sonstiges'}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Wiederholen</label>
              <select
                value={repeat}
                onChange={e => setRepeat(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PRESETS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                {initialRule && presetKey(initialRule) === 'custom' && (
                  <option value="custom">{describeRecurrence(initialRule)}</option>
                )}
              </select>
            </div>
            {repeat !== 'none' && (
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Bis (optional)</label>
                <input
                  name="until"
                  type="date"
                  defaultValue={initialRule?.until ?? ''}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            {mode === 'edit' && onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="px-4 py-2 rounded-xl text-sm text-red-500 hover:bg-red-50 transition-colors"
              >
                Löschen
              </button>
            )}
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm text-gray-500 hover:bg-gray-100 transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-sm bg-blue-500 text-white hover:bg-blue-600 transition-colors font-medium"
            >
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
