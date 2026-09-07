import { daysBetween, todayStr } from './id'
import type { SkillGoal } from '../types'

export function skillProgress(goal: SkillGoal) {
  const pct = goal.targetQuantity > 0 ? (goal.currentAmount / goal.targetQuantity) * 100 : 0
  const today = todayStr()
  const elapsed = Math.max(0, daysBetween(goal.startDate, today))
  const expected = goal.expectedPace * elapsed
  const delta = goal.currentAmount - expected
  let paceStatus: 'ahead' | 'ontrack' | 'behind' = 'ontrack'
  if (delta > goal.expectedPace) paceStatus = 'ahead'
  else if (delta < -goal.expectedPace) paceStatus = 'behind'

  let eta: string | null = null
  if (goal.expectedPace > 0 && goal.currentAmount < goal.targetQuantity) {
    const remain = goal.targetQuantity - goal.currentAmount
    const daysNeeded = Math.ceil(remain / goal.expectedPace)
    const d = new Date()
    d.setDate(d.getDate() + daysNeeded)
    eta = d.toISOString().slice(0, 10)
  } else if (goal.currentAmount >= goal.targetQuantity) {
    eta = today
  }

  let calendarPct = 0
  if (goal.endDate) {
    const total = Math.max(1, daysBetween(goal.startDate, goal.endDate))
    calendarPct = Math.min(100, (elapsed / total) * 100)
  }

  return {
    pct: Math.min(100, Math.max(0, pct)),
    expected,
    delta,
    paceStatus,
    eta,
    calendarPct,
    elapsed,
  }
}

export const PACE_LABEL = {
  ahead: '超前',
  ontrack: '正常',
  behind: '落后',
} as const
