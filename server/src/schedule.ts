import { getSetting } from './settings.js'
import { sendDigest, digestConfigured, ymd } from './notify.js'

// A small in-process scheduler: wake once a minute, and when the local clock hits the
// configured HH:MM, send the digest once for that day. No external cron needed; it goes out
// as long as the server is running at that time.
let lastSentDate = '' // last YYYY-MM-DD we sent for, so a restart mid-minute can't double-fire

export function startScheduler(log: (msg: string) => void) {
  const tick = async () => {
    try {
      if (getSetting('digest_enabled') !== '1' || !digestConfigured()) return
      const now = new Date()
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const target = getSetting('digest_time')
      const todayStr = ymd(now)
      if (hhmm === target && lastSentDate !== todayStr) {
        lastSentDate = todayStr
        const status = await sendDigest(now)
        log(`morning digest: ${status}`)
      }
    } catch (err) {
      log(`digest failed: ${(err as Error).message}`)
    }
  }
  // align loosely to the top of each minute, then run every 60s
  setInterval(tick, 60_000)
  void tick()
  if (digestConfigured()) {
    log(`scheduler armed, digest at ${getSetting('digest_time')} local (enabled=${getSetting('digest_enabled')})`)
  } else {
    log('scheduler idle: no digest delivery configured (copy .env.example to .env to enable)')
  }
}
