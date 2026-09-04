import type { CSSProperties } from 'react'

// Events render monochrome for now. Per-event colors come back with the theme picker.

/** Filled event block in the day/week time grid. */
export function blockStyle(): CSSProperties {
  return {
    background: 'var(--color-surface2)',
    borderLeft: '2px solid var(--color-ink)',
  }
}

/** Compact chip in the month grid. */
export function chipStyle(): CSSProperties {
  return {
    background: 'var(--color-surface2)',
    color: 'var(--color-ink)',
  }
}
