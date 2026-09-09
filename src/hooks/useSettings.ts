import { useCallback } from 'react'
import { db } from '../db/database'
import type { AppSettings } from '../types'
import { DEFAULT_SETTINGS } from '../utils/defaults'
import { normalizeCycleStartDay } from '../utils/goalProgress'
import { useLiveQuery } from './useLiveQuery'

function normalizeSettings(raw: AppSettings | undefined | null): AppSettings {
  const base = { ...DEFAULT_SETTINGS, ...(raw ?? {}) }
  return {
    ...base,
    cycleStartDay: normalizeCycleStartDay(base.cycleStartDay),
    llm: { ...DEFAULT_SETTINGS.llm, ...(raw?.llm ?? {}) },
  }
}

export function useSettings() {
  const settings = useLiveQuery(
    async () => {
      const row = await db.kv.get('settings')
      return normalizeSettings(row?.value as AppSettings | undefined)
    },
    [],
    DEFAULT_SETTINGS,
  )

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    const row = await db.kv.get('settings')
    const current = normalizeSettings(row?.value as AppSettings | undefined)
    const next = normalizeSettings({
      ...current,
      ...partial,
      llm: { ...current.llm, ...(partial.llm ?? {}) },
      cycleStartDay:
        partial.cycleStartDay !== undefined
          ? normalizeCycleStartDay(partial.cycleStartDay)
          : current.cycleStartDay,
    })
    await db.kv.put({ key: 'settings', value: next })
  }, [])

  return { settings: settings ?? DEFAULT_SETTINGS, updateSettings }
}
