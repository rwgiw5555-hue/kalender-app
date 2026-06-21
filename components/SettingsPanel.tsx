'use client'

export interface CalendarTheme {
  accent: string
  slotBg: string
  slotAltBg: string
  gridLine: string
}

export const PRESETS: { label: string; theme: CalendarTheme }[] = [
  {
    label: 'Blau (Standard)',
    theme: { accent: '#3b82f6', slotBg: '#ffffff', slotAltBg: '#f8faff', gridLine: '#e0e7ff' },
  },
  {
    label: 'Lila',
    theme: { accent: '#8b5cf6', slotBg: '#ffffff', slotAltBg: '#faf8ff', gridLine: '#ede9fe' },
  },
  {
    label: 'Grün',
    theme: { accent: '#10b981', slotBg: '#ffffff', slotAltBg: '#f0fdf9', gridLine: '#d1fae5' },
  },
  {
    label: 'Orange',
    theme: { accent: '#f59e0b', slotBg: '#ffffff', slotAltBg: '#fffbf0', gridLine: '#fef3c7' },
  },
  {
    label: 'Dunkel',
    theme: { accent: '#3b82f6', slotBg: '#0f1117', slotAltBg: '#141824', gridLine: '#2a3550' },
  },
]

interface Props {
  theme: CalendarTheme
  onChange: (t: CalendarTheme) => void
  onClose: () => void
}

export default function SettingsPanel({ theme, onChange, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-gray-900">Erscheinungsbild</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Farbschema</p>
        <div className="space-y-2 mb-6">
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => onChange(p.theme)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                theme.accent === p.theme.accent && theme.slotBg === p.theme.slotBg
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-100 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className="w-5 h-5 rounded-full shrink-0 shadow-sm" style={{ backgroundColor: p.theme.accent }} />
              <span className="text-sm text-gray-700">{p.label}</span>
              <span
                className="ml-auto w-8 h-5 rounded border border-gray-200 shrink-0"
                style={{ backgroundColor: p.theme.slotAltBg }}
              />
            </button>
          ))}
        </div>

        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Akzentfarbe (individuell)</p>
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-100">
          <input
            type="color"
            value={theme.accent}
            onChange={e => onChange({ ...theme, accent: e.target.value })}
            className="w-8 h-8 rounded-full cursor-pointer border-0 bg-transparent"
          />
          <span className="text-sm text-gray-600">Eigene Farbe wählen</span>
          <span className="ml-auto text-xs text-gray-400 font-mono">{theme.accent}</span>
        </div>
      </div>
    </div>
  )
}
