import { db } from '../db/database'
import type { AppSettings, SyncPayload, SyncStatus } from '../types'
import type { SyncAdapter } from './SyncAdapter'
import { DEFAULT_SETTINGS } from '../utils/defaults'
import { normalizeCycleStartDay } from '../utils/goalProgress'

export class LocalAdapter implements SyncAdapter {
  readonly name = 'local'

  async pull(): Promise<SyncPayload> {
    const settingsRow = await db.kv.get('settings')
    const raw = (settingsRow?.value as AppSettings) ?? DEFAULT_SETTINGS
    const settings: AppSettings = {
      ...DEFAULT_SETTINGS,
      ...raw,
      cycleStartDay: normalizeCycleStartDay(raw.cycleStartDay ?? DEFAULT_SETTINGS.cycleStartDay),
      dailyKcalBudget:
        typeof raw.dailyKcalBudget === 'number' && raw.dailyKcalBudget > 0
          ? raw.dailyKcalBudget
          : DEFAULT_SETTINGS.dailyKcalBudget,
      bodyWeightKg:
        typeof raw.bodyWeightKg === 'number' && raw.bodyWeightKg > 0
          ? raw.bodyWeightKg
          : DEFAULT_SETTINGS.bodyWeightKg,
      llm: { ...DEFAULT_SETTINGS.llm, ...(raw.llm ?? {}) },
    }

    const [
      categories,
      accounts,
      transactions,
      budgets,
      savingsGoals,
      fixedItems,
      workouts,
      weeklyPlan,
      bodyWeights,
      exerciseGoals,
      skillGoals,
      skillStages,
      skillNotes,
      books,
      foodLogs,
      dailyEnergy,
      chatMessages,
    ] = await Promise.all([
      db.categories.toArray(),
      db.accounts.toArray(),
      db.transactions.toArray(),
      db.budgets.toArray(),
      db.savingsGoals.toArray(),
      db.fixedItems.toArray(),
      db.workouts.toArray(),
      db.weeklyPlan.toArray(),
      db.bodyWeights.toArray(),
      db.exerciseGoals.toArray(),
      db.skillGoals.toArray(),
      db.skillStages.toArray(),
      db.skillNotes.toArray(),
      db.books.toArray(),
      db.foodLogs.toArray(),
      db.dailyEnergy.toArray(),
      db.chatMessages.toArray(),
    ])

    return {
      version: 5,
      exportedAt: new Date().toISOString(),
      categories,
      accounts,
      transactions,
      budgets,
      savingsGoals,
      fixedItems,
      workouts,
      weeklyPlan,
      bodyWeights,
      exerciseGoals,
      skillGoals,
      skillStages,
      skillNotes,
      books,
      foodLogs,
      dailyEnergy,
      settings,
      chatMessages,
    }
  }

  async push(payload: SyncPayload): Promise<void> {
    await db.transaction(
      'rw',
      [
        db.categories,
        db.accounts,
        db.transactions,
        db.budgets,
        db.savingsGoals,
        db.fixedItems,
        db.workouts,
        db.weeklyPlan,
        db.bodyWeights,
        db.exerciseGoals,
        db.skillGoals,
        db.skillStages,
        db.skillNotes,
        db.books,
        db.foodLogs,
        db.dailyEnergy,
        db.chatMessages,
        db.kv,
      ],
      async () => {
        await Promise.all([
          db.categories.clear(),
          db.accounts.clear(),
          db.transactions.clear(),
          db.budgets.clear(),
          db.savingsGoals.clear(),
          db.fixedItems.clear(),
          db.workouts.clear(),
          db.weeklyPlan.clear(),
          db.bodyWeights.clear(),
          db.exerciseGoals.clear(),
          db.skillGoals.clear(),
          db.skillStages.clear(),
          db.skillNotes.clear(),
          db.books.clear(),
          db.foodLogs.clear(),
          db.dailyEnergy.clear(),
          db.chatMessages.clear(),
        ])
        await db.categories.bulkAdd(payload.categories)
        await db.accounts.bulkAdd(payload.accounts)
        await db.transactions.bulkAdd(payload.transactions)
        await db.budgets.bulkAdd(payload.budgets)
        await db.savingsGoals.bulkAdd(payload.savingsGoals ?? [])
        await db.fixedItems.bulkAdd(payload.fixedItems ?? [])
        await db.workouts.bulkAdd(payload.workouts)
        await db.weeklyPlan.bulkAdd(payload.weeklyPlan)
        await db.bodyWeights.bulkAdd(payload.bodyWeights)
        await db.exerciseGoals.bulkAdd(payload.exerciseGoals)
        await db.skillGoals.bulkAdd(payload.skillGoals)
        await db.skillStages.bulkAdd(payload.skillStages)
        await db.skillNotes.bulkAdd(payload.skillNotes ?? [])
        await db.books.bulkAdd(payload.books)
        await db.foodLogs.bulkAdd(payload.foodLogs ?? [])
        await db.dailyEnergy.bulkAdd(payload.dailyEnergy ?? [])
        await db.chatMessages.bulkAdd(payload.chatMessages ?? [])
        const settings: AppSettings = {
          ...DEFAULT_SETTINGS,
          ...payload.settings,
          cycleStartDay: normalizeCycleStartDay(
            payload.settings?.cycleStartDay ?? DEFAULT_SETTINGS.cycleStartDay,
          ),
          dailyKcalBudget:
            typeof payload.settings?.dailyKcalBudget === 'number' &&
            payload.settings.dailyKcalBudget > 0
              ? payload.settings.dailyKcalBudget
              : DEFAULT_SETTINGS.dailyKcalBudget,
          bodyWeightKg:
            typeof payload.settings?.bodyWeightKg === 'number' &&
            payload.settings.bodyWeightKg > 0
              ? payload.settings.bodyWeightKg
              : DEFAULT_SETTINGS.bodyWeightKg,
          llm: { ...DEFAULT_SETTINGS.llm, ...(payload.settings?.llm ?? {}) },
        }
        await db.kv.put({ key: 'settings', value: settings })
      },
    )
  }

  async getStatus(): Promise<SyncStatus> {
    return 'ok'
  }
}

export const localAdapter = new LocalAdapter()
