import { useEffect, useState } from 'react'
import { liveQuery, type Observable } from 'dexie'

/** 简易 liveQuery hook */
export function useLiveQuery<T>(
  querier: () => Promise<T> | T,
  deps: unknown[] = [],
  initial?: T,
): T | undefined {
  const [data, setData] = useState<T | undefined>(initial)

  useEffect(() => {
    let cancelled = false
    const observable: Observable<T> = liveQuery(querier)
    const sub = observable.subscribe({
      next: (value) => {
        if (!cancelled) setData(value)
      },
      error: (err) => console.error('liveQuery error', err),
    })
    return () => {
      cancelled = true
      sub.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return data
}
