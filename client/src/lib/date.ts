// All date math is local-time. Days are keyed by a YYYY-MM-DD string.
const pad = (n: number) => String(n).padStart(2, '0')

export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** Parse a YYYY-MM-DD into a Date at local midnight. */
export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
export const sameDay = (a: Date, b: Date) => ymd(a) === ymd(b)

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}
export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

/** Sunday-based start of the week containing d. */
export function startOfWeek(d: Date): Date {
  const x = midnight(d)
  x.setDate(x.getDate() - x.getDay())
  return x
}

/** Seven Dates, Sun→Sat, for the week containing d. */
export function weekDays(d: Date): Date[] {
  const s = startOfWeek(d)
  return Array.from({ length: 7 }, (_, i) => addDays(s, i))
}

/** Weeks (each 7 Dates) spanning the full month grid that contains `date`. */
export function monthMatrix(date: Date): Date[][] {
  const first = new Date(date.getFullYear(), date.getMonth(), 1)
  const start = startOfWeek(first)
  const weeks: Date[][] = []
  let cur = start
  // enough rows to cover the month (5 or 6)
  for (let w = 0; w < 6; w++) {
    const row = Array.from({ length: 7 }, (_, i) => addDays(cur, i))
    weeks.push(row)
    cur = addDays(cur, 7)
    // stop after we've passed the month end and completed a week
    if (row[6].getMonth() !== date.getMonth() && row[0].getMonth() !== date.getMonth() && w >= 4) break
  }
  return weeks
}

export const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes()

/** 540 → "9:00 AM"; omit :00 when short. */
export function fmtMin(min: number, short = false): string {
  const h24 = Math.floor(min / 60) % 24
  const m = min % 60
  const ampm = h24 < 12 ? 'AM' : 'PM'
  const h = h24 % 12 === 0 ? 12 : h24 % 12
  if (short) return m === 0 ? `${h}${ampm[0].toLowerCase()}` : `${h}:${pad(m)}${ampm[0].toLowerCase()}`
  return `${h}:${pad(m)} ${ampm}`
}

export const DOW_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const DOW_NARROW = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
