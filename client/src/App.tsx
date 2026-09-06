import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { api, type EventInput, type Settings } from './lib/api'
import { useEvents } from './lib/useEvents'
import { useNow } from './lib/useNow'
import { addDays, addMonths, MONTHS, weekDays, ymd } from './lib/date'
import TimeGrid from './components/TimeGrid'
import MonthView from './components/MonthView'
import YearView from './components/YearView'
import EventModal, { type ModalSeed } from './components/EventModal'
import SettingsSheet from './components/SettingsSheet'
import { ChevronLeft, ChevronRight, Gear, Plus } from './components/icons'

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

  const openNew = (date: string, start_min?: number | null) => setSeed({ date, start_min: start_min ?? undefined })
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

  // keyboard shortcuts: t today, n new event, d/w/m/y switch view, arrows navigate.
  // skipped while a dialog is open or while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (seed || settingsOpen || e.metaKey || e.ctrlKey || e.altKey) return
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) return
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
  }, [seed, settingsOpen, view, anchor])

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
      <button onClick={() => setSettingsOpen(true)} className="rounded-lg border border-line p-2 text-dim hover:border-line-strong hover:text-ink" aria-label="Settings">
        <Gear width={17} height={17} />
      </button>
      <button
        onClick={() => openNew(ymd(view === 'year' ? new Date() : anchor))}
        title="New event (n)"
        className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[12.5px] font-semibold text-bg hover:bg-accent-bright"
      >
        <Plus width={16} height={16} />
        <span className="hidden sm:inline">Event</span>
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

        {/* desktop: nav sits next to the title */}
        <div className="hidden sm:block">{navEl}</div>

        {/* desktop: live clock */}
        <div className="num hidden items-center gap-1.5 text-[12px] text-faint md:flex">
          {now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          <span className="text-dim">{now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
        </div>

        {/* view toggle (once): full-width mobile row, right-aligned cluster on desktop */}
        <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto">
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
              <TimeGrid days={days} events={events} now={now} onEmptyClick={openNew} onEventClick={setSeed} />
            )}
            {view === 'month' && (
              <MonthView date={anchor} events={events} now={now} onDayClick={(d) => openNew(d)} onEventClick={setSeed} />
            )}
            {view === 'year' && (
              <YearView
                year={anchor.getFullYear()}
                events={events}
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
    </div>
  )
}
