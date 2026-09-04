import { useMemo } from 'react'
import clsx from 'clsx'
import { motion } from 'framer-motion'
import type { CalEvent } from '../lib/api'
import { DOW_SHORT, fmtMin, monthMatrix, sameDay, ymd } from '../lib/date'
import { chipStyle } from '../lib/colors'

const MAX_CHIPS = 3

export default function MonthView({
  date,
  events,
  now,
  onDayClick,
  onEventClick,
}: {
  date: Date
  events: CalEvent[]
  now: Date
  onDayClick: (dateYmd: string) => void
  onEventClick: (ev: CalEvent) => void
}) {
  const weeks = useMemo(() => monthMatrix(date), [date])
  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>()
    for (const e of events) {
      const arr = m.get(e.date) ?? []
      arr.push(e)
      m.set(e.date, arr)
    }
    for (const arr of m.values())
      arr.sort((a, b) => Number(b.all_day) - Number(a.all_day) || (a.start_min ?? 0) - (b.start_min ?? 0))
    return m
  }, [events])

  return (
    <div className="flex h-full flex-col">
      <div className="grid grid-cols-7">
        {DOW_SHORT.map((d, i) => (
          <div
            key={d}
            className={clsx('pb-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em]', i === 0 || i === 6 ? 'text-faint/70' : 'text-faint')}
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid flex-1 gap-1.5" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 gap-1.5">
            {week.map((d) => {
              const k = ymd(d)
              const evs = byDay.get(k) ?? []
              const inMonth = d.getMonth() === date.getMonth()
              const isToday = sameDay(d, now)
              const weekend = d.getDay() === 0 || d.getDay() === 6
              return (
                <motion.div
                  key={k}
                  layout
                  onClick={() => onDayClick(k)}
                  className={clsx(
                    'group flex min-h-0 cursor-pointer flex-col rounded-xl border p-1.5 transition-colors',
                    inMonth ? 'border-line bg-surface/40 hover:border-line-strong hover:bg-surface' : 'border-transparent opacity-45 hover:opacity-70',
                    weekend && inMonth && 'bg-surface/20',
                  )}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span
                      className={clsx(
                        'num flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12.5px] transition-colors',
                        isToday ? 'bg-accent font-semibold text-bg' : inMonth ? 'text-ink' : 'text-faint',
                      )}
                    >
                      {d.getDate()}
                    </span>
                    {d.getDate() === 1 && <span className="text-[9px] uppercase text-faint/70">{d.toLocaleDateString('en-US', { month: 'short' })}</span>}
                  </div>

                  <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                    {evs.slice(0, MAX_CHIPS).map((e) => (
                      <button
                        key={e.id}
                        onClick={(ev) => {
                          ev.stopPropagation()
                          onEventClick(e)
                        }}
                        style={chipStyle()}
                        className="flex items-center gap-1 truncate rounded-[6px] px-1.5 py-0.5 text-left text-[10.5px] font-medium leading-tight hover:brightness-125"
                      >
                        {!e.all_day && e.start_min != null && (
                          <span className="num shrink-0 opacity-80">{fmtMin(e.start_min, true)}</span>
                        )}
                        <span className="truncate">{e.title}</span>
                      </button>
                    ))}
                    {evs.length > MAX_CHIPS && (
                      <span className="px-1 text-[9.5px] font-medium text-faint">+{evs.length - MAX_CHIPS} more</span>
                    )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
