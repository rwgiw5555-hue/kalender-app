'use client'
// Darstellungs-Stile der App (A, B, C) plus optional eigene Akzentfarbe.
// Alle Farben laufen über CSS-Variablen (--app-*), die ThemeStyle in :root setzt.

import { useMemo, useSyncExternalStore } from 'react'

export type StyleKey = 'A' | 'B' | 'C'

export interface Palette {
  bg: string
  surface: string
  surface2: string // leicht abgesetzte Fläche (Eingabefelder, Karten in Karten)
  ink: string
  muted: string
  line: string
  accent: string
  accentSoft: string
  onAccent: string
  danger: string
  radius: number
  bodyFont: string
  headFont: string
  dark: boolean
  tintedCards: boolean // Karten in der Kategoriefarbe (Stil C)
  cat: Record<string, { color: string; soft: string }>
}

export const STYLES: Record<StyleKey, { label: string; description: string; palette: Palette }> = {
  A: {
    label: 'Klar & ruhig',
    description: 'Hell, viel Weißraum',
    palette: {
      bg: '#F6F6F3', surface: '#FFFFFF', surface2: '#F1F1ED', ink: '#1B1D1F', muted: '#5E6368', line: '#E4E4DF',
      accent: '#0F766E', accentSoft: '#DDF1EE', onAccent: '#FFFFFF', danger: '#B42318', radius: 16,
      bodyFont: 'var(--font-jakarta)', headFont: 'var(--font-jakarta)', dark: false, tintedCards: false,
      cat: {
        Privat: { color: '#0F766E', soft: '#E3F3F0' },
        Arbeit: { color: '#2F5DA8', soft: '#E4ECF8' },
        Sport: { color: '#B45309', soft: '#FBEEDC' },
        Sonstiges: { color: '#6B5CA5', soft: '#ECE9F6' },
      },
    },
  },
  B: {
    label: 'Dunkel & fokussiert',
    description: 'Dunkel, schont die Augen',
    palette: {
      bg: '#0E1116', surface: '#171B22', surface2: '#1F242D', ink: '#F2F3F5', muted: '#A3A9B3', line: '#2A303A',
      accent: '#F5A524', accentSoft: '#3A2E14', onAccent: '#1A1300', danger: '#FF8A80', radius: 14,
      bodyFont: 'var(--font-dmsans)', headFont: 'var(--font-grotesk)', dark: true, tintedCards: false,
      cat: {
        Privat: { color: '#F5A524', soft: '#3A2E14' },
        Arbeit: { color: '#6EA8FE', soft: '#1B2B45' },
        Sport: { color: '#4ADE80', soft: '#153524' },
        Sonstiges: { color: '#C4A1FF', soft: '#2C2342' },
      },
    },
  },
  C: {
    label: 'Farbig & freundlich',
    description: 'Weiche Farben, runde Formen',
    palette: {
      bg: '#FFF8F1', surface: '#FFFFFF', surface2: '#FBF1E7', ink: '#23202B', muted: '#615C6E', line: '#EFE6DC',
      accent: '#6D3FD6', accentSoft: '#EDE5FF', onAccent: '#FFFFFF', danger: '#B42318', radius: 24,
      bodyFont: 'var(--font-figtree)', headFont: 'var(--font-figtree)', dark: false, tintedCards: true,
      cat: {
        Privat: { color: '#6D3FD6', soft: '#EDE5FF' },
        Arbeit: { color: '#1F6FD1', soft: '#E0EEFF' },
        Sport: { color: '#C2410C', soft: '#FFE8DA' },
        Sonstiges: { color: '#0E7C66', soft: '#D9F4EC' },
      },
    },
  },
}

export interface ThemeSetting {
  style: StyleKey
  accent: string | null // eigene Akzentfarbe, null = die des Stils
}

const DEFAULT: ThemeSetting = { style: 'A', accent: null }
const KEY = 'app-theme'
const EVENT = 'app-theme-change'
const HEX6 = /^#[0-9a-fA-F]{6}$/

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

// Lesbare Schrift auf einer Farbe: dunkel auf hellen, weiß auf dunklen Farben
function onColor(hex: string): string {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const lum = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  return lum > 0.35 ? '#111111' : '#FFFFFF'
}

export function resolvePalette(t: ThemeSetting): Palette {
  const base = STYLES[t.style].palette
  if (!t.accent) return base
  return {
    ...base,
    accent: t.accent,
    onAccent: onColor(t.accent),
    accentSoft: `color-mix(in srgb, ${t.accent} ${base.dark ? 22 : 14}%, ${base.surface})`,
  }
}

export function usePalette(): Palette {
  const setting = useThemeSetting()
  return useMemo(() => resolvePalette(setting), [setting])
}

export function categoryColors(p: Palette, category: string | null | undefined) {
  return p.cat[category ?? 'Sonstiges'] ?? p.cat.Sonstiges
}

// CSS-Variablen für :root
export function paletteCss(p: Palette): string {
  const vars: Record<string, string> = {
    '--app-bg': p.bg, '--app-surface': p.surface, '--app-surface-2': p.surface2, '--app-ink': p.ink,
    '--app-muted': p.muted, '--app-line': p.line, '--app-accent': p.accent, '--app-accent-soft': p.accentSoft,
    '--app-on-accent': p.onAccent, '--app-danger': p.danger, '--app-radius': `${p.radius}px`,
    '--app-font-body': p.bodyFont, '--app-font-head': p.headFont,
  }
  for (const [name, c] of Object.entries(p.cat)) {
    vars[`--cat-${name.toLowerCase()}`] = c.color
    vars[`--cat-${name.toLowerCase()}-soft`] = c.soft
  }
  return `:root{${Object.entries(vars).map(([k, v]) => `${k}:${v}`).join(';')};color-scheme:${p.dark ? 'dark' : 'light'}}`
}
