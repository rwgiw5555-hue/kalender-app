'use client'
import { useEffect } from 'react'
import Icon from './Icon'
import { setAiContext, useAiContext } from '@/lib/client'
import { saveThemeSetting, StyleKey, STYLES, useThemeSetting } from '@/lib/theme'

// Einstellungen: Stil (A/B/C), eigene Akzentfarbe, KI-Kontext
export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const theme = useThemeSetting()
  const aiContext = useAiContext()
  const accent = theme.accent ?? STYLES[theme.style].palette.accent

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="bg-surface text-ink rounded-t-[calc(var(--app-radius)*1.5)] sm:rounded-[var(--app-radius)] shadow-2xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto p-6 animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 id="settings-title" className="font-head text-lg font-bold">Einstellungen</h2>
          <button type="button" onClick={onClose} aria-label="Schließen" className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-muted hover:bg-surface-2">
            <Icon name="close" size={20} />
          </button>
        </div>

        <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Stil</h3>
        <div className="grid grid-cols-3 gap-2 mb-6" role="radiogroup" aria-label="Stil">
          {(Object.keys(STYLES) as StyleKey[]).map(key => {
            const s = STYLES[key]
            const active = theme.style === key
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => saveThemeSetting({ ...theme, style: key })}
                className={`rounded-[calc(var(--app-radius)*0.75)] p-2 text-left border-2 transition-colors ${active ? 'border-accent' : 'border-line hover:border-muted'}`}
              >
                {/* Mini-Vorschau des Stils */}
                <span className="block rounded-lg p-2 h-16" style={{ background: s.palette.bg }}>
                  <span className="block h-2.5 w-3/4 rounded-full mb-1.5" style={{ background: s.palette.ink, opacity: 0.8 }} />
                  <span className="flex gap-1">
                    <span className="block h-6 flex-1" style={{ background: s.palette.surface, borderRadius: s.palette.radius / 3, border: `1px solid ${s.palette.line}` }} />
                    <span className="block h-6 w-6" style={{ background: s.palette.accent, borderRadius: s.palette.radius / 3 }} />
                  </span>
                </span>
                <span className="block text-sm font-semibold mt-2">{key} · {s.label}</span>
                <span className="block text-xs text-muted">{s.palette.dark ? 'Dunkel' : 'Hell'}</span>
              </button>
            )
          })}
        </div>

        <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Akzentfarbe</h3>
        <div className="flex items-center gap-3 px-4 py-3 rounded-[calc(var(--app-radius)*0.75)] border border-line mb-6">
          <input
            id="accent-color"
            type="color"
            value={accent}
            onChange={e => saveThemeSetting({ ...theme, accent: e.target.value })}
            className="w-9 h-9 rounded-full cursor-pointer border-0 bg-transparent"
          />
          <label htmlFor="accent-color" className="text-sm flex-1">Eigene Farbe</label>
          {theme.accent && (
            <button type="button" onClick={() => saveThemeSetting({ ...theme, accent: null })} className="text-sm font-semibold text-accent px-2 py-1 rounded-lg hover:bg-surface-2">
              Zurücksetzen
            </button>
          )}
        </div>

        <h3 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">Spracheingabe</h3>
        <label className="flex items-start gap-3 px-4 py-3 rounded-[calc(var(--app-radius)*0.75)] border border-line cursor-pointer">
          <input
            type="checkbox"
            checked={aiContext}
            onChange={e => setAiContext(e.target.checked)}
            className="mt-0.5 w-4 h-4"
            style={{ accentColor: 'var(--app-accent)' }}
          />
          <span className="text-sm">
            KI darf Termine sehen
            <span className="block text-xs text-muted mt-1">
              Damit kann die Spracheingabe bestehende Termine ändern oder löschen („verschieb den Zahnarzt auf Freitag“).
              Dafür gehen Titel und Zeiten deiner Termine von 2 Wochen zurück bis 2 Monate voraus an die Claude API
              (Anthropic: kein Training, keine Weitergabe, bis zu 30 Tage gespeichert). Beschreibungen nie.
              Gilt nur für dieses Gerät.
            </span>
          </span>
        </label>
      </div>
    </div>
  )
}
