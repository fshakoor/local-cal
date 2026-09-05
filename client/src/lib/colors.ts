import type { CSSProperties } from 'react'

// Month-grid event chips render monochrome. Day/week block styles live in index.css,
// switched by the data-event-style attribute the settings panel sets.

/** Compact chip in the month grid. */
export function chipStyle(): CSSProperties {
  return {
    background: 'var(--color-surface2)',
    color: 'var(--color-ink)',
  }
}
