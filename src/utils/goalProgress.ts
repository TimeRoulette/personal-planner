import type {
  BodyWeight,
  ExerciseGoal,
  GoalPeriod,
  SavingsGoal,
  Transaction,
  Workout,
} from '../types'

export const PERIOD_LABELS: Record<GoalPeriod, string> = {
  week: '本周',
  month: '本月',
  quarter: '本季度',
  halfyear: '半年',
  year: '本年',
}

export const PERIOD_OPTIONS: { value: GoalPeriod; label: string }[] = [
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
  { value: 'quarter', label: '季度' },
  { value: 'halfyear', label: '半年' },
  { value: 'year', label: '年' },
]

function fmtDate(dt: Date): string {
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 按周期返回当前区间 [start, end]（含端点），周以周一为一周开始 */
export function getPeriodRange(period: GoalPeriod, ref = new Date()): { start: string; end: string } {
  const y = ref.getFullYear()
  const m = ref.getMonth()
  const d = ref.getDate()

  if (period === 'week') {
    const day = ref.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    const start = new Date(y, m, d + mondayOffset)
    const end = new Date(y, m, d + mondayOffset + 6)
    return { start: fmtDate(start), end: fmtDate(end) }
  }
  if (period === 'month') {
    return { start: fmtDate(new Date(y, m, 1)), end: fmtDate(new Date(y, m + 1, 0)) }
  }
  if (period === 'quarter') {
    const q = Math.floor(m / 3) * 3
    return { start: fmtDate(new Date(y, q, 1)), end: fmtDate(new Date(y, q + 3, 0)) }
  }
  if (period === 'halfyear') {
    const h = m < 6 ? 0 : 6
    return { start: fmtDate(new Date(y, h, 1)), end: fmtDate(new Date(y, h + 6, 0)) }
  }
  return { start: fmtDate(new Date(y, 0, 1)), end: fmtDate(new Date(y, 11, 31)) }
}

export function normalizeExerciseGoal(g: ExerciseGoal): ExerciseGoal {
  const kind = g.kind ?? (g.metric === 'weight' ? 'weight' : 'volume')
  return {
    ...g,
    kind,
    period: g.period || 'month',
    unit:
      g.unit ||
      (kind === 'weight'
        ? 'kg'
        : g.metric === 'distance'
          ? 'km'
          : g.metric === 'duration'
            ? '分钟'
            : '次'),
  }
}

/** 运动量目标：从训练记录按类型 + 周期自动汇总 */
export function computeVolumeProgress(
  goal: ExerciseGoal,
  workouts: Workout[],
): { current: number; target: number; pct: number; range: { start: string; end: string } } {
  const g = normalizeExerciseGoal(goal)
  const period = g.period || 'month'
  const range = getPeriodRange(period)
  const inRange = workouts.filter((w) => {
    if (w.date < range.start || w.date > range.end) return false
    if (g.workoutType && w.type !== g.workoutType) return false
    return true
  })

  let current = 0
  if (g.metric === 'distance') {
    current = inRange.reduce((s, w) => s + (w.distance || 0), 0)
  } else if (g.metric === 'duration') {
    current = inRange.reduce((s, w) => s + w.duration, 0)
  } else {
    current = inRange.length
  }

  const target = g.target || 1
  return { current, target, pct: (current / target) * 100, range }
}

/** 体重目标：最新体重 vs 起始/目标，进度由体重日志自动更新 */
export function computeWeightProgress(
  goal: ExerciseGoal,
  bodyWeights: BodyWeight[],
): {
  current: number | null
  start: number
  target: number
  pct: number
  direction: 'lose' | 'gain' | 'maintain'
} {
  const g = normalizeExerciseGoal(goal)
  const target = g.target
  const sorted = [...bodyWeights].sort((a, b) => a.date.localeCompare(b.date))
  const latest = sorted.length ? sorted[sorted.length - 1]!.weight : null
  const start =
    g.startWeight ??
    (sorted.length ? sorted[0]!.weight : latest ?? target)

  if (latest == null) {
    return { current: null, start, target, pct: 0, direction: start > target ? 'lose' : start < target ? 'gain' : 'maintain' }
  }

  const direction: 'lose' | 'gain' | 'maintain' =
    start > target ? 'lose' : start < target ? 'gain' : 'maintain'

  let pct = 0
  if (direction === 'lose') {
    const total = start - target
    pct = total <= 0 ? (latest <= target ? 100 : 0) : ((start - latest) / total) * 100
  } else if (direction === 'gain') {
    const total = target - start
    pct = total <= 0 ? (latest >= target ? 100 : 0) : ((latest - start) / total) * 100
  } else {
    pct = Math.abs(latest - target) < 0.3 ? 100 : 0
  }

  return { current: latest, start, target, pct, direction }
}

/**
 * 储蓄目标进度模型：周期内净储蓄 = 收入 − 支出，进度 = 净储蓄 / 目标金额。
 * （不累计历史结余，只看当前周期流水。）
 */
export function computeSavingsProgress(
  goal: SavingsGoal,
  transactions: Transaction[],
): {
  net: number
  income: number
  expense: number
  target: number
  pct: number
  range: { start: string; end: string }
} {
  const range = getPeriodRange(goal.period)
  let income = 0
  let expense = 0
  for (const t of transactions) {
    if (t.date < range.start || t.date > range.end) continue
    if (t.type === 'income') income += t.amount
    else expense += t.amount
  }
  const net = income - expense
  const target = goal.targetAmount || 1
  return { net, income, expense, target, pct: (net / target) * 100, range }
}
