'use client'
import { useId, useState } from 'react'
import Icon from './Icon'
import { describeRecurrence, PRESETS } from '@/lib/recurrence'
import type { DayTask } from '@/lib/tasks'

interface Props {
  tasks: DayTask[]
  pending: Set<number>
  onToggle: (t: DayTask) => void
  onDelete?: (t: DayTask) => void
  onAdd?: (title: string, repeat: string) => void
  placeholder?: string
  withRepeat?: boolean
  compact?: boolean // kleinere Darstellung für die Seitenleiste
}

export function Checkbox({ done, label, disabled, onClick, compact }: { done: boolean; label: string; disabled?: boolean; onClick: () => void; compact?: boolean }) {
  const size = compact ? 'w-5 h-5' : 'w-7 h-7'
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`${compact ? 'w-9 h-9' : 'w-11 h-11'} -m-2 shrink-0 flex items-center justify-center rounded-full`}
    >
      <span
        className={`${size} rounded-full flex items-center justify-center transition-colors ${done ? 'bg-accent text-on-accent' : 'border-2 border-muted'}`}
      >
        {done && <Icon name="check" size={compact ? 12 : 15} strokeWidth={3} />}
      </span>
    </button>
  )
}

export default function TaskList({ tasks, pending, onToggle, onDelete, onAdd, placeholder, withRepeat, compact }: Props) {
  const [title, setTitle] = useState('')
  const [repeat, setRepeat] = useState('none')
  const inputId = useId()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !onAdd) return
    onAdd(title.trim(), repeat)
    setTitle('')
    setRepeat('none')
  }

  return (
    <div>
      <ul>
        {tasks.map(t => (
          <li key={t.id} className={`group flex items-center gap-3 ${compact ? 'min-h-9' : 'min-h-12'}`}>
            <Checkbox done={t.done} label={t.title} disabled={pending.has(t.id)} onClick={() => onToggle(t)} compact={compact} />
            <span className={`flex-1 min-w-0 ${compact ? 'text-sm' : 'text-[15px]'} ${t.done ? 'line-through text-muted' : 'text-ink'}`}>
              {t.title}
              {!compact && t.rrule && <span className="ml-2 text-xs text-muted">{describeRecurrence(t.rrule)}</span>}
            </span>
            {t.overdue && (
              <span className="text-xs text-danger whitespace-nowrap">seit {t.date?.split('-').reverse().slice(0, 2).join('.')}.</span>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(t)}
                aria-label={`${t.title} löschen`}
                className="w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-muted hover:text-danger hover:bg-surface-2 [@media(hover:hover)_and_(min-width:640px)]:opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
              >
                <Icon name="close" size={16} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {onAdd && (
        <form onSubmit={submit} className="flex items-center gap-2 pt-2">
          <label className="sr-only" htmlFor={inputId}>{placeholder}</label>
          <input
            id={inputId}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={placeholder}
            maxLength={200}
            className="flex-1 min-w-0 h-11 text-sm px-3 rounded-[calc(var(--app-radius)*0.6)] bg-surface-2 text-ink placeholder:text-muted border border-transparent focus:border-accent focus:outline-none"
          />
          {withRepeat && (
            <select
              value={repeat}
              onChange={e => setRepeat(e.target.value)}
              aria-label="Wiederholen"
              className="h-11 text-sm px-2 rounded-[calc(var(--app-radius)*0.6)] bg-surface-2 text-ink border border-transparent focus:border-accent focus:outline-none"
            >
              {PRESETS.map(p => <option key={p.key} value={p.key}>{p.key === 'none' ? 'Einmal' : p.label}</option>)}
            </select>
          )}
          <button
            type="submit"
            disabled={!title.trim()}
            aria-label="Hinzufügen"
            className="w-11 h-11 shrink-0 rounded-[calc(var(--app-radius)*0.6)] flex items-center justify-center bg-accent text-on-accent disabled:opacity-40"
          >
            <Icon name="plus" size={20} />
          </button>
        </form>
      )}
    </div>
  )
}
