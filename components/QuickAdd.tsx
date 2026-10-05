'use client'
import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import NaturalInput from './NaturalInput'

// Handy: runder +-Knopf über der Tab-Leiste (wie in Google Kalender). Öffnet ein Blatt von unten
// mit der Eingabe für Sprache/Text/Datei und dem Weg zum normalen Formular.
export default function QuickAdd({ onChanged, onManual }: { onChanged: () => void; onManual: () => void }) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const sheetRef = useRef<HTMLDivElement>(null)

  function close() {
    setOpen(false)
    buttonRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    // Fokus ins Eingabefeld, damit am iPhone gleich Tastatur und Diktier-Taste da sind
    sheetRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus()
    const handler = (e: KeyboardEvent) => {
      // Escape nur, wenn kein Dialog (Vorschläge, Formular) darüber liegt
      if (e.key === 'Escape' && !document.querySelector('[role=dialog][aria-modal=true]:not([data-sheet])')) close()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Eintragen"
        className="lg:hidden fixed right-4 z-30 w-14 h-14 rounded-2xl bg-accent text-on-accent shadow-lg flex items-center justify-center active:scale-95 transition-transform"
        style={{ bottom: 'calc(5.25rem + env(safe-area-inset-bottom))' }}
      >
        <Icon name="plus" size={28} />
      </button>

      {open && (
        <div className="lg:hidden fixed inset-0 z-40 flex items-end bg-black/40 animate-fade-in" onClick={close}>
          <div
            ref={sheetRef}
            role="dialog"
            aria-modal="true"
            aria-label="Eintragen"
            data-sheet
            className="w-full bg-surface text-ink rounded-t-[calc(var(--app-radius)*1.5)] shadow-2xl px-4 pt-3"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden />
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-head text-lg font-bold">Eintragen</h2>
              <button type="button" onClick={close} aria-label="Schließen" className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-muted hover:bg-surface-2">
                <Icon name="close" size={20} />
              </button>
            </div>
            <NaturalInput
              onChanged={() => {
                onChanged()
                close()
              }}
            />
            <button
              type="button"
              onClick={() => {
                close()
                onManual()
              }}
              className="mt-3 w-full h-11 rounded-[calc(var(--app-radius)*0.75)] border border-line text-sm font-semibold text-ink hover:bg-surface-2"
            >
              Termin ohne KI eintragen
            </button>
          </div>
        </div>
      )}
    </>
  )
}
