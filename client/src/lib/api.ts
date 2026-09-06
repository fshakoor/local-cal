export type EventColor = 'coral' | 'sage' | 'gold' | 'lilac' | 'sky'
export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly'

export type CalEvent = {
  id: number
  title: string
  date: string // YYYY-MM-DD
  all_day: boolean
  start_min: number | null
  end_min: number | null
  note: string | null
  color: EventColor | null
  repeat: Repeat
  repeat_until: string | null
  remind_min: number | null
  created: number
}

export type EventInput = {
  title: string
  date: string
  all_day: boolean
  start_min: number | null
  end_min: number | null
  note: string | null
  color: EventColor | null
  repeat: Repeat
  repeat_until: string | null
  remind_min: number | null
}

export type Settings = { digest_enabled: string; digest_time: string; [k: string]: string }

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  events: (from?: string, to?: string) => {
    const qs = from && to ? `?from=${from}&to=${to}` : ''
    return fetch(`/api/events${qs}`).then((r) => j<CalEvent[]>(r))
  },
  create: (e: EventInput) =>
    fetch('/api/events', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(e) }).then(
      (r) => j<CalEvent>(r),
    ),
  update: (id: number, e: EventInput) =>
    fetch(`/api/events/${id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(e) }).then(
      (r) => j<CalEvent>(r),
    ),
  remove: (id: number) => fetch(`/api/events/${id}`, { method: 'DELETE' }).then((r) => j<{ ok: true }>(r)),
  settings: () => fetch('/api/settings').then((r) => j<Settings>(r)),
  patchSettings: (patch: Partial<Pick<Settings, 'digest_time' | 'digest_enabled'>>) =>
    fetch('/api/settings', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) }).then(
      (r) => j<Settings>(r),
    ),
  digestPreview: () => fetch('/api/digest/preview').then((r) => j<{ subject: string; body: string; count: number }>(r)),
  digestTest: () => fetch('/api/digest/test', { method: 'POST' }).then((r) => j<{ ok: boolean; status?: string; error?: string }>(r)),
}
