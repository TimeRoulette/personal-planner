import { useCallback } from 'react'
import { db } from '../db/database'
import type { AppSettings, LlmConfig } from '../types'
import { DEFAULT_SETTINGS, DEFAULT_DAILY_WATER_ML, DEFAULT_READER_SETTINGS } from '../utils/defaults'
import { normalizeCycleStartDay } from '../utils/goalProgress'
import { decryptSecret, encryptSecret } from '../utils/cryptoKey'
import { useLiveQuery } from './useLiveQuery'

async function resolveLlm(raw: LlmConfig | undefined): Promise<{ display: LlmConfig; store: LlmConfig }> {
  const base = { ...DEFAULT_SETTINGS.llm, ...(raw ?? {}) }
  let plain = ''
  let enc = base.apiKeyEnc || ''

  if (enc) {
    plain = (await decryptSecret(enc)) || ''
  } else if (base.apiKey) {
    plain = base.apiKey
    enc = await encryptSecret(plain)
  }

  const display: LlmConfig = { ...base, apiKey: plain, apiKeyEnc: enc }
  const store: LlmConfig = { ...base, apiKey: '', apiKeyEnc: enc }
  return { display, store }
}

function normalizeSettings(raw: AppSettings | undefined | null, llm?: LlmConfig): AppSettings {
  const base = { ...DEFAULT_SETTINGS, ...(raw ?? {}) }
  return {
    ...base,
    cycleStartDay: normalizeCycleStartDay(base.cycleStartDay),
    dailyKcalBudget:
      typeof base.dailyKcalBudget === 'number' && base.dailyKcalBudget > 0
        ? base.dailyKcalBudget
        : DEFAULT_SETTINGS.dailyKcalBudget,
    bodyWeightKg:
      typeof base.bodyWeightKg === 'number' && base.bodyWeightKg > 0
        ? base.bodyWeightKg
        : DEFAULT_SETTINGS.bodyWeightKg,
    dailyWaterGoalMl:
      typeof base.dailyWaterGoalMl === 'number' && base.dailyWaterGoalMl > 0
        ? base.dailyWaterGoalMl
        : DEFAULT_DAILY_WATER_ML,
    reader: {
      ...DEFAULT_READER_SETTINGS,
      ...(base.reader ?? {}),
      fontSize:
        typeof base.reader?.fontSize === 'number' && base.reader.fontSize >= 12 && base.reader.fontSize <= 36
          ? base.reader.fontSize
          : DEFAULT_READER_SETTINGS.fontSize,
      lineHeight:
        typeof base.reader?.lineHeight === 'number' && base.reader.lineHeight >= 1.2 && base.reader.lineHeight <= 2.6
          ? base.reader.lineHeight
          : DEFAULT_READER_SETTINGS.lineHeight,
      margin:
        typeof base.reader?.margin === 'number' && base.reader.margin >= 8 && base.reader.margin <= 48
          ? base.reader.margin
          : DEFAULT_READER_SETTINGS.margin,
    },
    llm: llm ?? { ...DEFAULT_SETTINGS.llm, ...(raw?.llm ?? {}) },
  }
}

export function useSettings() {
  const settings = useLiveQuery(
    async () => {
      const row = await db.kv.get('settings')
      const raw = row?.value as AppSettings | undefined
      const { display, store } = await resolveLlm(raw?.llm)
      // 惰性迁移明文 Key
      if (raw?.llm?.apiKey && !raw.llm.apiKeyEnc) {
        await db.kv.put({
          key: 'settings',
          value: normalizeSettings(raw, store),
        })
      }
      return normalizeSettings(raw, display)
    },
    [],
    DEFAULT_SETTINGS,
  )

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    const row = await db.kv.get('settings')
    const raw = row?.value as AppSettings | undefined
    const { display, store } = await resolveLlm(raw?.llm)
    const current = normalizeSettings(raw, display)

    let nextStoreLlm = { ...store, ...(partial.llm ?? {}) }
    if (partial.llm && 'apiKey' in partial.llm) {
      const plain = partial.llm.apiKey ?? ''
      nextStoreLlm = {
        ...nextStoreLlm,
        apiKey: '',
        apiKeyEnc: plain ? await encryptSecret(plain) : '',
      }
    } else {
      nextStoreLlm = {
        ...nextStoreLlm,
        apiKey: '',
        apiKeyEnc: store.apiKeyEnc || '',
      }
    }

    const toStore: AppSettings = {
      ...current,
      ...partial,
      llm: nextStoreLlm,
      cycleStartDay:
        partial.cycleStartDay !== undefined
          ? normalizeCycleStartDay(partial.cycleStartDay)
          : current.cycleStartDay,
    }
    await db.kv.put({ key: 'settings', value: toStore })
  }, [])

  return { settings: settings ?? DEFAULT_SETTINGS, updateSettings }
}
