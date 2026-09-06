import { DatabaseSync } from 'node:sqlite'
import fs from 'node:fs'
import path from 'node:path'

// DB path is env-overridable (CAL_DB) so a scratch instance can run without touching real data.
const dbPath = process.env.CAL_DB
  ? path.resolve(process.env.CAL_DB)
  : path.join(path.resolve(import.meta.dirname, '../data'), 'cal.db')
fs.mkdirSync(path.dirname(dbPath), { recursive: true })

export const db = new DatabaseSync(dbPath)
db.exec('PRAGMA journal_mode = WAL;')

db.exec(`
CREATE TABLE IF NOT EXISTS events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  title     TEXT    NOT NULL,
  date      TEXT    NOT NULL,            -- YYYY-MM-DD (the day the event falls on)
  all_day   INTEGER NOT NULL DEFAULT 0,  -- 1 = no specific time
  start_min INTEGER,                     -- minutes from local midnight (null when all_day)
  end_min   INTEGER,                     -- minutes from local midnight (null = no explicit end)
  note      TEXT,
  color     TEXT,                        -- optional accent name: coral | sage | gold | lilac | sky
  repeat       TEXT NOT NULL DEFAULT 'none',  -- none | daily | weekly | monthly
  repeat_until TEXT,                           -- YYYY-MM-DD (inclusive) or null for open-ended
  created   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);

-- key/value config (digest send time, phone, backend overrides) so it's easy to extend
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`)

// lightweight migration so databases created before recurrence pick up the new columns
function ensureColumn(table: string, column: string, decl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`)
}
ensureColumn('events', 'repeat', "TEXT NOT NULL DEFAULT 'none'")
ensureColumn('events', 'repeat_until', 'TEXT')

export type Row = Record<string, any>

/** Thin helpers so callers don't touch the raw statement API everywhere. */
export const q = {
  all: (sql: string, ...args: any[]): Row[] => db.prepare(sql).all(...args) as Row[],
  get: (sql: string, ...args: any[]): Row | undefined => db.prepare(sql).get(...args) as Row | undefined,
  run: (sql: string, ...args: any[]) => {
    const r = db.prepare(sql).run(...args)
    return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) }
  },
}
