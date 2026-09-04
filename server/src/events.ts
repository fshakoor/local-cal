import { z } from 'zod'
import { q, type Row } from './db.js'

export const COLORS = ['coral', 'sage', 'gold', 'lilac', 'sky'] as const

export type Event = {
  id: number
  title: string
  date: string // YYYY-MM-DD
  all_day: boolean
  start_min: number | null
  end_min: number | null
  note: string | null
  color: string | null
  created: number
}

const timeMin = z.number().int().min(0).max(24 * 60) // minutes from midnight
export const eventInput = z
  .object({
    title: z.string().trim().min(1).max(200),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    all_day: z.boolean().default(false),
    start_min: timeMin.nullable().default(null),
    end_min: timeMin.nullable().default(null),
    note: z.string().trim().max(2000).nullable().default(null),
    color: z.enum(COLORS).nullable().default(null),
  })
  .refine((e) => e.all_day || e.start_min !== null, { message: 'timed events need a start' })
  .refine((e) => e.end_min === null || e.start_min === null || e.end_min > e.start_min, {
    message: 'end must be after start',
  })

export type EventInput = z.infer<typeof eventInput>

const rowToEvent = (r: Row): Event => ({
  id: r.id,
  title: r.title,
  date: r.date,
  all_day: !!r.all_day,
  start_min: r.start_min ?? null,
  end_min: r.end_min ?? null,
  note: r.note ?? null,
  color: r.color ?? null,
  created: r.created,
})

/** Events whose day falls within [from, to] inclusive (YYYY-MM-DD strings). */
export function listEvents(from?: string, to?: string): Event[] {
  let rows: Row[]
  if (from && to) rows = q.all('SELECT * FROM events WHERE date BETWEEN ? AND ? ORDER BY date, all_day DESC, start_min', from, to)
  else rows = q.all('SELECT * FROM events ORDER BY date, all_day DESC, start_min')
  return rows.map(rowToEvent)
}

export function eventsOn(date: string): Event[] {
  return q
    .all('SELECT * FROM events WHERE date = ? ORDER BY all_day DESC, start_min', date)
    .map(rowToEvent)
}

export function createEvent(input: EventInput): Event {
  const e = eventInput.parse(input)
  const { lastInsertRowid } = q.run(
    `INSERT INTO events (title, date, all_day, start_min, end_min, note, color, created)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    e.title,
    e.date,
    e.all_day ? 1 : 0,
    e.all_day ? null : e.start_min,
    e.all_day ? null : e.end_min,
    e.note,
    e.color,
    Date.now(),
  )
  return rowToEvent(q.get('SELECT * FROM events WHERE id = ?', lastInsertRowid)!)
}

export function updateEvent(id: number, input: EventInput): Event | null {
  const e = eventInput.parse(input)
  const { changes } = q.run(
    `UPDATE events SET title = ?, date = ?, all_day = ?, start_min = ?, end_min = ?, note = ?, color = ?
     WHERE id = ?`,
    e.title,
    e.date,
    e.all_day ? 1 : 0,
    e.all_day ? null : e.start_min,
    e.all_day ? null : e.end_min,
    e.note,
    e.color,
    id,
  )
  if (!changes) return null
  return rowToEvent(q.get('SELECT * FROM events WHERE id = ?', id)!)
}

export function deleteEvent(id: number): boolean {
  return q.run('DELETE FROM events WHERE id = ?', id).changes > 0
}
