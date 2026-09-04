import { q } from './db.js'

// Runtime-editable settings live in the DB so the UI can change them without a restart.
// The ntfy topic and anything secret stays in .env and is never exposed here. Env is read
// lazily (not at import time) so dotenv has already run by the time these are called.
const defaults = (): Record<string, string> => ({
  digest_enabled: '1',
  digest_time: process.env.DIGEST_TIME || '07:00', // 24h local HH:MM
})

export function getSetting(key: string): string {
  const row = q.get('SELECT value FROM settings WHERE key = ?', key)
  return row ? String(row.value) : (defaults()[key] ?? '')
}

export function setSetting(key: string, value: string) {
  q.run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  )
}

export function allSettings(): Record<string, string> {
  const out = defaults()
  for (const r of q.all('SELECT key, value FROM settings')) out[String(r.key)] = String(r.value)
  return out
}
