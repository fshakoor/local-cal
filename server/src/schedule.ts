import { getSetting } from './settings.js'
import { sendDigest, sendReminder, digestConfigured, ymd } from './notify.js'
import { eventsOn, wasReminded, markReminded, pruneReminderLog } from './events.js'

// A small in-process scheduler: wake once a minute to send the morning digest at its
// configured time and to fire any per-event reminders that have come due. No external
// cron needed; both go out as long as the server is running.
let lastSentDate = '' // last day the digest went out, so a restart mid-minute can't double-fire
let lastPruneDate = '' // last day we trimmed the reminder log
let running = false // guard against overlapping ticks if a send is slow

async function sendDueDigest(now: Date, log: (m: string) => void) {
  if (getSetting('digest_enabled') !== '1' || !digestConfigured()) return
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  const todayStr = ymd(now)
  if (hhmm === getSetting('digest_time') && lastSentDate !== todayStr) {
    lastSentDate = todayStr
    log(`morning digest: ${await sendDigest(now)}`)
  }
}

async function sendDueReminders(now: Date, log: (m: string) => void) {
  if (!digestConfigured()) return
  const todayStr = ymd(now)
  const nowMin = now.getHours() * 60 + now.getMinutes()
  for (const e of eventsOn(todayStr)) {
    if (e.remind_min == null || e.all_day || e.start_min == null) continue
    const fireMin = Math.max(0, e.start_min - e.remind_min)
    // fire once, any time from the lead moment up to the start (a late start still counts)
    if (nowMin < fireMin || nowMin > e.start_min || wasReminded(e.id, todayStr)) continue
    try {
      await sendReminder(e)
      markReminded(e.id, todayStr)
      log(`reminder sent: ${e.title}`)
    } catch (err) {
      log(`reminder failed: ${(err as Error).message}`)
    }
  }
}

export function startScheduler(log: (msg: string) => void) {
  const tick = async () => {
    if (running) return
    running = true
    try {
      const now = new Date()
      const todayStr = ymd(now)
      if (lastPruneDate !== todayStr) {
        lastPruneDate = todayStr
        pruneReminderLog(todayStr) // yesterday and older can't fire again
      }
      await sendDueDigest(now, log)
      await sendDueReminders(now, log)
    } catch (err) {
      log(`scheduler tick failed: ${(err as Error).message}`)
    } finally {
      running = false
    }
  }
  setInterval(tick, 60_000)
  void tick()
  if (digestConfigured()) {
    log(`scheduler armed: reminders on, digest at ${getSetting('digest_time')} local (enabled=${getSetting('digest_enabled')})`)
  } else {
    log('scheduler idle: no ntfy delivery configured (copy .env.example to .env to enable)')
  }
}
