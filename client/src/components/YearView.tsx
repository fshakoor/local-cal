import { useMemo } from 'react'
import clsx from 'clsx'
import type { CalEvent } from '../lib/api'
import { DOW_NARROW, MONTHS, monthMatrix, sameDay, ymd } from '../lib/date'

export default function YearView({
  year,
  events,
  now,
  onMonthClick,
  onDayClick,
}: {
  year: number
  events: CalEvent[]
  now: Date
  onMonthClick: (monthIndex: number) => void
  onDayClick: (dateYmd: string) => void
}) {
  const busy = useMemo(() => {
    const s = new Set<string>()
    for (const e of events) if (e.date.startsWith(String(year))) s.add(e.date)
    return s
  }, [events, year])

  return (
    <div className="h-full overflow-y-auto">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {MONTHS.map((name, mi) => {
          const weeks = monthMatrix(new Date(year, mi, 1))
          return (
            <div key={name} className="card card-sheen p-3">
              <button
                onClick={() => onMonthClick(mi)}
                className="serif mb-2 block w-full text-left text-[15px] font-medium text-ink hover:text-accent-bright"
              >
                {name}
              </button>
              <div className="grid grid-cols-7 gap-y-0.5">
                {DOW_NARROW.map((d, i) => (
                  <div key={i} className="text-center text-[8.5px] font-medium uppercase text-faint/70">
                    {d}
                  </div>
                ))}
                {weeks.flat().map((d) => {
                  const k = ymd(d)
                  const inMonth = d.getMonth() === mi
                  const isToday = sameDay(d, now)
                  const hasEv = inMonth && busy.has(k)
                  return (
                    <button
                      key={k}
                      onClick={() => inMonth && onDayClick(k)}
                      disabled={!inMonth}
                      className={clsx(
                        'relative mx-auto flex h-[19px] w-[19px] items-center justify-center rounded-full text-[10px] tabular-nums transition-colors',
                        !inMonth && 'invisible',
                        isToday && 'bg-accent font-semibold text-bg',
                        !isToday && hasEv && 'font-semibold text-accent-bright hover:bg-surface3',
                        !isToday && !hasEv && 'text-dim hover:bg-surface3',
                      )}
                    >
                      {d.getDate()}
                      {hasEv && !isToday && (
                        <span className="absolute bottom-[1px] left-1/2 h-[2.5px] w-[2.5px] -translate-x-1/2 rounded-full bg-accent" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
