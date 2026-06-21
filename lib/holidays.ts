// Berechnet Ostersonntag nach dem Gauss-Algorithmus
function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function fmt(d: Date): string {
  return d.toISOString().split('T')[0]
}

export interface Holiday {
  title: string
  start: string
  allDay: true
  display: 'background'
  backgroundColor: string
  classNames: string[]
}

export function getHolidays(year: number): Holiday[] {
  const easter = easterSunday(year)
  const color = 'rgba(96,165,250,0.15)'

  const fixed = [
    { title: '🎉 Neujahr', date: new Date(year, 0, 1) },
    { title: '✝️ Heilige Drei Könige', date: new Date(year, 0, 6) },  // SA
    { title: '🌸 Tag der Arbeit', date: new Date(year, 4, 1) },
    { title: '🇩🇪 Tag der Deutschen Einheit', date: new Date(year, 9, 3) },
    { title: '⛪ Reformationstag', date: new Date(year, 9, 31) },       // SA
    { title: '🎄 1. Weihnachtstag', date: new Date(year, 11, 25) },
    { title: '🎄 2. Weihnachtstag', date: new Date(year, 11, 26) },
  ]

  const movable = [
    { title: '✝️ Karfreitag', date: addDays(easter, -2) },
    { title: '🐣 Ostersonntag', date: easter },
    { title: '🐣 Ostermontag', date: addDays(easter, 1) },
    { title: '✝️ Christi Himmelfahrt', date: addDays(easter, 39) },
    { title: '🕊️ Pfingstsonntag', date: addDays(easter, 49) },
    { title: '🕊️ Pfingstmontag', date: addDays(easter, 50) },
  ]

  return [...fixed, ...movable].map(h => ({
    title: h.title,
    start: fmt(h.date),
    allDay: true as const,
    display: 'background' as const,
    backgroundColor: color,
    classNames: ['fc-holiday'],
  }))
}

export function getHolidaysForRange(startYear: number, endYear: number): Holiday[] {
  const result: Holiday[] = []
  for (let y = startYear; y <= endYear; y++) {
    result.push(...getHolidays(y))
  }
  return result
}
