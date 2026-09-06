import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import type { CalEvent } from '../lib/api'
import { fmtMin, MONTHS, ymd } from '../lib/date'
import { occurrencesInRange } from '../lib/recurrence'
import { Search } from './icons'

// A palette match is either a date to jump to or an event to open on a given day.
type Result =
  | { kind: 'date'; date: string }
  | { kind: 'event'; ev: CalEvent; date: string }

const pad = (n: number) => String(n).padStart(2, '0')
const MONTH_ABBR = MONTHS.map((m) => m.slice(0, 3).toLowerCase())

// Friendly one-liner for a YYYY-MM-DD ("Tue, Oct 20").
function prettyDate(dateYmd: string): string {
  const [y, m, d] = dateYmd.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  return `${dt.toLocaleDateString('en-US', { weekday: 'short' })}, ${MONTHS[m - 1].slice(0, 3)} ${d}`
}

// Turn a typed phrase into a date, if it reads like one. Handles today/tomorrow/
// yesterday, a full YYYY-MM-DD, or "oct 20" / "october 20" (this year, or next
// year when that day has already passed).
function parseDateQuery(raw: string): string | null {
  const q = raw.trim().toLowerCase()
  if (!q) return null
  const today = new Date()
  const shift = (n: number) => ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() + n))
  if (q === 'today') return shift(0)
  if (q === 'tomorrow') return shift(1)
  if (q === 'yesterday') return shift(-1)
  if (/^\d{4}-\d{2}-\d{2}$/.test(q)) return q

  const m = q.match(/^([a-z]+)\.?\s+(\d{1,2})$/)
  if (m) {
    const mi = MONTH_ABBR.findIndex((a) => m[1].startsWith(a))
    const day = Number(m[2])
    if (mi >= 0 && day >= 1 && day <= 31) {
      let year = today.getFullYear()
      const candidate = `${year}-${pad(mi + 1)}-${pad(day)}`
      if (candidate < ymd(today)) year += 1
      return `${year}-${pad(mi + 1)}-${pad(day)}`
    }
  }
  return null
}

// First occurrence on or after `today`, else null. Used to point a match at the
// day worth jumping to for recurring series.
function nextOccurrence(ev: CalEvent, today: string): string | null {
  if (ev.repeat === 'none') return ev.date >= today ? ev.date : null
  const to = `${Number(today.slice(0, 4)) + 3}-12-31`
  return occurrencesInRange(ev, today, to)[0] ?? null
}

const Kbd = ({ children }: { children: ReactNode }) => (
  <kbd className="num inline-grid min-w-[18px] place-items-center rounded border border-line bg-surface2 px-1 py-0.5 text-[10px] leading-none text-dim">
    {children}
  </kbd>
)

function Highlight({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>
  const i = text.toLowerCase().indexOf(term.toLowerCase())
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <span className="text-accent-bright">{text.slice(i, i + term.length)}</span>
      {text.slice(i + term.length)}
    </>
  )
}

export default function CommandPalette({
  open,
  onClose,
  events,
  onJump,
  onOpenEvent,
}: {
  open: boolean
  onClose: () => void
  events: CalEvent[]
  onJump: (dateYmd: string) => void
  onOpenEvent: (ev: CalEvent, dateYmd: string) => void
}) {
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setSel(0)
      // let the enter animation start before focusing so mobile keyboards behave
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const today = ymd(new Date())
  const results = useMemo<Result[]>(() => {
    const q = query.trim()
    const lower = q.toLowerCase()
    const out: Result[] = []

    const jump = parseDateQuery(q)
    if (jump) out.push({ kind: 'date', date: jump })

    if (lower) {
      const matches = events
        .filter((e) => e.title.toLowerCase().includes(lower) || (e.note ?? '').toLowerCase().includes(lower))
        .map((ev) => ({ ev, date: nextOccurrence(ev, today) ?? ev.date }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 8)
      for (const m of matches) out.push({ kind: 'event', ev: m.ev, date: m.date })
    } else {
      // nothing typed yet: offer what's coming up next
      const upcoming = events
        .map((ev) => ({ ev, date: nextOccurrence(ev, today) }))
        .filter((m): m is { ev: CalEvent; date: string } => m.date != null)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 6)
      for (const m of upcoming) out.push({ kind: 'event', ev: m.ev, date: m.date })
    }
    return out
  }, [query, events, today])

  useEffect(() => setSel(0), [query])

  const run = (r: Result) => {
    if (r.kind === 'date') onJump(r.date)
    else onOpenEvent(r.ev, r.date)
    onClose()
  }

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((s) => (results.length ? (s + 1) % results.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((s) => (results.length ? (s - 1 + results.length) % results.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (results[sel]) run(results[sel])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  // keep the highlighted row in view as you arrow through
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${sel}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="palette"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[12vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onMouseDown={onClose}
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }}
        >
          <motion.div
            className="card w-full max-w-[520px] overflow-hidden shadow-2xl"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
              <Search width={17} height={17} className="shrink-0 text-faint" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKey}
                placeholder="Search events or jump to a date"
                className="w-full bg-transparent text-[15px] text-ink outline-none placeholder:text-faint/70"
              />
            </div>

            <div ref={listRef} className="max-h-[46vh] overflow-y-auto overscroll-contain py-1.5">
              {results.length === 0 ? (
                <div className="px-4 py-6 text-center text-[13px] text-faint">
                  {query.trim() ? 'Nothing matches.' : 'No upcoming events.'}
                </div>
              ) : (
                results.map((r, i) => (
                  <button
                    key={r.kind === 'date' ? `d:${r.date}` : `e:${r.ev.id}:${r.date}`}
                    data-i={i}
                    onMouseEnter={() => setSel(i)}
                    onClick={() => run(r)}
                    className={clsx(
                      'flex w-full items-center gap-3 px-4 py-2 text-left',
                      i === sel ? 'bg-surface2' : 'hover:bg-surface2/50',
                    )}
                  >
                    {r.kind === 'date' ? (
                      <>
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line text-faint">
                          <Search width={15} height={15} />
                        </span>
                        <span className="text-[13.5px] text-ink">
                          Jump to <span className="font-medium">{prettyDate(r.date)}</span>
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line">
                          <span className="num text-[11px] font-semibold text-dim">{Number(r.date.slice(8, 10))}</span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] text-ink">
                            <Highlight text={r.ev.title} term={query.trim()} />
                          </span>
                          <span className="num text-[11.5px] text-faint">
                            {prettyDate(r.date)}
                            {!r.ev.all_day && r.ev.start_min != null && ` · ${fmtMin(r.ev.start_min)}`}
                            {r.ev.repeat !== 'none' && ' · repeats'}
                          </span>
                        </span>
                      </>
                    )}
                  </button>
                ))
              )}
            </div>

            <div className="hidden items-center gap-3 border-t border-line px-4 py-2 text-[11px] text-faint sm:flex">
              <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> move</span>
              <span className="flex items-center gap-1"><Kbd>↵</Kbd> open</span>
              <span className="flex items-center gap-1"><Kbd>esc</Kbd> close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
