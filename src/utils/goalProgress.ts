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

/** 推荐 1–28；允许 1–31，超出当月天数时钳到月末 */
export function normalizeCycleStartDay(day?: number | null): number {
  const n = typeof day === 'number' && Number.isFinite(day) ? Math.trunc(day) : 1
  return Math.min(31, Math.max(1, n))
}

function fmtDate(dt: Date): string {
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 展示用短日期：M/D */
export function formatShortDate(iso: string): string {
  const [, m, d] = iso.split('-')
  return `${Number(m)}/${Number(d)}`
}

/** 「本周期：9/20 – 10/19」 */
export function formatPeriodRangeLabel(range: { start: string; end: string }): string {
  return `本周期：${formatShortDate(range.start)} – ${formatShortDate(range.end)}`
}

function clampDayInMonth(year: number, monthIndex: number, day: number): number {
  const last = new Date(year, monthIndex + 1, 0).getDate()
  return Math.min(day, last)
}

/** 某公历月上的周期起始日（已钳制） */
function cycleDateInMonth(year: number, monthIndex: number, cycleStartDay: number): Date {
  const day = clampDayInMonth(year, monthIndex, cycleStartDay)
  return new Date(year, monthIndex, day)
}

/**
 * 包含 ref 的「自定义月」起点：该月 cycleStartDay（钳制）00:00。
 * 若 ref 日 < 起始日，则起点为上月。
 */
export function getCustomMonthStart(ref: Date, cycleStartDay: number): Date {
  const day = normalizeCycleStartDay(cycleStartDay)
  const y = ref.getFullYear()
  const m = ref.getMonth()
  const d = ref.getDate()
  const startThis = cycleDateInMonth(y, m, day)
  if (d >= startThis.getDate()) return startThis
  const prev = new Date(y, m - 1, 1)
  return cycleDateInMonth(prev.getFullYear(), prev.getMonth(), day)
}

/** 从自定义月起点起再偏移 n 个自定义月（n 可为负） */
export function addCustomMonths(start: Date, n: number, cycleStartDay: number): Date {
  const day = normalizeCycleStartDay(cycleStartDay)
  const t = new Date(start.getFullYear(), start.getMonth() + n, 1)
  return cycleDateInMonth(t.getFullYear(), t.getMonth(), day)
}

/**
 * 自定义周期对齐：
 * - 月：1 个自定义月
 * - 季度 / 半年 / 年：按「公历年 1 月的 cycleStartDay」为第 0 月，再叠 3/6/12 个月
 *   （cycleStartDay=1 时与自然季/半年/年一致）
 * - 周：仍为周一～周日，不受 cycleStartDay 影响
 */
export function getPeriodRange(
  period: GoalPeriod,
  ref = new Date(),
  cycleStartDay = 1,
): { start: string; end: string } {
  const day = normalizeCycleStartDay(cycleStartDay)

  if (period === 'week') {
    const y = ref.getFullYear()
    const m = ref.getMonth()
    const d = ref.getDate()
    const weekday = ref.getDay()
    const mondayOffset = weekday === 0 ? -6 : 1 - weekday
    const start = new Date(y, m, d + mondayOffset)
    const end = new Date(y, m, d + mondayOffset + 6)
    return { start: fmtDate(start), end: fmtDate(end) }
  }

  const monthStart = getCustomMonthStart(ref, day)
  // 该自定义月归属的「周期年 / 月序号」：起点所在公历月 → 年=该年，序号=该月 0–11
  const anchorYear = monthStart.getFullYear()
  const monthIndex = monthStart.getMonth() // 0–11

  let span = 1
  let alignedIndex = monthIndex

  if (period === 'month') {
    span = 1
    alignedIndex = monthIndex
  } else if (period === 'quarter') {
    span = 3
    alignedIndex = Math.floor(monthIndex / 3) * 3
  } else if (period === 'halfyear') {
    span = 6
    alignedIndex = Math.floor(monthIndex / 6) * 6
  } else {
    // year
    span = 12
    alignedIndex = 0
  }

  const start = cycleDateInMonth(anchorYear, alignedIndex, day)
  // 终点 = 下一周期起点的前一天（含端点）
  const nextStart = addCustomMonths(start, span, day)
  const end = new Date(nextStart.getFullYear(), nextStart.getMonth(), nextStart.getDate() - 1)
  return { start: fmtDate(start), end: fmtDate(end) }
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
  cycleStartDay = 1,
): { current: number; target: number; pct: number; range: { start: string; end: string } } {
  const g = normalizeExerciseGoal(goal)
  const period = g.period || 'month'
  const range = getPeriodRange(period, new Date(), cycleStartDay)
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
  cycleStartDay = 1,
): {
  net: number
  income: number
  expense: number
  target: number
  pct: number
  range: { start: string; end: string }
} {
  const range = getPeriodRange(goal.period, new Date(), cycleStartDay)
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
