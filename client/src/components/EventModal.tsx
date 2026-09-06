import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import type { CalEvent, EventInput } from '../lib/api'
import { MONTHS } from '../lib/date'
import { Trash, X } from './icons'

const pad = (n: number) => String(n).padStart(2, '0')
const minToInput = (min: number | null) =>
  min == null ? '' : min >= 1440 ? '23:59' : `${pad(Math.floor(min / 60))}:${pad(min % 60)}`
const inputToMin = (s: string): number | null => {
  if (!s) return null
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}

export type ModalSeed = { date: string; start_min?: number | null; end_min?: number | null } | CalEvent

const isExisting = (s: ModalSeed): s is CalEvent => 'id' in s

export default function EventModal({
  seed,
  onClose,
  onSave,
  onDelete,
}: {
  seed: ModalSeed | null
  onClose: () => void
  onSave: (id: number | null, input: EventInput) => Promise<void>
  onDelete: (id: number) => void
}) {
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [allDay, setAllDay] = useState(false)
  const [start, setStart] = useState('09:00')
  const [end, setEnd] = useState('10:00')
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const existing = seed && isExisting(seed) ? seed : null

  useEffect(() => {
    if (!seed) return
    setErr(null)
    if (isExisting(seed)) {
      setTitle(seed.title)
      setDate(seed.date)
      setAllDay(seed.all_day)
      setStart(minToInput(seed.start_min) || '09:00')
      setEnd(minToInput(seed.end_min) || '')
      setNote(seed.note ?? '')
    } else {
      setTitle('')
      setDate(seed.date)
      setAllDay(false)
      const s = seed.start_min ?? 9 * 60
      const e = seed.end_min ?? Math.min(24 * 60, s + 60)
      setStart(minToInput(s)!)
      setEnd(minToInput(e)!)
      setNote('')
    }
  }, [seed])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async () => {
    if (!title.trim()) return setErr('Give it a title.')
    const start_min = allDay ? null : inputToMin(start)
    const end_min = allDay ? null : inputToMin(end)
    if (!allDay && start_min == null) return setErr('Pick a start time.')
    if (end_min != null && start_min != null && end_min <= start_min) return setErr('End must be after start.')
    const input: EventInput = { title: title.trim(), date, all_day: allDay, start_min, end_min, note: note.trim() || null, color: null }
    setBusy(true)
    try {
      await onSave(existing?.id ?? null, input)
      onClose()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const niceDate = date
    ? (() => {
        const [y, m, d] = date.split('-').map(Number)
        const dt = new Date(y, m - 1, d)
        return `${dt.toLocaleDateString('en-US', { weekday: 'long' })}, ${MONTHS[m - 1]} ${d}`
      })()
    : ''

  return (
    <AnimatePresence>
      {seed && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[10vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={onClose}
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }}
        >
          <motion.div
            className="card card-sheen w-full max-w-[440px] overflow-hidden shadow-2xl"
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pb-1 pt-4">
              <span className="eyebrow">{existing ? 'Edit event' : 'New event'}</span>
              <button onClick={onClose} className="rounded-md p-1 text-faint hover:bg-surface2 hover:text-ink">
                <X />
              </button>
            </div>

            <div className="space-y-3.5 px-5 pb-5 pt-1">
              <input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && submit()}
                placeholder="Add title"
                className="serif w-full border-b border-line bg-transparent pb-1.5 text-[22px] font-medium text-ink outline-none placeholder:text-faint/60 focus:border-accent"
              />

              <div className="flex items-center justify-between text-[13px]">
                <span className="text-dim">{niceDate}</span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="num rounded-md border border-line bg-surface2 px-2 py-1 text-[12px] text-ink outline-none focus:border-accent"
                />
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setAllDay((v) => !v)}
                  className={clsx(
                    'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors',
                    allDay ? 'border-accent/50 bg-accent-soft text-accent-bright' : 'border-line text-dim hover:text-ink',
                  )}
                >
                  <span className={clsx('h-3.5 w-3.5 rounded-[4px] border', allDay ? 'border-accent bg-accent' : 'border-line-strong')} />
                  All day
                </button>

                {!allDay && (
                  <div className="num flex items-center gap-1.5 text-[12px]">
                    <input
                      type="time"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                      className="rounded-md border border-line bg-surface2 px-2 py-1 text-ink outline-none focus:border-accent"
                    />
                    <span className="text-faint">to</span>
                    <input
                      type="time"
                      value={end}
                      onChange={(e) => setEnd(e.target.value)}
                      className="rounded-md border border-line bg-surface2 px-2 py-1 text-ink outline-none focus:border-accent"
                    />
                  </div>
                )}
              </div>

              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                rows={2}
                className="w-full resize-none rounded-lg border border-line bg-surface2 px-2.5 py-1.5 text-[12.5px] text-ink outline-none placeholder:text-faint/60 focus:border-accent"
              />

              {err && <div className="text-[12px]" style={{ color: '#e06b6b' }}>{err}</div>}

              <div className="flex items-center gap-2 pt-1">
                {existing && (
                  <button
                    onClick={() => {
                      onDelete(existing.id)
                      onClose()
                    }}
                    className="mr-auto flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-2 text-[12px] text-faint hover:border-line-strong hover:text-ink"
                  >
                    <Trash width={14} height={14} /> Delete
                  </button>
                )}
                <button onClick={onClose} className="ml-auto rounded-lg px-3 py-2 text-[13px] text-dim hover:text-ink">
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={busy}
                  className="rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-bg hover:bg-accent-bright disabled:opacity-60"
                >
                  {existing ? 'Save' : 'Add event'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
