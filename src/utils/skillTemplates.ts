import type { SkillType } from '../types'

export interface SkillTemplate {
  id: string
  name: string
  type: SkillType
  title: string
  unit: string
  targetQuantity: number
  expectedPace: number
  stages: string[]
  notes: string
  /** 建议复习间隔（天），用于打卡提醒 */
  reviewIntervals: number[]
}

export const SKILL_TEMPLATES: SkillTemplate[] = [
  {
    id: 'reading',
    name: '阅读计划',
    type: '阅读',
    title: '读完一本书',
    unit: '页',
    targetQuantity: 300,
    expectedPace: 10,
    stages: ['浏览目录与前言', '读完前 1/3', '读完 2/3', '读完并写短评'],
    notes: '每天固定时段阅读；读完一章可写一句感想。',
    reviewIntervals: [1, 3, 7],
  },
  {
    id: 'language',
    name: '语言学习',
    type: '学习',
    title: '外语打卡',
    unit: '小时',
    targetQuantity: 40,
    expectedPace: 0.5,
    stages: ['发音与基础词汇', '听力精听 20 篇', '口语跟读', '模拟对话 / 作文'],
    notes: '结合间隔复习：生词当天、第 3 天、第 7 天再看。',
    reviewIntervals: [1, 3, 7, 14],
  },
  {
    id: 'coding',
    name: '编程项目',
    type: '项目',
    title: '完成一个小项目',
    unit: '%',
    targetQuantity: 100,
    expectedPace: 5,
    stages: ['需求与技术选型', '搭好骨架可运行', '核心功能完成', '测试与文档', '发布 / 复盘'],
    notes: '每天至少提交一次；卡住超过 1 天就写反思笔记。',
    reviewIntervals: [2, 5, 10],
  },
  {
    id: 'exam',
    name: '考试备考',
    type: '学习',
    title: '考试冲刺',
    unit: '小时',
    targetQuantity: 60,
    expectedPace: 2,
    stages: ['梳理考点大纲', '第一轮刷题', '错题本巩固', '模拟卷限时', '考前回顾'],
    notes: '错题按间隔复习；每周至少一套模拟。',
    reviewIntervals: [1, 2, 4, 7],
  },
]

export function nextReviewDate(lastCheckIn: string | undefined, intervals: number[]): string | null {
  if (!intervals.length) return null
  const base = lastCheckIn ? new Date(lastCheckIn + 'T00:00:00') : new Date()
  // 根据距开始已过天数选下一个间隔
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const elapsed = Math.max(0, Math.round((today.getTime() - base.getTime()) / 86400000))
  const nextInterval = intervals.find((d) => d > elapsed) ?? intervals[intervals.length - 1]
  const d = new Date(base)
  d.setDate(d.getDate() + nextInterval)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
