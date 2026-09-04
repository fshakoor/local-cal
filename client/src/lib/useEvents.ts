import { useCallback, useEffect, useState } from 'react'
import { api, type CalEvent, type EventInput } from './api'

/**
 * A personal calendar is small, so we hold every event in memory and filter by the
 * visible range in the views. Mutations update local state immediately (optimistic),
 * with a reload fallback if the server disagrees.
 */
export function useEvents() {
  const [events, setEvents] = useState<CalEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      setEvents(await api.events())
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(async (input: EventInput) => {
    const ev = await api.create(input)
    setEvents((prev) => [...prev, ev])
    return ev
  }, [])

  const update = useCallback(async (id: number, input: EventInput) => {
    const ev = await api.update(id, input)
    setEvents((prev) => prev.map((e) => (e.id === id ? ev : e)))
    return ev
  }, [])

  const remove = useCallback(
    async (id: number) => {
      setEvents((prev) => prev.filter((e) => e.id !== id))
      try {
        await api.remove(id)
      } catch {
        void reload()
      }
    },
    [reload],
  )

  return { events, loading, error, reload, create, update, remove }
}
