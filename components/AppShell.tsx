'use client'
import Link from 'next/link'
import { useState } from 'react'
import Icon, { IconName } from './Icon'
import SettingsPanel from './SettingsPanel'

type Page = 'heute' | 'kalender'

const NAV: { page: Page; href: string; label: string; icon: IconName }[] = [
  { page: 'heute', href: '/heute', label: 'Mein Tag', icon: 'sun' },
  { page: 'kalender', href: '/', label: 'Kalender', icon: 'calendar' },
]

// App-Rahmen: am PC Seitenleiste links, auf dem Handy Tab-Leiste unten
export default function AppShell({ active, sidebar, children }: { active: Page; sidebar?: React.ReactNode; children: React.ReactNode }) {
  const [settings, setSettings] = useState(false)

  return (
    <div className="h-full flex bg-bg text-ink">
      <aside className="hidden lg:flex w-[300px] shrink-0 flex-col gap-6 border-r border-line bg-surface px-5 py-6 overflow-y-auto">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-[calc(var(--app-radius)*0.6)] bg-accent text-on-accent flex items-center justify-center">
            <Icon name="calendar" size={20} />
          </span>
          <span className="font-head text-xl font-bold">Kalender</span>
        </div>

        <nav aria-label="Hauptnavigation" className="flex gap-1 p-1 rounded-full bg-surface-2">
          {NAV.map(n => (
            <Link
              key={n.page}
              href={n.href}
              aria-current={active === n.page ? 'page' : undefined}
              className={`flex-1 h-9 rounded-full flex items-center justify-center gap-2 text-sm font-semibold transition-colors ${
                active === n.page ? 'bg-accent text-on-accent' : 'text-muted hover:text-ink'
              }`}
            >
              <Icon name={n.icon} size={16} />
              {n.label}
            </Link>
          ))}
        </nav>

        {sidebar}

        <button
          type="button"
          onClick={() => setSettings(true)}
          className="mt-auto flex items-center gap-2 h-10 px-3 -mx-1 rounded-[calc(var(--app-radius)*0.6)] text-sm font-semibold text-muted hover:text-ink hover:bg-surface-2"
        >
          <Icon name="settings" size={18} />
          Einstellungen
        </button>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <main className="flex-1 min-h-0 flex flex-col">{children}</main>

        <nav
          aria-label="Hauptnavigation"
          className="lg:hidden flex justify-around border-t border-line bg-surface px-3 pt-2"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          {NAV.map(n => (
            <Link
              key={n.page}
              href={n.href}
              aria-current={active === n.page ? 'page' : undefined}
              className={`min-w-16 min-h-11 flex flex-col items-center justify-center gap-1 text-xs font-semibold ${active === n.page ? 'text-accent' : 'text-muted'}`}
            >
              <Icon name={n.icon} size={22} />
              {n.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setSettings(true)}
            className="min-w-16 min-h-11 flex flex-col items-center justify-center gap-1 text-xs font-semibold text-muted"
          >
            <Icon name="settings" size={22} />
            Einstellungen
          </button>
        </nav>
      </div>

      {settings && <SettingsPanel onClose={() => setSettings(false)} />}
    </div>
  )
}
