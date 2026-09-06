import { z } from 'zod'
import { q, type Row } from './db.js'

export const COLORS = ['coral', 'sage', 'gold', 'lilac', 'sky'] as const
export const REPEATS = ['none', 'daily', 'weekly', 'monthly'] as const
export type Repeat = (typeof REPEATS)[number]

export type Event = {
  id: number
  title: string
  date: string // YYYY-MM-DD
  all_day: boolean
  start_min: number | null
  end_min: number | null
  note: string | null
  color: string | null
  repeat: Repeat
  repeat_until: string | null // YYYY-MM-DD inclusive, or null for open-ended
  remind_min: number | null // minutes before start to push a reminder, or null for none
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
    repeat: z.enum(REPEATS).default('none'),
    repeat_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
    remind_min: z.number().int().min(0).max(24 * 60).nullable().default(null),
  })
  .refine((e) => e.all_day || e.start_min !== null, { message: 'timed events need a start' })
  .refine((e) => e.end_min === null || e.start_min === null || e.end_min > e.start_min, {
    message: 'end must be after start',
  })
  .refine((e) => e.repeat === 'none' || !e.repeat_until || e.repeat_until >= e.date, {
    message: 'the repeat end must be on or after the start date',
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
  repeat: (r.repeat ?? 'none') as Repeat,
  repeat_until: r.repeat_until ?? null,
  remind_min: r.remind_min ?? null,
  created: r.created,
})

/** Does a single or recurring event have an occurrence on this date? */
export function occursOn(ev: Event, date: string): boolean {
  if (ev.repeat === 'none') return ev.date === date
  if (date < ev.date) return false
  if (ev.repeat_until && date > ev.repeat_until) return false
  const [by, bm, bd] = ev.date.split('-').map(Number)
  const [ty, tm, td] = date.split('-').map(Number)
  const days = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(by, bm - 1, bd)) / 86_400_000)
  if (ev.repeat === 'daily') return days >= 0
  if (ev.repeat === 'weekly') return days % 7 === 0
  return td === bd // monthly: same day of month
}

/** Raw stored events (series definitions). The client expands recurrences for display. */
export function listEvents(from?: string, to?: string): Event[] {
  let rows: Row[]
  if (from && to) rows = q.all('SELECT * FROM events WHERE date BETWEEN ? AND ? ORDER BY date, all_day DESC, start_min', from, to)
  else rows = q.all('SELECT * FROM events ORDER BY date, all_day DESC, start_min')
  return rows.map(rowToEvent)
}

/** Every event with an occurrence on `date`, recurrences expanded (used by the digest). */
export function eventsOn(date: string): Event[] {
  return q
    .all('SELECT * FROM events')
    .map(rowToEvent)
    .filter((e) => occursOn(e, date))
    .sort((a, b) => Number(b.all_day) - Number(a.all_day) || (a.start_min ?? 0) - (b.start_min ?? 0))
}

// column values shared by insert and update, in schema order (minus id/created)
function writeArgs(e: EventInput): unknown[] {
  return [
    e.title,
    e.date,
    e.all_day ? 1 : 0,
    e.all_day ? null : e.start_min,
    e.all_day ? null : e.end_min,
    e.note,
    e.color,
    e.repeat,
    e.repeat === 'none' ? null : e.repeat_until,
    e.all_day ? null : e.remind_min, // reminders need a start time
  ]
}

export function createEvent(input: EventInput): Event {
  const e = eventInput.parse(input)
  const { lastInsertRowid } = q.run(
    `INSERT INTO events (title, date, all_day, start_min, end_min, note, color, repeat, repeat_until, remind_min, created)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ...writeArgs(e),
    Date.now(),
  )
  return rowToEvent(q.get('SELECT * FROM events WHERE id = ?', lastInsertRowid)!)
}

export function updateEvent(id: number, input: EventInput): Event | null {
  const e = eventInput.parse(input)
  const { changes } = q.run(
    `UPDATE events SET title = ?, date = ?, all_day = ?, start_min = ?, end_min = ?, note = ?, color = ?, repeat = ?, repeat_until = ?, remind_min = ?
     WHERE id = ?`,
    ...writeArgs(e),
    id,
  )
  if (!changes) return null
  clearReminders(id) // time or reminder may have moved; let today re-evaluate
  return rowToEvent(q.get('SELECT * FROM events WHERE id = ?', id)!)
}

export function deleteEvent(id: number): boolean {
  clearReminders(id)
  return q.run('DELETE FROM events WHERE id = ?', id).changes > 0
}

// --- reminder bookkeeping (used by the scheduler to fire each reminder once) ---

export function wasReminded(eventId: number, occDate: string): boolean {
  return !!q.get('SELECT 1 FROM reminder_log WHERE event_id = ? AND occ_date = ?', eventId, occDate)
}

export function markReminded(eventId: number, occDate: string): void {
  q.run('INSERT OR IGNORE INTO reminder_log (event_id, occ_date, sent_at) VALUES (?, ?, ?)', eventId, occDate, Date.now())
}

// forget an event's sends so a rescheduled (or removed) event doesn't leave stale rows
export function clearReminders(eventId: number): void {
  q.run('DELETE FROM reminder_log WHERE event_id = ?', eventId)
}

// keep the log from growing forever; yesterday and older can't fire again
export function pruneReminderLog(beforeDate: string): void {
  q.run('DELETE FROM reminder_log WHERE occ_date < ?', beforeDate)
}
