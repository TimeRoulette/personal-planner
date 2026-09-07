import { db } from '../db/database'
import type { AppSettings, SyncPayload, SyncStatus } from '../types'
import type { SyncAdapter } from './SyncAdapter'
import { DEFAULT_SETTINGS } from '../utils/defaults'

export class LocalAdapter implements SyncAdapter {
  readonly name = 'local'

  async pull(): Promise<SyncPayload> {
    const settingsRow = await db.kv.get('settings')
    const settings = (settingsRow?.value as AppSettings) ?? DEFAULT_SETTINGS

    const [
      categories,
      accounts,
      transactions,
      budgets,
      savingsGoals,
      workouts,
      weeklyPlan,
      bodyWeights,
      exerciseGoals,
      skillGoals,
      skillStages,
      books,
      chatMessages,
    ] = await Promise.all([
      db.categories.toArray(),
      db.accounts.toArray(),
      db.transactions.toArray(),
      db.budgets.toArray(),
      db.savingsGoals.toArray(),
      db.workouts.toArray(),
      db.weeklyPlan.toArray(),
      db.bodyWeights.toArray(),
      db.exerciseGoals.toArray(),
      db.skillGoals.toArray(),
      db.skillStages.toArray(),
      db.books.toArray(),
      db.chatMessages.toArray(),
    ])

    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      categories,
      accounts,
      transactions,
      budgets,
      savingsGoals,
      workouts,
      weeklyPlan,
      bodyWeights,
      exerciseGoals,
      skillGoals,
      skillStages,
      books,
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
        db.workouts,
        db.weeklyPlan,
        db.bodyWeights,
        db.exerciseGoals,
        db.skillGoals,
        db.skillStages,
        db.books,
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
          db.workouts.clear(),
          db.weeklyPlan.clear(),
          db.bodyWeights.clear(),
          db.exerciseGoals.clear(),
          db.skillGoals.clear(),
          db.skillStages.clear(),
          db.books.clear(),
          db.chatMessages.clear(),
        ])
        await db.categories.bulkAdd(payload.categories)
        await db.accounts.bulkAdd(payload.accounts)
        await db.transactions.bulkAdd(payload.transactions)
        await db.budgets.bulkAdd(payload.budgets)
        await db.savingsGoals.bulkAdd(payload.savingsGoals ?? [])
        await db.workouts.bulkAdd(payload.workouts)
        await db.weeklyPlan.bulkAdd(payload.weeklyPlan)
        await db.bodyWeights.bulkAdd(payload.bodyWeights)
        await db.exerciseGoals.bulkAdd(payload.exerciseGoals)
        await db.skillGoals.bulkAdd(payload.skillGoals)
        await db.skillStages.bulkAdd(payload.skillStages)
        await db.books.bulkAdd(payload.books)
        await db.chatMessages.bulkAdd(payload.chatMessages ?? [])
        await db.kv.put({ key: 'settings', value: payload.settings })
      },
    )
  }

  async getStatus(): Promise<SyncStatus> {
    return 'ok'
  }
}

export const localAdapter = new LocalAdapter()
