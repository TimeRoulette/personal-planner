/** 根据运动类型决定记录表单显示哪些字段 */

export type WorkoutFieldProfile = 'cardio' | 'strength' | 'duration' | 'swim' | 'generic'

const STRENGTH = /力量|器械|卧推|深蹲|硬拉|推举|哑铃|杠铃/
const CARDIO = /跑|走|步行|骑|单车|椭圆|划船|有氧|HIIT|跳绳|爬山|滑雪|舞蹈/
const SWIM = /游泳/
const DURATION_ONLY = /瑜伽|拉伸|普拉提|冥想|太极/

export function workoutFieldProfile(type: string): WorkoutFieldProfile {
  const t = type.trim()
  if (!t) return 'generic'
  if (STRENGTH.test(t)) return 'strength'
  if (SWIM.test(t)) return 'swim'
  if (DURATION_ONLY.test(t)) return 'duration'
  if (CARDIO.test(t)) return 'cardio'
  // 球类等：时长为主，可选距离
  if (/篮球|足球|羽毛|网球|乒乓|武术|搏击|攀岩/.test(t)) return 'duration'
  return 'generic'
}

export const INTENSITY_CHIPS: { value: number; label: string }[] = [
  { value: 2, label: '轻松' },
  { value: 3, label: '适中' },
  { value: 4, label: '吃力' },
  { value: 5, label: '极限' },
]

export const FEELING_CHIPS: { value: number; label: string }[] = [
  { value: 1, label: '很差' },
  { value: 2, label: '一般' },
  { value: 4, label: '不错' },
  { value: 5, label: '超棒' },
]

export function intensityLabel(n: number): string {
  return INTENSITY_CHIPS.find((c) => c.value === n)?.label || `${n}/5`
}

export function feelingLabel(n: number): string {
  return FEELING_CHIPS.find((c) => c.value === n)?.label || `${n}/5`
}
