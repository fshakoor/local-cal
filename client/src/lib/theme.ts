import { useState } from 'react'

// The whole UI is driven by CSS variables, so a theme is just a set of values written onto
// the root element. Choices persist to localStorage and apply instantly.

export type ThemeMode = 'oled' | 'dark' | 'light'
export type AccentKey = 'mono' | 'orange' | 'blue' | 'green' | 'purple' | 'red'
export type EventStyle = 'spine' | 'outline' | 'solid'
export type FontKey = 'editorial' | 'grotesk' | 'mono' | 'system'
export type Theme = { mode: ThemeMode; accent: AccentKey; eventStyle: EventStyle; font: FontKey }

const KEY = 'mycal-theme'
const DEFAULT: Theme = { mode: 'oled', accent: 'mono', eventStyle: 'spine', font: 'editorial' }

const PRESETS: Record<ThemeMode, Record<string, string>> = {
  oled: {
    '--color-bg': '#000000',
    '--color-surface': '#0c0c0c',
    '--color-surface2': '#161616',
    '--color-surface3': '#202020',
    '--color-line': 'rgba(255,255,255,0.10)',
    '--color-line-strong': 'rgba(255,255,255,0.20)',
    '--color-ink': '#f5f5f5',
    '--color-dim': '#a1a1a1',
    '--color-faint': '#6b6b6b',
  },
  dark: {
    '--color-bg': '#17171a',
    '--color-surface': '#1f1f23',
    '--color-surface2': '#27272c',
    '--color-surface3': '#323238',
    '--color-line': 'rgba(255,255,255,0.09)',
    '--color-line-strong': 'rgba(255,255,255,0.18)',
    '--color-ink': '#ededed',
    '--color-dim': '#9a9aa2',
    '--color-faint': '#66666e',
  },
  light: {
    '--color-bg': '#ffffff',
    '--color-surface': '#f6f6f7',
    '--color-surface2': '#eeeeef',
    '--color-surface3': '#e3e3e5',
    '--color-line': 'rgba(0,0,0,0.10)',
    '--color-line-strong': 'rgba(0,0,0,0.18)',
    '--color-ink': '#1a1a1c',
    '--color-dim': '#5c5c63',
    '--color-faint': '#8a8a92',
  },
}

type AccentVars = { accent: string; bright: string; soft: string }
const ACCENTS: Record<Exclude<AccentKey, 'mono'>, AccentVars> = {
  orange: { accent: '#f97316', bright: '#fb8b3c', soft: 'rgba(249,115,22,0.16)' },
  blue: { accent: '#3b82f6', bright: '#5b97f8', soft: 'rgba(59,130,246,0.16)' },
  green: { accent: '#22c55e', bright: '#41d277', soft: 'rgba(34,197,94,0.16)' },
  purple: { accent: '#a855f7', bright: '#b877f8', soft: 'rgba(168,85,247,0.16)' },
  red: { accent: '#ef4444', bright: '#f26565', soft: 'rgba(239,68,68,0.16)' },
}

// Each font choice is a (display, body) pair. Editorial and Grotesk reuse the two bundled
// faces; Mono and System use the platform stacks, so nothing extra is downloaded.
const FONTS: Record<FontKey, { serif: string; sans: string }> = {
  editorial: {
    serif: "'Fraunces Variable', 'Iowan Old Style', Georgia, serif",
    sans: "'Hanken Grotesk Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  grotesk: {
    serif: "'Hanken Grotesk Variable', ui-sans-serif, system-ui, sans-serif",
    sans: "'Hanken Grotesk Variable', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  mono: {
    serif: "ui-monospace, 'JetBrains Mono', 'Cascadia Code', Menlo, Consolas, monospace",
    sans: "ui-monospace, 'JetBrains Mono', 'Cascadia Code', Menlo, Consolas, monospace",
  },
  system: {
    serif: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    sans: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  },
}

export function applyTheme(t: Theme) {
  const root = document.documentElement.style
  const preset = PRESETS[t.mode]
  for (const k in preset) root.setProperty(k, preset[k])

  if (t.accent === 'mono') {
    // monochrome accent tracks the text color, so it reads on any background
    root.setProperty('--color-accent', preset['--color-ink'])
    root.setProperty('--color-accent-bright', t.mode === 'light' ? '#2a2a30' : '#d4d4d4')
    root.setProperty('--color-accent-soft', t.mode === 'light' ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.12)')
  } else {
    const a = ACCENTS[t.accent]
    root.setProperty('--color-accent', a.accent)
    root.setProperty('--color-accent-bright', a.bright)
    root.setProperty('--color-accent-soft', a.soft)
  }
  // keep native controls (date/time pickers, scrollbars) in step with the theme
  document.documentElement.style.setProperty('color-scheme', t.mode === 'light' ? 'light' : 'dark')
  // event-block look is driven by a data attribute the CSS reads
  document.documentElement.setAttribute('data-event-style', t.eventStyle || 'spine')

  const font = FONTS[t.font] || FONTS.editorial
  root.setProperty('--font-serif', font.serif)
  root.setProperty('--font-sans', font.sans)
}

export function loadTheme(): Theme {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULT, ...JSON.parse(raw) }
  } catch {
    // ignore unreadable storage
  }
  return DEFAULT
}

function saveTheme(t: Theme) {
  try {
    localStorage.setItem(KEY, JSON.stringify(t))
  } catch {
    // ignore unwritable storage
  }
  applyTheme(t)
}

/** Theme state for the settings UI. Writing applies and persists immediately. */
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(loadTheme)
  const update = (patch: Partial<Theme>) =>
    setTheme((t) => {
      const next = { ...t, ...patch }
      saveTheme(next)
      return next
    })
  return { theme, update }
}
