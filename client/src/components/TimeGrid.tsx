import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
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
  onEmptyClick: (dateYmd: string, startMin: number, endMin?: number) => void
  onEventClick: (ev: CalEvent) => void
}) {
  const scroller = useRef<HTMLDivElement>(null)

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

  // Drag on an empty column (mouse) to sketch an event's start and end, then open the editor.
  // Touch keeps native scrolling and a plain tap-to-create, so it never hijacks a scroll.
  const dragRef = useRef<{ day: string; a: number; b: number } | null>(null)
  const lastPointer = useRef<string>('mouse')
  const [dragBox, setDragBox] = useState<{ day: string; a: number; b: number } | null>(null)

  const posToMin = (clientY: number) => {
    const sc = scroller.current
    if (!sc) return 0
    const y = clientY - sc.getBoundingClientRect().top + sc.scrollTop
    return Math.max(0, Math.min(24 * 60, Math.round((y / HOUR_H) * 60 / 15) * 15))
  }
  const gridDown = (e: React.PointerEvent<HTMLDivElement>, dayYmd: string) => {
    lastPointer.current = e.pointerType
    if (e.pointerType !== 'mouse' || e.button !== 0) return // touch keeps native scroll + tap
    e.currentTarget.setPointerCapture(e.pointerId)
    const box = { day: dayYmd, a: posToMin(e.clientY), b: posToMin(e.clientY) }
    dragRef.current = box
    setDragBox(box)
  }
  const gridMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    const box = { ...dragRef.current, b: posToMin(e.clientY) }
    dragRef.current = box
    setDragBox(box)
  }
  // mouse: pointerup handles both a plain click and a drag (capture suppresses the click event)
  const gridUp = () => {
    const box = dragRef.current
    dragRef.current = null
    setDragBox(null)
    if (!box) return
    const start = Math.min(box.a, box.b)
    const end = Math.max(box.a, box.b)
    if (end - start >= 15) onEmptyClick(box.day, start, end)
    else onEmptyClick(box.day, Math.min(start, 24 * 60 - 15))
  }
  // touch: a tap creates (no capture on touch, so the click event does fire)
  const gridTap = (e: React.MouseEvent<HTMLDivElement>, dayYmd: string) => {
    if (lastPointer.current === 'mouse') return
    onEmptyClick(dayYmd, Math.min(posToMin(e.clientY), 24 * 60 - 15))
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
                className="relative flex-1 select-none border-l border-line"
                onPointerDown={(e) => gridDown(e, ymd(d))}
                onPointerMove={gridMove}
                onPointerUp={gridUp}
                onClick={(e) => gridTap(e, ymd(d))}
              >
                {/* hour lines */}
                {HOURS.map((h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-line/70" style={{ top: h * HOUR_H }} />
                ))}

                {/* events: stagger in on load, pop in when added, collapse out when removed */}
                <AnimatePresence>
                  {placed.map((p, i) => {
                    const top = (p.start / 60) * HOUR_H
                    const height = Math.max(16, ((p.end - p.start) / 60) * HOUR_H - 2)
                    const w = 100 / p.cols
                    return (
                      <motion.button
                        key={p.ev.id}
                        initial={{ opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.14 } }}
                        transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.2) }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation()
                          onEventClick(p.ev)
                        }}
                        style={{
                          top,
                          height,
                          left: `calc(${p.col * w}% + 2px)`,
                          width: `calc(${w}% - 4px)`,
                          transformOrigin: 'top',
                        }}
                        className="ev-block absolute text-left"
                      >
                        <div className="ev-title">{p.ev.title}</div>
                        {height > 32 && (
                          <div className="ev-time">
                            {fmtMin(p.start, true)}
                            {p.ev.end_min != null && `-${fmtMin(p.ev.end_min, true)}`}
                          </div>
                        )}
                      </motion.button>
                    )
                  })}
                </AnimatePresence>

                {/* current-time line */}
                {isToday && (
                  <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: (minutesOfDay(now) / 60) * HOUR_H }}>
                    <div className="relative border-t border-accent">
                      <div className="absolute -left-[3px] -top-[3.5px] h-[7px] w-[7px] rounded-full bg-accent" />
                    </div>
                  </div>
                )}

                {/* live selection while dragging to create */}
                {dragBox &&
                  dragBox.day === ymd(d) &&
                  (() => {
                    const s = Math.min(dragBox.a, dragBox.b)
                    const e2 = Math.max(dragBox.a, dragBox.b)
                    return (
                      <div
                        className="pointer-events-none absolute inset-x-0.5 z-20 overflow-hidden rounded-md"
                        style={{
                          top: (s / 60) * HOUR_H,
                          height: Math.max(3, ((e2 - s) / 60) * HOUR_H),
                          background: 'var(--color-accent-soft)',
                          border: '1px solid var(--color-accent)',
                        }}
                      >
                        {e2 > s && (
                          <div className="px-1.5 py-0.5 text-[10px]" style={{ color: 'var(--color-accent)' }}>
                            {fmtMin(s, true)}-{fmtMin(e2, true)}
                          </div>
                        )}
                      </div>
                    )
                  })()}
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
