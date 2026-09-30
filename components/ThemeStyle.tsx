'use client'
import { useEffect } from 'react'
import { accentOverrides } from '@/lib/palettes'
import { useThemeSetting } from '@/lib/theme'

const ACCENT_VARS = { accent: '--app-accent', onAccent: '--app-on-accent', accentSoft: '--app-accent-soft', accentInk: '--app-accent-ink' } as const

// Überträgt Stilwechsel zur Laufzeit auf <html>: data-style wählt die statischen
// Farben des Stils, eine eigene Akzentfarbe kommt als Inline-Variable dazu
export default function ThemeStyle() {
  const setting = useThemeSetting()
  useEffect(() => {
    const root = document.documentElement
    root.dataset.style = setting.style
    const overrides = setting.accent ? accentOverrides(setting.style, setting.accent) : null
    for (const [key, cssVar] of Object.entries(ACCENT_VARS)) {
      if (overrides) root.style.setProperty(cssVar, overrides[key as keyof typeof ACCENT_VARS])
      else root.style.removeProperty(cssVar)
    }
  }, [setting])
  return null
}
