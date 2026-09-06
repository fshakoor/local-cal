import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { api, type CalEvent, type EventInput, type Settings } from './lib/api'
import { useEvents } from './lib/useEvents'
import { useNow } from './lib/useNow'
import { addDays, addMonths, monthMatrix, MONTHS, weekDays, ymd } from './lib/date'
import { expandEvents } from './lib/recurrence'
import TimeGrid from './components/TimeGrid'
import MonthView from './components/MonthView'
import YearView from './components/YearView'
import EventModal, { type ModalSeed } from './components/EventModal'
import SettingsSheet from './components/SettingsSheet'
import CommandPalette from './components/CommandPalette'
import { ChevronLeft, ChevronRight, Gear, Search } from './components/icons'

type View = 'day' | 'week' | 'month' | 'year'
const VIEWS: { key: View; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
]

// One instance only (its layoutId pill can't be duplicated across a hidden copy without
// thrashing framer-motion). Full-width on mobile, natural width on desktop.
function Segmented({ view, onPick }: { view: View; onPick: (v: View) => void }) {
  return (
    <div className="flex w-full rounded-xl border border-line bg-surface2/60 p-0.5 sm:w-auto">
      {VIEWS.map((v) => (
        <button
          key={v.key}
          onClick={() => onPick(v.key)}
          className={clsx(
            'relative flex-1 rounded-[9px] py-1.5 text-[12.5px] font-medium transition-colors sm:flex-none sm:px-3',
            view === v.key ? 'text-bg' : 'text-dim hover:text-ink',
          )}
        >
          {view === v.key && (
            <motion.span layoutId="seg" className="absolute inset-0 rounded-[9px] bg-accent" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
          )}
          <span className="relative z-10">{v.label}</span>
        </button>
      ))}
    </div>
  )
}

