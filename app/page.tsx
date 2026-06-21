'use client'
import { useCallback, useEffect, useState } from 'react'
import CalendarView from '@/components/Calendar'
import EventModal, { EventFormData } from '@/components/EventModal'

export interface DbEvent {
  id: number
  title: string
  description?: string | null
  startTime: string
  endTime: string
  category?: string | null
  color?: string | null
}

export default function Home() {
  const [events, setEvents] = useState<DbEvent[]>([])
  const [addModal, setAddModal] = useState(false)

  const loadEvents = useCallback(async () => {
    const res = await fetch('/api/events')
    if (res.ok) setEvents(await res.json())
  }, [])

  useEffect(() => { loadEvents() }, [loadEvents])

  async function handleSave(data: EventFormData) {
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    setAddModal(false)
    loadEvents()
  }

  return (
    <div className="relative flex flex-col h-screen bg-white overflow-hidden">
      {/* Kalender füllt den ganzen Raum */}
      <CalendarView events={events} onRefresh={loadEvents} />

      {/* + Button unten mittig */}
      <button
        onClick={() => setAddModal(true)}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 w-14 h-14 rounded-full bg-blue-500 text-white shadow-lg hover:bg-blue-600 active:scale-95 transition-all flex items-center justify-center"
        aria-label="Neuer Termin"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {addModal && (
        <EventModal
          mode="create"
          initial={{}}
          onSave={handleSave}
          onClose={() => setAddModal(false)}
        />
      )}
    </div>
  )
}
