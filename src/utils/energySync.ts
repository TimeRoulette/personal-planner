import { db } from '../db/database'
import type { FoodLog, Workout } from '../types'
import { nid, nowISO, todayStr } from './id'
import { estimateWorkoutKcal } from './workoutBurn'
import { DEFAULT_BODY_WEIGHT_KG, DEFAULT_DAILY_KCAL_BUDGET } from './defaults'

/** 写入/更新饮食日志；同一 transactionId 幂等覆盖 */
export async function upsertFoodLogFromTx(opts: {
  transactionId: string
  date: string
  kcal: number
  label: string
  source?: FoodLog['source']
}): Promise<void> {
  const existing = await db.foodLogs.where('transactionId').equals(opts.transactionId).first()
  const row: FoodLog = {
    id: existing?.id ?? nid(),
    date: opts.date,
    kcal: Math.max(0, Math.round(opts.kcal)),
    label: opts.label || '饮食',
    transactionId: opts.transactionId,
    source: opts.source ?? 'transaction',
    createdAt: existing?.createdAt ?? nowISO(),
  }
  await db.foodLogs.put(row)
  await refreshDailyEnergy(opts.date)
}

export async function removeFoodLogsForTx(transactionId: string): Promise<void> {
  const rows = await db.foodLogs.where('transactionId').equals(transactionId).toArray()
  if (!rows.length) return
  const dates = new Set(rows.map((r) => r.date))
  await db.foodLogs.bulkDelete(rows.map((r) => r.id))
  for (const d of dates) await refreshDailyEnergy(d)
}

export async function refreshDailyEnergy(
  date = todayStr(),
  budget = DEFAULT_DAILY_KCAL_BUDGET,
): Promise<void> {
  const [logs, workouts, settingsRow] = await Promise.all([
    db.foodLogs.where('date').equals(date).toArray(),
    db.workouts.where('date').equals(date).toArray(),
    db.kv.get('settings'),
  ])
  const settings = settingsRow?.value as { dailyKcalBudget?: number } | undefined
  const b =
    settings?.dailyKcalBudget && settings.dailyKcalBudget > 0
      ? settings.dailyKcalBudget
      : budget
  const intakeKcal = logs.reduce((s, f) => s + (f.kcal || 0), 0)
  const burnKcal = workouts.reduce((s, w) => s + (w.caloriesBurned || 0), 0)
  await db.dailyEnergy.put({
    id: date,
    date,
    intakeKcal,
    burnKcal,
    budgetKcal: b,
    updatedAt: nowISO(),
  })
}

export function ensureWorkoutCalories(
  data: Omit<Workout, 'id' | 'createdAt'>,
  bodyWeightKg?: number,
): Omit<Workout, 'id' | 'createdAt'> {
  if (data.caloriesBurned != null && data.caloriesBurned > 0) return data
  const kcal = estimateWorkoutKcal({
    type: data.type,
    durationMin: data.duration,
    weightKg: bodyWeightKg && bodyWeightKg > 0 ? bodyWeightKg : DEFAULT_BODY_WEIGHT_KG,
    distanceKm: data.distance,
    intensity: data.intensity,
  })
  return { ...data, caloriesBurned: kcal }
}