export default function App() {
  const now = useNow()
  const { events, error, create, update, remove } = useEvents()
  const [view, setView] = useState<View>('week')
  const [anchor, setAnchor] = useState<Date>(() => new Date())
  const [seed, setSeed] = useState<ModalSeed | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [dir, setDir] = useState(1) // slide direction for view content

  useEffect(() => {
    api.settings().then(setSettings).catch(() => {})
  }, [])

  const step = (delta: number) => {
    setDir(delta)
    setAnchor((a) => {
      if (view === 'day') return addDays(a, delta)
      if (view === 'week') return addDays(a, delta * 7)
      if (view === 'month') return addMonths(a, delta)
      return new Date(a.getFullYear() + delta, a.getMonth(), 1)
    })
  }
  const goToday = () => {
    setDir(1)
    setAnchor(new Date())
  }

  const label = useMemo(() => {
    if (view === 'day')
      return { big: anchor.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }), small: String(anchor.getFullYear()) }
    if (view === 'week') {
      const wd = weekDays(anchor)
      const a = wd[0]
      const b = wd[6]
      const mo = (d: Date) => d.toLocaleDateString('en-US', { month: 'short' })
      const big =
        a.getMonth() === b.getMonth()
          ? `${mo(a)} ${a.getDate()} - ${b.getDate()}`
          : `${mo(a)} ${a.getDate()} - ${mo(b)} ${b.getDate()}`
      return { big, small: String(b.getFullYear()) }
    }
    if (view === 'month') return { big: MONTHS[anchor.getMonth()], small: String(anchor.getFullYear()) }
    return { big: String(anchor.getFullYear()), small: '' }
  }, [view, anchor])

  const days = view === 'day' ? [anchor] : view === 'week' ? weekDays(anchor) : []

  // expand recurring events into occurrences within whatever range the current view shows
  const range = useMemo(() => {
    if (view === 'day') return { from: ymd(anchor), to: ymd(anchor) }
    if (view === 'week') {
      const w = weekDays(anchor)
      return { from: ymd(w[0]), to: ymd(w[6]) }
    }
    if (view === 'month') {
      const cells = monthMatrix(anchor).flat()
      return { from: ymd(cells[0]), to: ymd(cells[cells.length - 1]) }
    }
    return { from: `${anchor.getFullYear()}-01-01`, to: `${anchor.getFullYear()}-12-31` }
  }, [view, anchor])
  const shownEvents = useMemo(() => expandEvents(events, range.from, range.to), [events, range])
  // a click on any occurrence edits the whole series (the stored event)
  const openEvent = (ev: CalEvent) => setSeed(events.find((e) => e.id === ev.id) ?? ev)

  const openNew = (date: string, start_min?: number | null, end_min?: number | null) =>
    setSeed({ date, start_min: start_min ?? undefined, end_min: end_min ?? undefined })
  const onSave = async (id: number | null, input: EventInput) => {
    if (id == null) await create(input)
    else await update(id, input)
  }
  const patchSettings = async (patch: Partial<Pick<Settings, 'digest_time' | 'digest_enabled'>>) => {
    setSettings((s) => (s ? { ...s, ...patch } : s))
    try {
      setSettings(await api.patchSettings(patch))
    } catch {
      /* keep optimistic value */
    }
  }

  const jumpToDay = (dateYmd: string) => {
    const [y, m, d] = dateYmd.split('-').map(Number)
    setDir(1)
    setAnchor(new Date(y, m - 1, d))
  }
  const pickView = (v: View) => {
    setDir(1)
    setView(v)
  }

  // palette actions: land on the chosen day, and for an event open it to edit too
  const jumpToDayView = (dateYmd: string) => {
    jumpToDay(dateYmd)
    setView('day')
  }
  const openEventFromPalette = (ev: CalEvent, dateYmd: string) => {
    jumpToDayView(dateYmd)
    openEvent(ev)
  }

  // keyboard shortcuts: t today, n new event, d/w/m/y switch view, arrows navigate.
  // skipped while a dialog is open or while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)
      // search palette: Cmd/Ctrl+K anywhere, or "/" when not typing
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen(true)
        return
      }
      if (seed || settingsOpen || paletteOpen || e.metaKey || e.ctrlKey || e.altKey) return
      if (typing) return
      if (e.key === '/') {
        e.preventDefault()
        setPaletteOpen(true)
        return
      }
      const actions: Record<string, () => void> = {
        t: goToday,
        n: () => openNew(ymd(view === 'year' ? new Date() : anchor)),
        d: () => pickView('day'),
        w: () => pickView('week'),
        m: () => pickView('month'),
        y: () => pickView('year'),
        ArrowLeft: () => step(-1),
        ArrowRight: () => step(1),
      }
      const run = actions[e.key]
      if (!run) return
      e.preventDefault()
      run()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, settingsOpen, paletteOpen, view, anchor])

  // shared header pieces (rendered in both the mobile and desktop layouts)
  const titleEl = (
    <div className="flex items-baseline gap-2.5">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.h1
          key={label.big}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.22 }}
          className="serif whitespace-nowrap text-[24px] font-medium leading-none text-ink sm:text-[30px]"
        >
          {label.big}
        </motion.h1>
      </AnimatePresence>
      {label.small && <span className="num text-[14px] font-medium text-faint sm:text-[15px]">{label.small}</span>}
    </div>
  )

  const navEl = (
    <div className="flex items-center gap-1">
      <button onClick={() => step(-1)} title="Previous (left arrow)" className="rounded-lg p-1.5 text-dim hover:bg-surface2 hover:text-ink" aria-label="Previous">
        <ChevronLeft width={18} height={18} />
      </button>
      <button
        onClick={goToday}
        title="Today (t)"
        className="rounded-lg border border-line px-3 py-1.5 text-[12.5px] font-medium text-dim hover:border-line-strong hover:text-ink"
      >
        Today
      </button>
      <button onClick={() => step(1)} title="Next (right arrow)" className="rounded-lg p-1.5 text-dim hover:bg-surface2 hover:text-ink" aria-label="Next">
        <ChevronRight width={18} height={18} />
      </button>
    </div>
  )

  const actionsEl = (
    <>
      <button onClick={() => setPaletteOpen(true)} title="Search (/)" className="rounded-lg border border-line p-2 text-dim hover:border-line-strong hover:text-ink" aria-label="Search">
        <Search width={17} height={17} />
      </button>
      <button onClick={() => setSettingsOpen(true)} className="rounded-lg border border-line p-2 text-dim hover:border-line-strong hover:text-ink" aria-label="Settings">
        <Gear width={17} height={17} />
      </button>
    </>
  )

  return (
    <div className="mx-auto flex h-full max-w-[1500px] flex-col px-3 py-4 sm:px-6 sm:py-5">
      {/* Controls stack on mobile and sit in one row on desktop. The animated bits
          (title, view toggle) render once and reflow; the plain buttons are duplicated. */}
      <header className="flex flex-col gap-3 pb-4 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
        {/* title (once) */}
        {titleEl}

        {/* mobile: nav + actions share a row */}
        <div className="flex items-center justify-between gap-2 sm:hidden">
          {navEl}
          <div className="flex items-center gap-2">{actionsEl}</div>
        </div>

        {/* desktop: live clock */}
        <div className="num hidden items-center gap-1.5 text-[12px] text-faint md:flex">
          {now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          <span className="text-dim">{now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
        </div>

        {/* nav + toggle + actions: a right-aligned cluster on desktop, so its position never
            depends on the title length; on mobile only the full-width toggle lives here */}
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
          <div className="hidden sm:flex sm:items-center">{navEl}</div>
          <Segmented view={view} onPick={pickView} />
          <div className="hidden items-center gap-2 sm:flex">{actionsEl}</div>
        </div>
      </header>

      {error && <div className="mb-2 rounded-lg border border-line bg-surface px-3 py-2 text-[12px]" style={{ color: '#e06b6b' }}>Couldn't reach the calendar server. Is it running? ({error})</div>}

      {/* the calendar */}
      <main className="min-h-0 flex-1">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div
            key={view + (view === 'year' ? anchor.getFullYear() : view === 'month' ? anchor.getMonth() : ymd(anchor))}
            custom={dir}
            initial={{ opacity: 0, x: dir * 26 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -26 }}
            transition={{ duration: 0.24, ease: [0.2, 0.7, 0.3, 1] }}
            className="h-full"
          >
            {(view === 'day' || view === 'week') && (
              <TimeGrid days={days} events={shownEvents} now={now} onEmptyClick={openNew} onEventClick={openEvent} />
            )}
            {view === 'month' && (
              <MonthView
                date={anchor}
                events={shownEvents}
                now={now}
                onDayClick={(d) => {
                  jumpToDay(d)
                  setView('day')
                }}
                onEventClick={openEvent}
              />
            )}
            {view === 'year' && (
              <YearView
                year={anchor.getFullYear()}
                events={shownEvents}
                now={now}
                onMonthClick={(mi) => {
                  setDir(1)
                  setAnchor(new Date(anchor.getFullYear(), mi, 1))
                  setView('month')
                }}
                onDayClick={(d) => {
                  jumpToDay(d)
                  setView('day')
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      <EventModal seed={seed} onClose={() => setSeed(null)} onSave={onSave} onDelete={remove} />
      <SettingsSheet open={settingsOpen} settings={settings} onClose={() => setSettingsOpen(false)} onPatch={patchSettings} />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        events={events}
        onJump={jumpToDayView}
        onOpenEvent={openEventFromPalette}
      />
    </div>
  )
}
