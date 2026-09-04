import type { CalEvent } from './api'

export type Placed = { ev: CalEvent; col: number; cols: number; start: number; end: number }

const DEFAULT_DUR = 45 // minutes given to a timed event with no explicit end
const DAY = 24 * 60

/** Pack overlapping timed events into side-by-side columns for a single day. */
export function layoutTimed(events: CalEvent[]): Placed[] {
  const items = events
    .filter((e) => !e.all_day && e.start_min != null)
    .map((e) => ({ e, start: e.start_min!, end: Math.min(DAY, e.end_min ?? e.start_min! + DEFAULT_DUR) }))
    .sort((a, b) => a.start - b.start || a.end - b.end)

  const placed: Placed[] = []
  let cluster: typeof items = []
  let clusterEnd = -1

  const flush = () => {
    const colEnds: number[] = [] // running end time occupying each column
    const assign = cluster.map((it) => {
      let c = colEnds.findIndex((end) => end <= it.start)
      if (c === -1) {
        c = colEnds.length
        colEnds.push(it.end)
      } else colEnds[c] = it.end
      return c
    })
    const cols = colEnds.length
    cluster.forEach((it, i) => placed.push({ ev: it.e, col: assign[i], cols, start: it.start, end: it.end }))
    cluster = []
  }

  for (const it of items) {
    if (cluster.length && it.start >= clusterEnd) {
      flush()
      clusterEnd = -1
    }
    cluster.push(it)
    clusterEnd = Math.max(clusterEnd, it.end)
  }
  if (cluster.length) flush()
  return placed
}
