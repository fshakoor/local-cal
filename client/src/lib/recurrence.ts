import type { CalEvent } from './api'

const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** The dates (YYYY-MM-DD) on which `ev` occurs within [from, to] inclusive. */
export function occurrencesInRange(ev: CalEvent, from: string, to: string): string[] {
  if (ev.repeat === 'none') return ev.date >= from && ev.date <= to ? [ev.date] : []
  const cap = ev.repeat_until && ev.repeat_until < to ? ev.repeat_until : to
  if (ev.date > cap) return []
  const [by, bm, bd] = ev.date.split('-').map(Number)
  const out: string[] = []
  if (ev.repeat === 'monthly') {
    for (let k = 0; k < 600; k++) {
      const d = new Date(by, bm - 1 + k, bd)
      if (d.getDate() !== bd) continue // month too short for this day, skip it
      const s = fmt(d)
      if (s > cap) break
      if (s >= from) out.push(s)
    }
  } else {
    const step = ev.repeat === 'weekly' ? 7 : 1
    let d = new Date(by, bm - 1, bd)
    for (let k = 0; k < 4000; k++) {
      const s = fmt(d)
      if (s > cap) break
      if (s >= from) out.push(s)
      d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + step)
    }
  }
  return out
}

/** Expand series events into per-occurrence instances within [from, to] (keeping the series id). */
export function expandEvents(events: CalEvent[], from: string, to: string): CalEvent[] {
  const out: CalEvent[] = []
  for (const ev of events) {
    for (const date of occurrencesInRange(ev, from, to)) out.push(date === ev.date ? ev : { ...ev, date })
  }
  return out
}
