'use client'
// Hilfen, die nur im Browser laufen

import { useSyncExternalStore } from 'react'

export async function alertSaveError(res: Response) {
  const body = await res.json().catch(() => null)
  window.alert(`Speichern fehlgeschlagen: ${body?.error ?? res.statusText}`)
}

// Schalter „KI darf Termine und Aufgaben sehen“: pro Gerät im Browser gespeichert, Standard aus
const AI_CONTEXT_KEY = 'ai-calendar-context'
const AI_CONTEXT_EVENT = 'ai-calendar-context-change'

function readAiContext(): boolean {
  try {
    return localStorage.getItem(AI_CONTEXT_KEY) === '1'
  } catch {
    return false
  }
}

function subscribeAiContext(cb: () => void) {
  window.addEventListener(AI_CONTEXT_EVENT, cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener(AI_CONTEXT_EVENT, cb)
    window.removeEventListener('storage', cb)
  }
}

export function setAiContext(on: boolean) {
  try {
    if (on) localStorage.setItem(AI_CONTEXT_KEY, '1')
    else localStorage.removeItem(AI_CONTEXT_KEY)
  } catch {}
  window.dispatchEvent(new Event(AI_CONTEXT_EVENT))
}

export function useAiContext(): boolean {
  return useSyncExternalStore(subscribeAiContext, readAiContext, () => false)
}
