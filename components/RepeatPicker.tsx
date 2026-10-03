'use client'
import { PRESETS, Recurrence } from '@/lib/recurrence'

// Wiederholung für Aufgaben: Vorlage (wöchentlich …) und bei Wochen/Monaten zusätzlich
// „an festem Tag“ oder „irgendwann im Zeitraum“ (steht dann jeden Tag in der Liste, bis abgehakt)
const ANYTIME_LABEL: Record<string, string> = {
  weekly: 'irgendwann in der Woche',
  biweekly: 'irgendwann in den 2 Wochen',
  monthly: 'irgendwann im Monat',
}

export const supportsAnytime = (key: string) => key in ANYTIME_LABEL

// Regel aus Vorlage und Modus
export function taskRule(key: string, anytime: boolean): Recurrence | null {
  const base = PRESETS.find(p => p.key === key)?.rule
  if (!base) return null
  return anytime && supportsAnytime(key) ? { ...base, anytime: true } : { ...base }
}

interface Props {
  repeat: string
  anytime: boolean
  onChange: (repeat: string, anytime: boolean) => void
  className: string
  // Zusätzliche Option für eine Regel, die keiner Vorlage entspricht (z. B. von der KI)
  customLabel?: string
}

export default function RepeatPicker({ repeat, anytime, onChange, className, customLabel }: Props) {
  return (
    <>
      <select value={repeat} onChange={e => onChange(e.target.value, anytime)} aria-label="Wiederholen" className={className}>
        {customLabel && <option value="custom">{customLabel}</option>}
        {PRESETS.map(p => <option key={p.key} value={p.key}>{p.key === 'none' ? 'Einmal' : p.label}</option>)}
      </select>
      {supportsAnytime(repeat) && (
        <select
          value={anytime ? 'anytime' : 'fixed'}
          onChange={e => onChange(repeat, e.target.value === 'anytime')}
          aria-label="Wann im Zeitraum"
          className={className}
        >
          <option value="fixed">an festem Tag</option>
          <option value="anytime">{ANYTIME_LABEL[repeat]}</option>
        </select>
      )}
    </>
  )
}
