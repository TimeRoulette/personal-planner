import { daysBetween, todayStr } from './id'
import { skillProgress } from './skillMath'
import type { SkillGoal, SkillNote, SkillStage } from '../types'
import { nextReviewDate } from './skillTemplates'

export function skillCheckinStreak(notes: SkillNote[]): number {
  const days = new Set(notes.map((n) => n.date))
  let s = 0
  const d = new Date()
  for (;;) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const key = `${y}-${m}-${day}`
    if (days.has(key)) {
      s++
      d.setDate(d.getDate() - 1)
    } else {
      if (s === 0 && key === todayStr()) {
        d.setDate(d.getDate() - 1)
        continue
      }
      break
    }
  }
  return s
}

export function suggestNextStep(
  goal: SkillGoal,
  stages: SkillStage[],
  notes: SkillNote[],
  reviewIntervals: number[] = [1, 3, 7],
): string {
  const prog = skillProgress(goal)
  const nextStage = stages.find((s) => !s.completed)
  const last = notes.slice().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0]
  const review = nextReviewDate(last?.date, reviewIntervals)
  const today = todayStr()

  if (goal.status === 'paused') return '目标已暂停，恢复后继续当前阶段。'
  if (goal.currentAmount >= goal.targetQuantity) return '已达目标量，写一段复盘笔记并考虑归档或设下一目标。'
  if (nextStage) {
    if (review && review <= today) return `建议复习/打卡：完成「${nextStage.title}」并写一句反思。`
    return `下一步：推进里程碑「${nextStage.title}」（当前 ${prog.pct.toFixed(0)}%，节奏${prog.paceStatus === 'behind' ? '偏慢' : prog.paceStatus === 'ahead' ? '超前' : '正常'}）。`
  }
  if (prog.paceStatus === 'behind') {
    return `节奏落后约 ${Math.abs(prog.delta).toFixed(1)} ${goal.unit}，今天至少完成 ${Math.max(goal.expectedPace, 1)} ${goal.unit}。`
  }
  if (review && review <= today) return '到复习日了：打开笔记回顾上次内容，再推进一点进度。'
  return `保持日均 ${goal.expectedPace} ${goal.unit}；预计完成日 ${prog.eta ?? '—'}。`
}

export function daysSinceLastNote(notes: SkillNote[]): number | null {
  if (!notes.length) return null
  const last = notes.slice().sort((a, b) => b.date.localeCompare(a.date))[0]
  return daysBetween(last.date, todayStr())
}
