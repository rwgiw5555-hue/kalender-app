'use client'
import { useState } from 'react'
import Icon from './Icon'

const monthFmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'UTC', month: 'long', year: 'numeric' })
const WEEKDAYS = ['M', 'D', 'M', 'D', 'F', 'S', 'S']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

// Monatsübersicht; Tage als YYYY-MM-DD. Klick wählt einen Tag.
export default function MiniMonth({ today, selected, onSelect }: { today: string; selected: string | null; onSelect: (day: string) => void }) {
  const base = selected ?? today
  const [shown, setShown] = useState({ y: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1, from: base })
  // Springt der gewählte Tag in einen anderen Monat, Anzeige mitnehmen
  const view = shown.from === base ? shown : { y: Number(base.slice(0, 4)), m: Number(base.slice(5, 7)) - 1, from: base }

  const first = new Date(Date.UTC(view.y, view.m, 1))
  const offset = (first.getUTCDay() + 6) % 7 // Montag = 0
  const daysInMonth = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate()
  const cells: { day: string; label: number; other: boolean }[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(Date.UTC(view.y, view.m, 1 - offset + i))
    cells.push({
      day: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
      label: d.getUTCDate(),
      other: d.getUTCMonth() !== view.m,
    })
  }
  const rows = offset + daysInMonth > 35 ? 42 : 35

  function shift(delta: number) {
    const d = new Date(Date.UTC(view.y, view.m + delta, 1))
    setShown({ y: d.getUTCFullYear(), m: d.getUTCMonth(), from: base })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="font-head font-bold text-ink capitalize">{monthFmt.format(first)}</span>
        <div className="flex">
          <button type="button" aria-label="Vorheriger Monat" onClick={() => shift(-1)} className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:bg-surface-2">
            <Icon name="left" size={16} />
          </button>
          <button type="button" aria-label="Nächster Monat" onClick={() => shift(1)} className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:bg-surface-2">
            <Icon name="right" size={16} />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {WEEKDAYS.map((w, i) => <span key={i} className="text-[11px] font-semibold text-muted pb-1">{w}</span>)}
        {cells.slice(0, rows).map(c => {
          const isSel = c.day === (selected ?? today)
          const isToday = c.day === today
          return (
            <button
              key={c.day}
              type="button"
              onClick={() => onSelect(c.day)}
              aria-label={c.day.split('-').reverse().join('.')}
              aria-current={isToday ? 'date' : undefined}
              aria-pressed={isSel}
              className={`h-8 rounded-full text-[13px] tabular-nums transition-colors ${
                isSel ? 'bg-accent text-on-accent font-bold'
                  : isToday ? 'text-accent-ink font-bold hover:bg-surface-2'
                  : c.other ? 'text-muted/70 hover:bg-surface-2' : 'text-ink hover:bg-surface-2'
              }`}
            >
              {c.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
