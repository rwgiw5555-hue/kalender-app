'use client'
import { paletteCss, usePalette } from '@/lib/theme'

// Setzt die Farben und Schriften des gewählten Stils als CSS-Variablen
export default function ThemeStyle() {
  const palette = usePalette()
  return <style>{paletteCss(palette)}</style>
}
