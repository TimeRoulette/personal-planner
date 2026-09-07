import { useCallback } from 'react'
import { db } from '../db/database'
import type { AppSettings } from '../types'
import { DEFAULT_SETTINGS } from '../utils/defaults'
import { useLiveQuery } from './useLiveQuery'

export function useSettings() {
  const settings = useLiveQuery(
    async () => {
      const row = await db.kv.get('settings')
      return (row?.value as AppSettings) ?? DEFAULT_SETTINGS
    },
    [],
    DEFAULT_SETTINGS,
  )

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    const row = await db.kv.get('settings')
    const current = (row?.value as AppSettings) ?? DEFAULT_SETTINGS
    const next = { ...current, ...partial, llm: { ...current.llm, ...(partial.llm ?? {}) } }
    await db.kv.put({ key: 'settings', value: next })
  }, [])

  return { settings: settings ?? DEFAULT_SETTINGS, updateSettings }
}
