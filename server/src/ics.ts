import type { Event } from './events.js'

// Minimal iCalendar (RFC 5545) export so you can back up or move your calendar anywhere.
// Timed events use floating local time, which is what you want for a personal calendar.

const pad = (n: number) => String(n).padStart(2, '0')

// escape the characters iCalendar treats as special inside a text value
const esc = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

// fold lines longer than 75 chars by continuing them on a space-prefixed line
function fold(line: string): string {
  if (line.length <= 75) return line
  const parts = [line.slice(0, 75)]
  let rest = line.slice(75)
  while (rest.length > 74) {
    parts.push(' ' + rest.slice(0, 74))
    rest = rest.slice(74)
  }
  parts.push(' ' + rest)
  return parts.join('\r\n')
}

function utcStamp(now = new Date()): string {
  return (
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
  )
}

const compactDate = (dateYmd: string) => dateYmd.replace(/-/g, '')

// next calendar day, for an all-day event's exclusive DTEND
function nextDay(dateYmd: string): string {
  const [y, m, d] = dateYmd.split('-').map(Number)
  const t = new Date(y, m - 1, d + 1)
  return `${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}`
}

// local date-time from a day plus minutes-from-midnight (rolls over past midnight)
function localDateTime(dateYmd: string, min: number): string {
  const [y, m, d] = dateYmd.split('-').map(Number)
  const t = new Date(y, m - 1, d, 0, min)
  return (
    `${t.getFullYear()}${pad(t.getMonth() + 1)}${pad(t.getDate())}` +
    `T${pad(t.getHours())}${pad(t.getMinutes())}00`
  )
}

export function buildIcs(events: Event[]): string {
  const stamp = utcStamp()
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//local-cal//EN', 'CALSCALE:GREGORIAN']

  for (const e of events) {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:local-cal-${e.id}@localhost`)
    lines.push(`DTSTAMP:${stamp}`)
    if (e.all_day || e.start_min == null) {
      lines.push(`DTSTART;VALUE=DATE:${compactDate(e.date)}`)
      lines.push(`DTEND;VALUE=DATE:${nextDay(e.date)}`)
    } else {
      lines.push(`DTSTART:${localDateTime(e.date, e.start_min)}`)
      lines.push(`DTEND:${localDateTime(e.date, e.end_min ?? Math.min(24 * 60, e.start_min + 60))}`)
    }
    lines.push(`SUMMARY:${esc(e.title)}`)
    if (e.note) lines.push(`DESCRIPTION:${esc(e.note)}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  return lines.map(fold).join('\r\n') + '\r\n'
}
