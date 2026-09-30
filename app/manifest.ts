import type { MetadataRoute } from 'next'

// Web-App-Manifest: „Zum Home-Bildschirm“ startet die App ohne Browserleiste
// direkt in der Tagesansicht.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kalender',
    short_name: 'Kalender',
    description: 'Mein persönlicher Kalender mit Routinen und Aufgaben',
    lang: 'de',
    start_url: '/heute',
    scope: '/',
    display: 'standalone',
    background_color: '#f9fafb',
    theme_color: '#f9fafb',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  }
}
