'use client'
import { useCallback, useEffect, useState } from 'react'
import Sidebar from '@/components/Sidebar'
import CalendarView from '@/components/Calendar'
import NaturalInput from '@/components/NaturalInput'

interface DbEvent {
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
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set())

  const loadEvents = useCallback(async () => {
    const res = await fetch('/api/events')
    if (res.ok) setEvents(await res.json())
  }, [])

  useEffect(() => { loadEvents() }, [loadEvents])

  function toggleCategory(cat: string) {
    setHiddenCategories(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f5f7]">
      <Sidebar hiddenCategories={hiddenCategories} onToggleCategory={toggleCategory} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-gray-100 px-6 py-3 shadow-sm">
          <NaturalInput onEventCreated={loadEvents} />
        </header>

        <main className="flex-1 overflow-auto p-4 bg-white m-4 rounded-2xl shadow-sm border border-gray-100">
          <CalendarView
            events={events}
            hiddenCategories={hiddenCategories}
            onRefresh={loadEvents}
          />
        </main>
      </div>
    </div>
  )
}
