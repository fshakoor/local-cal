import { useEffect, useMemo, useRef } from 'react'
import clsx from 'clsx'
import type { CalEvent } from '../lib/api'
import { DOW_SHORT, fmtMin, minutesOfDay, sameDay, ymd } from '../lib/date'
import { layoutTimed } from '../lib/layout'

const HOUR_H = 48 // px per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i)

export default function TimeGrid({
  days,
  events,
  now,
  onEmptyClick,
  onEventClick,
}: {
  days: Date[]
  events: CalEvent[]
  now: Date
  onEmptyClick: (dateYmd: string, minute: number) => void
  onEventClick: (ev: CalEvent) => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const compact = days.length > 1

  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>()
    for (const e of events) (m.get(e.date) ?? m.set(e.date, []).get(e.date)!).push(e)
    return m
  }, [events])

  const anyAllDay = days.some((d) => (byDay.get(ymd(d)) ?? []).some((e) => e.all_day))

  // open near the working day (or the current time) on first paint
  useEffect(() => {
    const target = Math.max(0, (minutesOfDay(now) / 60 - 1.5) * HOUR_H)
    const start = days.some((d) => sameDay(d, now)) ? target : 7.5 * HOUR_H
    scroller.current?.scrollTo({ top: start })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days.length])

  const clickMinute = (e: React.MouseEvent<HTMLDivElement>, d: Date) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top + (scroller.current?.scrollTop ?? 0)
    const min = Math.max(0, Math.min(24 * 60 - 15, Math.round((y / HOUR_H) * 60 / 15) * 15))
    onEmptyClick(ymd(d), min)
  }

  return (
    <div className="flex h-full flex-col">
      {/* day headers, full width and aligned to the columns below */}
      <div className="flex">
        {days.map((d) => {
          const isToday = sameDay(d, now)
          return (
            <div key={ymd(d)} className="flex flex-1 flex-col items-center gap-0.5 pb-2">
              <span className="eyebrow" style={{ letterSpacing: '0.12em' }}>
                {DOW_SHORT[d.getDay()]}
              </span>
              <span
                className={clsx(
                  'num flex h-8 w-8 items-center justify-center rounded-full text-[15px] font-medium transition-colors',
                  isToday ? 'bg-accent text-bg font-semibold' : 'text-ink',
                )}
              >
                {d.getDate()}
              </span>
            </div>
          )
        })}
      </div>

      {/* all-day strip */}
      {anyAllDay && (
        <div className="flex items-stretch border-y border-line">
          {days.map((d) => {
            const allday = (byDay.get(ymd(d)) ?? []).filter((e) => e.all_day)
            return (
              <div key={ymd(d)} className="flex-1 space-y-1 border-l border-line px-1 py-1">
                {allday.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => onEventClick(e)}
                    className="ev-block block w-full text-left"
                  >
                    <span className="ev-title">{e.title}</span>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* scrollable time grid */}
      <div ref={scroller} className="relative flex-1 overflow-y-auto">
        <div className="relative flex" style={{ height: 24 * HOUR_H }}>
          {/* day columns fill the full width; hour labels float over their left edge */}
          {days.map((d) => {
            const dayEvents = byDay.get(ymd(d)) ?? []
            const placed = layoutTimed(dayEvents)
            const isToday = sameDay(d, now)
            return (
              <div
                key={ymd(d)}
                className="relative flex-1 border-l border-line"
                onClick={(e) => clickMinute(e, d)}
              >
                {/* hour lines */}
                {HOURS.map((h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-line/70" style={{ top: h * HOUR_H }} />
                ))}

                {/* events */}
                {placed.map((p) => {
                  const top = (p.start / 60) * HOUR_H
                  const height = Math.max(16, ((p.end - p.start) / 60) * HOUR_H - 2)
                  const w = 100 / p.cols
                  return (
                    <button
                      key={p.ev.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        onEventClick(p.ev)
                      }}
                      style={{
                        top,
                        height,
                        left: `calc(${p.col * w}% + 2px)`,
                        width: `calc(${w}% - 4px)`,
                      }}
                      className="ev-block absolute text-left"
                    >
                      <div className="ev-title">{p.ev.title}</div>
                      {!compact && height > 30 && (
                        <div className="ev-time">
                          {fmtMin(p.start, true)}
                          {p.ev.end_min != null && `-${fmtMin(p.ev.end_min, true)}`}
                        </div>
                      )}
                    </button>
                  )
                })}

                {/* current-time line */}
                {isToday && (
                  <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: (minutesOfDay(now) / 60) * HOUR_H }}>
                    <div className="relative border-t border-accent">
                      <div className="absolute -left-[3px] -top-[3.5px] h-[7px] w-[7px] rounded-full bg-accent" />
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {/* hour labels, floating over the grid's left edge (a subtle chip keeps them
              legible if an event sits underneath) */}
          <div className="pointer-events-none absolute inset-y-0 left-0 z-20">
            {HOURS.map((h) =>
              h === 0 ? null : (
                <span
                  key={h}
                  className="num absolute left-1 -translate-y-1/2 rounded bg-bg/80 px-1 text-[10px] text-faint"
                  style={{ top: h * HOUR_H }}
                >
                  {fmtMin(h * 60, true)}
                </span>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
