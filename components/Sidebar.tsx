'use client'
import { useState } from 'react'

const CATEGORIES = [
  { name: 'Arbeit', color: '#3b82f6' },
  { name: 'Privat', color: '#10b981' },
  { name: 'Sport', color: '#f59e0b' },
  { name: 'Sonstiges', color: '#8b5cf6' },
]

interface Props {
  hiddenCategories: Set<string>
  onToggleCategory: (cat: string) => void
}

export default function Sidebar({ hiddenCategories, onToggleCategory }: Props) {
  const today = new Date()
  const [viewDate] = useState(today)

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const monthName = viewDate.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })

  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const startOffset = (firstDay + 6) % 7

  const cells: (number | null)[] = Array(startOffset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <aside className="w-60 shrink-0 border-r border-gray-100 bg-white flex flex-col gap-6 p-5 pt-6">
      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{monthName}</p>
        <div className="grid grid-cols-7 text-center">
          {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map(d => (
            <span key={d} className="text-[10px] text-gray-400 font-medium py-1">{d}</span>
          ))}
          {cells.map((d, i) => {
            const isToday = d === today.getDate() && month === today.getMonth() && year === today.getFullYear()
            return (
              <span
                key={i}
                className={`text-xs py-1 w-7 h-7 flex items-center justify-center rounded-full mx-auto
                  ${d ? 'text-gray-700 cursor-pointer hover:bg-gray-100' : ''}
                  ${isToday ? 'bg-blue-500 text-white hover:bg-blue-500' : ''}
                `}
              >
                {d ?? ''}
              </span>
            )
          })}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Kategorien</p>
        <ul className="space-y-1">
          {CATEGORIES.map(cat => {
            const hidden = hiddenCategories.has(cat.name)
            return (
              <li key={cat.name}>
                <button
                  onClick={() => onToggleCategory(cat.name)}
                  className="flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0 transition-opacity"
                    style={{ backgroundColor: cat.color, opacity: hidden ? 0.25 : 1 }}
                  />
                  <span className={`text-sm ${hidden ? 'text-gray-400' : 'text-gray-700'}`}>{cat.name}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </aside>
  )
}
