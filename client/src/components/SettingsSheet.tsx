import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import clsx from 'clsx'
import { api, type Settings } from '../lib/api'
import { useTheme, type AccentKey, type ThemeMode } from '../lib/theme'
import { X } from './icons'

const MODES: { key: ThemeMode; label: string }[] = [
  { key: 'oled', label: 'OLED' },
  { key: 'dark', label: 'Dark' },
  { key: 'light', label: 'Light' },
]
const ACCENTS: { key: AccentKey; css: string }[] = [
  { key: 'mono', css: 'linear-gradient(135deg, var(--color-ink) 50%, var(--color-faint) 50%)' },
  { key: 'orange', css: '#f97316' },
  { key: 'blue', css: '#3b82f6' },
  { key: 'green', css: '#22c55e' },
  { key: 'purple', css: '#a855f7' },
  { key: 'red', css: '#ef4444' },
]

export default function SettingsSheet({
  open,
  settings,
  onClose,
  onPatch,
}: {
  open: boolean
  settings: Settings | null
  onClose: () => void
  onPatch: (patch: Partial<Pick<Settings, 'digest_time' | 'digest_enabled'>>) => void
}) {
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null)
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const { theme, update } = useTheme()

  useEffect(() => {
    if (!open) return
    setTestMsg(null)
    api.digestPreview().then(setPreview).catch(() => setPreview(null))
  }, [open])

  const enabled = settings?.digest_enabled === '1'

  const runTest = async () => {
    setTesting(true)
    setTestMsg(null)
    try {
      const r = await api.digestTest()
      if (r.ok) setTestMsg({ ok: true, text: r.status || 'Sent.' })
      else setTestMsg({ ok: false, text: r.error || 'Failed.' })
    } catch (e) {
      setTestMsg({ ok: false, text: (e as Error).message })
    } finally {
      setTesting(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-end p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={onClose}
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }}
        >
          <motion.div
            className="card card-sheen w-full max-w-[360px] p-5 shadow-2xl"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="serif text-[18px] font-medium text-ink">Settings</div>
              <button onClick={onClose} className="rounded-md p-1 text-faint hover:bg-surface2 hover:text-ink">
                <X />
              </button>
            </div>

            <div className="eyebrow mb-2">Appearance</div>
            <div className="mb-2 flex rounded-xl border border-line bg-surface2/60 p-0.5">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  onClick={() => update({ mode: m.key })}
                  className={clsx(
                    'flex-1 rounded-[9px] py-1.5 text-[12.5px] font-medium transition-colors',
                    theme.mode === m.key ? 'bg-accent text-bg' : 'text-dim hover:text-ink',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="mb-5 flex items-center justify-between rounded-xl border border-line bg-surface2/60 px-3.5 py-2.5">
              <span className="text-[13px] text-ink">Accent</span>
              <div className="flex items-center gap-2">
                {ACCENTS.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => update({ accent: s.key })}
                    aria-label={s.key}
                    className={clsx(
                      'h-5 w-5 rounded-full border transition-transform',
                      theme.accent === s.key ? 'scale-110 border-ink' : 'border-transparent opacity-80 hover:opacity-100',
                    )}
                    style={{ background: s.css }}
                  />
                ))}
              </div>
            </div>

            <div className="eyebrow mb-2">Daily digest</div>

            <div className="flex items-center justify-between rounded-xl border border-line bg-surface2/60 px-3.5 py-3">
              <div>
                <div className="text-[13px] text-ink">Morning notification</div>
                <div className="text-[11px] text-faint">Today and tomorrow's events</div>
              </div>
              <button
                role="switch"
                aria-checked={enabled}
                onClick={() => onPatch({ digest_enabled: enabled ? '0' : '1' })}
                className={clsx('relative h-6 w-11 shrink-0 rounded-full transition-colors', enabled ? 'bg-accent' : 'bg-surface3')}
              >
                <motion.span
                  layout
                  transition={{ type: 'spring', stiffness: 500, damping: 32 }}
                  className={clsx('absolute top-0.5 h-5 w-5 rounded-full shadow', enabled ? 'left-[22px] bg-bg' : 'left-0.5 bg-ink')}
                />
              </button>
            </div>

            <div className={clsx('mt-2 flex items-center justify-between rounded-xl border border-line bg-surface2/60 px-3.5 py-3 transition-opacity', !enabled && 'opacity-45')}>
              <span className="text-[13px] text-ink">Send at</span>
              <input
                type="time"
                disabled={!enabled}
                value={settings?.digest_time ?? '07:00'}
                onChange={(e) => onPatch({ digest_time: e.target.value })}
                className="num rounded-md border border-line bg-surface px-2 py-1 text-[13px] text-ink outline-none focus:border-accent"
              />
            </div>

            <div className="mt-4">
              <div className="eyebrow mb-1.5">Preview</div>
              <div className="rounded-xl border border-line bg-bg p-3">
                <div className="mb-1 text-[12px] font-semibold text-ink">{preview?.subject ?? '...'}</div>
                <pre className="whitespace-pre-wrap font-sans text-[11.5px] leading-relaxed text-dim">{preview?.body ?? ''}</pre>
              </div>
            </div>

            <button
              onClick={runTest}
              disabled={testing}
              className="mt-4 w-full rounded-lg bg-accent px-4 py-2.5 text-[13px] font-semibold text-bg hover:bg-accent-bright disabled:opacity-60"
            >
              {testing ? 'Sending...' : 'Send a test now'}
            </button>
            {testMsg && (
              <div className="mt-2 text-center text-[12px]" style={{ color: testMsg.ok ? 'var(--color-ink)' : '#e06b6b' }}>
                {testMsg.text}
              </div>
            )}

            <p className="mt-4 text-[11px] leading-relaxed text-faint">
              Set your ntfy topic in the local <span className="num text-dim">.env</span> file. The digest only sends while the
              app is running at the set time.
            </p>

            <div className="eyebrow mb-2 mt-6">Data</div>
            <a
              href="/api/events.ics"
              download="local-cal.ics"
              className="block w-full rounded-lg border border-line px-4 py-2.5 text-center text-[13px] font-medium text-ink hover:border-line-strong"
            >
              Export .ics
            </a>
            <p className="mt-2 text-[11px] leading-relaxed text-faint">
              Downloads all your events as a standard iCalendar file you can import anywhere.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
