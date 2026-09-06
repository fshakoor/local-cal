import fs from 'node:fs'
import path from 'node:path'
import { eventsOn, type Event } from './events.js'

// local-date helpers (the server runs in the machine's timezone)
const pad = (n: number) => String(n).padStart(2, '0')
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

// append-only log of digest sends, at server/data/digest.log (also GET /api/digest/log)
const LOG_PATH = path.join(path.resolve(import.meta.dirname, '../data'), 'digest.log')
function digestLog(line: string) {
  try {
    fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true })
    fs.appendFileSync(LOG_PATH, `[${new Date().toISOString()}] ${line}\n`)
  } catch {
    // logging should never break a send
  }
}

function fmtTime(min: number): string {
  const h24 = Math.floor(min / 60)
  const m = min % 60
  const ap = h24 < 12 ? 'a' : 'p'
  const h = h24 % 12 === 0 ? 12 : h24 % 12
  return m === 0 ? `${h}${ap}` : `${h}:${pad(m)}${ap}`
}

function lineFor(e: Event): string {
  if (e.all_day) return `- all day: ${e.title}`
  const t = e.end_min != null ? `${fmtTime(e.start_min!)}-${fmtTime(e.end_min)}` : fmtTime(e.start_min!)
  return `- ${t}  ${e.title}`
}

function daySection(label: string, d: Date): string {
  const nice = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const evs = eventsOn(ymd(d))
  if (!evs.length) return `${label} (${nice}):\n  nothing scheduled`
  return `${label} (${nice}):\n` + evs.map((e) => '  ' + lineFor(e)).join('\n')
}

/** Build the two-day digest. `now` lets a manual run pick a reference day. */
export function buildDigest(now = new Date()): { subject: string; body: string; count: number } {
  const today = new Date(now)
  const tomorrow = addDays(today, 1)
  const todayCount = eventsOn(ymd(today)).length
  const tomorrowCount = eventsOn(ymd(tomorrow)).length
  const body = [daySection('Today', today), '', daySection('Tomorrow', tomorrow)].join('\n')
  const date = today.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const subject = `${date}: ${todayCount} today, ${tomorrowCount} tomorrow`
  return { subject, body, count: todayCount + tomorrowCount }
}

/** Publish to ntfy (JSON publish keeps full UTF-8 in the title/message). */
async function sendNtfy(subject: string, body: string, tags: string[] = ['calendar']): Promise<void> {
  const server = process.env.NTFY_SERVER || 'https://ntfy.sh'
  const topic = process.env.NTFY_TOPIC
  if (!topic) throw new Error('ntfy not configured (set NTFY_TOPIC in .env)')
  const res = await fetch(server.replace(/\/$/, ''), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, title: subject, message: body, tags }),
  })
  if (!res.ok) {
    digestLog(`ntfy error status=${res.status}`)
    throw new Error(`ntfy responded ${res.status}`)
  }
  digestLog(`ntfy ok topic=${topic}`)
}

// "9:00 AM" from minutes-from-midnight
function clock12(min: number): string {
  const h24 = Math.floor(min / 60) % 24
  const ap = h24 < 12 ? 'AM' : 'PM'
  const h = h24 % 12 === 0 ? 12 : h24 % 12
  return `${h}:${pad(min % 60)} ${ap}`
}

// "15 min" / "1 hour" / "2 hours" for the lead time
function leadText(min: number): string {
  if (min % 60 === 0) {
    const h = min / 60
    return `${h} hour${h > 1 ? 's' : ''}`
  }
  return `${min} min`
}

/** Push a single event reminder ahead of its start time. */
export async function sendReminder(e: Event): Promise<void> {
  const at = clock12(e.start_min ?? 0)
  const lead = e.remind_min ?? 0
  const body = lead === 0 ? `Starting now, at ${at}` : `Starts at ${at}, in ${leadText(lead)}`
  digestLog(`reminder: ${e.title} (${body})`)
  await sendNtfy(e.title, body, ['bell'])
}

export async function sendDigest(now = new Date()): Promise<string> {
  const { subject, body, count } = buildDigest(now)
  digestLog(`send attempt: events=${count}`)
  await sendNtfy(subject, body)
  return `sent ${count} event(s)`
}

/** True once a delivery target is set, so the scheduler stays quiet on a fresh clone. */
export function digestConfigured(): boolean {
  return Boolean(process.env.NTFY_TOPIC)
}
