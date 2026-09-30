// Stil-Daten und Farb-Berechnungen. Ohne 'use client', damit auch das Server-Layout
// daraus das statische CSS und das Start-Skript bauen kann.

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
  accentInk: string // Akzent als Schriftfarbe auf dem Hintergrund (lesbar)
  onAccent: string
  danger: string
  onDanger: string
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
      accent: '#0F766E', accentSoft: '#DDF1EE', accentInk: '#0F766E', onAccent: '#FFFFFF', danger: '#B42318', onDanger: '#FFFFFF', radius: 16,
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
      accent: '#F5A524', accentSoft: '#3A2E14', accentInk: '#F5A524', onAccent: '#1A1300', danger: '#FF8A80', onDanger: '#2A0A07', radius: 14,
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
      accent: '#6D3FD6', accentSoft: '#EDE5FF', accentInk: '#6D3FD6', onAccent: '#FFFFFF', danger: '#B42318', onDanger: '#FFFFFF', radius: 24,
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

export const HEX6 = /^#[0-9a-fA-F]{6}$/

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m)
  return (x + 0.05) / (y + 0.05)
}

// Eigene Akzentfarbe: passende Schrift darauf, weiche Variante und lesbare Textfarbe
export function accentOverrides(style: StyleKey, accent: string) {
  const base = STYLES[style].palette
  const onAccent = contrast(accent, '#FFFFFF') >= contrast(accent, '#111111') ? '#FFFFFF' : '#111111'
  return {
    accent,
    onAccent,
    accentSoft: `color-mix(in srgb, ${accent} ${base.dark ? 22 : 14}%, ${base.surface})`,
    // Als Schrift nur, wenn auf dem Hintergrund gut lesbar, sonst normale Textfarbe
    accentInk: contrast(accent, base.bg) >= 4.5 ? accent : base.ink,
  }
}

export function paletteVars(p: Palette): Record<string, string> {
  const vars: Record<string, string> = {
    '--app-bg': p.bg, '--app-surface': p.surface, '--app-surface-2': p.surface2, '--app-ink': p.ink,
    '--app-muted': p.muted, '--app-line': p.line, '--app-accent': p.accent, '--app-accent-soft': p.accentSoft,
    '--app-accent-ink': p.accentInk, '--app-on-accent': p.onAccent, '--app-danger': p.danger,
    '--app-on-danger': p.onDanger, '--app-radius': `${p.radius}px`,
    '--app-font-body': p.bodyFont, '--app-font-head': p.headFont,
  }
  for (const [name, c] of Object.entries(p.cat)) {
    vars[`--cat-${name.toLowerCase()}`] = c.color
    vars[`--cat-${name.toLowerCase()}-soft`] = c.soft
  }
  return vars
}

// Statisches CSS für alle Stile, ausgewählt über <html data-style="A|B|C">
export const STYLE_CSS = (Object.keys(STYLES) as StyleKey[]).map(key => {
  const p = STYLES[key].palette
  const body = Object.entries(paletteVars(p)).map(([k, v]) => `${k}:${v}`).join(';')
  return `html[data-style="${key}"]{${body};color-scheme:${p.dark ? 'dark' : 'light'}}`
}).join('\n')

// Läuft vor dem ersten Zeichnen: gespeicherten Stil und eigene Farbe setzen,
// damit beim Laden nicht kurz der Standardstil aufblitzt
function boot(data: Record<string, { bg: string; ink: string; surface: string; dark: boolean }>) {
  try {
    const t = JSON.parse(localStorage.getItem('app-theme') || 'null')
    if (!t || !data[t.style]) return
    const root = document.documentElement
    root.dataset.style = t.style
    if (typeof t.accent !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(t.accent)) return
    const lum = (h: string) => {
      const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    }
    const con = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
    const s = data[t.style]
    root.style.setProperty('--app-accent', t.accent)
    root.style.setProperty('--app-on-accent', con(t.accent, '#FFFFFF') >= con(t.accent, '#111111') ? '#FFFFFF' : '#111111')
    root.style.setProperty('--app-accent-soft', `color-mix(in srgb, ${t.accent} ${s.dark ? 22 : 14}%, ${s.surface})`)
    root.style.setProperty('--app-accent-ink', con(t.accent, s.bg) >= 4.5 ? t.accent : s.ink)
  } catch {}
}

const BOOT_DATA = Object.fromEntries((Object.keys(STYLES) as StyleKey[]).map(k => {
  const p = STYLES[k].palette
  return [k, { bg: p.bg, ink: p.ink, surface: p.surface, dark: p.dark }]
}))

export const THEME_BOOT_SCRIPT = `(${boot.toString()})(${JSON.stringify(BOOT_DATA)})`
