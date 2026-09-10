import Dexie, { type Table } from 'dexie'
import type {
  Account,
  BodyWeight,
  Book,
  Category,
  ChatMessage,
  DailyEnergy,
  ExerciseGoal,
  FixedItem,
  FoodLog,
  MonthlyBudget,
  SavingsGoal,
  SkillGoal,
  SkillNote,
  SkillStage,
  Transaction,
  WeeklyPlanItem,
  Workout,
} from '../types'

export class PlannerDB extends Dexie {
  categories!: Table<Category, string>
  accounts!: Table<Account, string>
  transactions!: Table<Transaction, string>
  budgets!: Table<MonthlyBudget, string>
  savingsGoals!: Table<SavingsGoal, string>
  fixedItems!: Table<FixedItem, string>
  workouts!: Table<Workout, string>
  weeklyPlan!: Table<WeeklyPlanItem, string>
  bodyWeights!: Table<BodyWeight, string>
  exerciseGoals!: Table<ExerciseGoal, string>
  skillGoals!: Table<SkillGoal, string>
  skillStages!: Table<SkillStage, string>
  skillNotes!: Table<SkillNote, string>
  books!: Table<Book, string>
  chatMessages!: Table<ChatMessage, string>
  /** key-value settings blob */
  kv!: Table<{ key: string; value: unknown }, string>
  /** epub binary blobs */
  blobs!: Table<{ id: string; data: ArrayBuffer; mime: string }, string>
  foodLogs!: Table<FoodLog, string>
  dailyEnergy!: Table<DailyEnergy, string>

  constructor() {
    super('personal-planner')
    this.version(1).stores({
      categories: 'id, type, name',
      accounts: 'id, kind, name',
      transactions: 'id, type, date, categoryId, accountId, amount',
      budgets: 'id, yearMonth',
      workouts: 'id, type, date',
      weeklyPlan: 'id, weekday',
      bodyWeights: 'id, date',
      exerciseGoals: 'id',
      skillGoals: 'id, type, status, startDate',
      skillStages: 'id, skillGoalId, order',
      books: 'id, skillGoalId, fileType',
      chatMessages: 'id, createdAt',
      kv: 'key',
      blobs: 'id',
    })
    // v2: index updatedAt so Skills liveQuery orderBy works
    this.version(2).stores({
      skillGoals: 'id, type, status, startDate, updatedAt',
      books: 'id, skillGoalId, fileType, updatedAt',
    })
    // v3: savings goals; exerciseGoals index by kind
    this.version(3).stores({
      savingsGoals: 'id, period',
      exerciseGoals: 'id, kind, workoutType',
    })
    // v4: fixed recurring income/expense + idempotent markers on transactions
    this.version(4).stores({
      fixedItems: 'id, type, enabled',
      transactions: 'id, type, date, categoryId, accountId, amount, fixedItemId, [fixedItemId+fixedCycleKey]',
    })
    // v5: skill notes / reflections / check-ins
    this.version(5).stores({
      skillNotes: 'id, skillGoalId, date, createdAt',
    })
    // v6: food logs + daily energy (calorie / emotion ball phase 7a)
    this.version(6).stores({
      foodLogs: 'id, date, transactionId, createdAt',
      dailyEnergy: 'id, date',
    })
  }
}

export const db = new PlannerDB()
