import { useEffect, useState } from 'react'

/** Current time, refreshed on an interval so "today" and the now-line stay honest. */
export function useNow(everyMs = 20_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), everyMs)
    const onVis = () => document.visibilityState === 'visible' && setNow(new Date())
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [everyMs])
  return now
}
