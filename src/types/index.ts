/** 通用 ID */
export type ID = string

export type ThemeMode = 'light' | 'dark' | 'system'
export type CurrencyCode = 'CNY' | 'USD' | 'EUR' | 'JPY' | 'HKD'

/** —— 储蓄 —— */
export type TxType = 'income' | 'expense'
export type AccountKind = 'cash' | 'bank' | 'alipay' | 'wechat' | 'other'

/** 目标周期：周 / 月 / 季度 / 半年 / 年 */
export type GoalPeriod = 'week' | 'month' | 'quarter' | 'halfyear' | 'year'

export interface Category {
  id: ID
  name: string
  type: TxType
  icon: string
  color: string
  isDefault: boolean
  createdAt: string
}

export interface Account {
  id: ID
  name: string
  kind: AccountKind
  balance: number
  color: string
  createdAt: string
}

export interface Transaction {
  id: ID
  type: TxType
  amount: number
  categoryId: ID
  accountId: ID
  date: string // YYYY-MM-DD
  note: string
  tags: string[]
  createdAt: string
  updatedAt: string
  /** 由固定项自动生成时写入，用于周期幂等 */
  fixedItemId?: ID
  /** 对应自定义月周期起点 YYYY-MM-DD */
  fixedCycleKey?: string
}

export interface MonthlyBudget {
  id: ID
  yearMonth: string // YYYY-MM
  totalBudget: number
  categoryBudgets: Record<string, number>
}

/**
 * 周期储蓄目标。
 * 进度模型：当前周期内净储蓄（收入 − 支出）/ 目标金额，由流水自动汇总。
 */
export interface SavingsGoal {
  id: ID
  title: string
  targetAmount: number
  period: GoalPeriod
  createdAt: string
}

/**
 * 周期固定收支（房租、通勤、工资等）。
 * dayOfMonth: 1–31 表示在周期内该日入账；null/undefined 表示在周期起始日入账。
 */
export interface FixedItem {
  id: ID
  name: string
  type: TxType
  amount: number
  categoryId?: ID
  accountId?: ID
  /** 1–31；空则按 cycleStartDay 入账 */
  dayOfMonth?: number | null
  enabled: boolean
  createdAt: string
  updatedAt: string
}

/** —— 锻炼 —— */
export type ExerciseType = string

export interface Workout {
  id: ID
  type: ExerciseType
  duration: number // minutes
  distance?: number // km
  sets?: number
  reps?: number
  weight?: number // kg
  intensity: number // 1-5
  feeling: number // 1-5
  note: string
  date: string
  createdAt: string
}

export interface WeeklyPlanItem {
  id: ID
  weekday: number // 0=周日 .. 6=周六
  type: ExerciseType
  plannedDuration: number
  isRest: boolean
}

export interface BodyWeight {
  id: ID
  weight: number
  date: string
  note: string
}

export type ExerciseGoalKind = 'volume' | 'weight'
export type ExerciseVolumeMetric = 'distance' | 'duration' | 'count'

/**
 * 锻炼目标：
 * - volume：按运动类型汇总距离/时长/次数（由训练记录自动推进）
 * - weight：目标体重（由体重日志自动推进）
 * 旧数据可能缺少 kind / workoutType，读取时按 volume 兼容。
 */
export interface ExerciseGoal {
  id: ID
  title: string
  /** 缺省视为 volume（兼容旧数据） */
  kind?: ExerciseGoalKind
  /** volume：关联运动类型（如「跑步」） */
  workoutType?: string
  /** volume: distance|duration|count；weight: weight */
  metric: ExerciseVolumeMetric | 'weight'
  target: number
  period: GoalPeriod
  unit: string
  /** weight：起始体重，用于计算减重/增重进度 */
  startWeight?: number
  createdAt: string
}

/** —— 技能 —— */
export type SkillType = '阅读' | '学习' | '项目' | '习惯' | '自定义'
export type SkillStatus = 'active' | 'paused' | 'archived' | 'completed'

export interface SkillGoal {
  id: ID
  title: string
  type: SkillType
  startDate: string
  endDate?: string
  targetQuantity: number
  unit: string // 页 / 小时 / %
  currentAmount: number
  expectedPace: number // per day
  status: SkillStatus
  notes: string
  /** 来自模板 id，用于复习间隔等 */
  templateId?: string
  /** 最近打卡/笔记日期 YYYY-MM-DD */
  lastCheckIn?: string
  createdAt: string
  updatedAt: string
}

export interface SkillStage {
  id: ID
  skillGoalId: ID
  title: string
  targetAmount?: number
  completed: boolean
  order: number
  note: string
}

export type BookFileType = 'txt' | 'epub'

export interface Book {
  id: ID
  skillGoalId?: ID
  title: string
  fileName: string
  fileType: BookFileType
  /** TXT content or empty for epub (blob stored separately) */
  content: string
  currentPosition: number
  totalLength: number
  percent: number
  updatedAt: string
  createdAt: string
}

/** 技能笔记 / 反思 / 打卡 */
export type SkillNoteKind = 'note' | 'reflection' | 'checkin'

export interface SkillNote {
  id: ID
  skillGoalId: ID
  date: string
  content: string
  kind: SkillNoteKind
  createdAt: string
}

/** —— 设置 / AI —— */
export interface LlmConfig {
  baseUrl: string
  /** 明文仅作兼容旧数据；新写入应清空，改存 apiKeyEnc */
  apiKey: string
  /** AES-GCM 密文（base64），见 utils/cryptoKey */
  apiKeyEnc?: string
  model: string
  /** llmPresets 中的 id */
  providerId?: string
}

export interface AppSettings {
  theme: ThemeMode
  currency: CurrencyCode
  /**
   * 周期起始日（1–28 推荐；允许 1–31，超出当月天数时钳到月末）。
   * 例如 20 → 本周期为当月 20 日 00:00 至下月 19 日结束。
   * 默认 1 = 自然月（向后兼容）。空/无效按 1 处理。
   */
  cycleStartDay: number
  llm: LlmConfig
}

export interface ChatMessage {
  id: ID
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: string
}

/** —— Sync —— */
export interface SyncPayload {
  version: number
  exportedAt: string
  categories: Category[]
  accounts: Account[]
  transactions: Transaction[]
  budgets: MonthlyBudget[]
  savingsGoals?: SavingsGoal[]
  fixedItems?: FixedItem[]
  workouts: Workout[]
  weeklyPlan: WeeklyPlanItem[]
  bodyWeights: BodyWeight[]
  exerciseGoals: ExerciseGoal[]
  skillGoals: SkillGoal[]
  skillStages: SkillStage[]
  skillNotes?: SkillNote[]
  books: Book[]
  settings: AppSettings
  chatMessages: ChatMessage[]
}

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error' | 'ok'
