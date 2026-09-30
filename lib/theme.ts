'use client'
// Darstellungs-Stile der App (A, B, C) plus optional eigene Akzentfarbe.
// Farben laufen über CSS-Variablen (--app-*): statisch je Stil (html[data-style]),
// eigene Akzentfarbe als Inline-Stil auf <html> (siehe ThemeStyle).

import { useMemo, useSyncExternalStore } from 'react'

import { accentOverrides, HEX6, Palette, StyleKey, STYLES } from './palettes'

export type { Palette, StyleKey } from './palettes'
export { STYLES } from './palettes'

export interface ThemeSetting {
  style: StyleKey
  accent: string | null // eigene Akzentfarbe, null = die des Stils
}

const DEFAULT: ThemeSetting = { style: 'A', accent: null }
const KEY = 'app-theme'
const EVENT = 'app-theme-change'

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

// Nur gültige Werte übernehmen: sie landen direkt im CSS
function parse(raw: string | null): ThemeSetting {
  try {
    const t = raw ? JSON.parse(raw) : null
    if (t && (t.style === 'A' || t.style === 'B' || t.style === 'C')) {
      return { style: t.style, accent: typeof t.accent === 'string' && HEX6.test(t.accent) ? t.accent : null }
    }
  } catch {}
  return DEFAULT
}

export function useThemeSetting(): ThemeSetting {
  const raw = useSyncExternalStore(subscribe, readRaw, () => null)
  return useMemo(() => parse(raw), [raw])
}

export function saveThemeSetting(t: ThemeSetting) {
  try {
    localStorage.setItem(KEY, JSON.stringify(t))
  } catch {}
  window.dispatchEvent(new Event(EVENT))
}

export function resolvePalette(t: ThemeSetting): Palette {
  const base = STYLES[t.style].palette
  return t.accent ? { ...base, ...accentOverrides(t.style, t.accent) } : base
}

export function usePalette(): Palette {
  const setting = useThemeSetting()
  return useMemo(() => resolvePalette(setting), [setting])
}

export function categoryColors(p: Palette, category: string | null | undefined) {
  return p.cat[category ?? 'Sonstiges'] ?? p.cat.Sonstiges
}
