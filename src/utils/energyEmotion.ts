/**
 * 卡路里状态 → Emotion Ball emotionId（可调映射）
 * 02 idle · 10 happy · 19 satisfied · 17 panic · 13 surprise · 21 angry · 15 tired · 12 sad
 */
export type EnergyStatus =
  | 'comfortable'
  | 'happy'
  | 'satisfied'
  | 'approaching'
  | 'over'
  | 'too_low'
  | 'flash_angry'

export const ENERGY_EMOTION_MAP: Record<EnergyStatus, string> = {
  comfortable: '02',
  happy: '10',
  satisfied: '19',
  approaching: '17', // 接近上限：恐慌；也可切 13
  over: '21',
  too_low: '15', // 过低：疲惫；也可切 12
  flash_angry: '21',
}

export const APPROACH_RATIO = 0.9
export const OVER_RATIO = 1.0
export const TOO_LOW_RATIO = 0.6
/** 过低提醒：当天 18:00 之后或结束日判定 */
export const LOW_REMIND_HOUR = 18

export interface DailyEnergySnapshot {
  intake: number
  burn: number
  budget: number
  /** intake - burn */
  net: number
  ratio: number // intake / budget
  status: EnergyStatus
  emotionId: string
  labelZh: string
}

export function resolveEnergyStatus(opts: {
  intake: number
  burn: number
  budget: number
  hour?: number
  hadGoodWorkout?: boolean
}): EnergyStatus {
  const budget = opts.budget > 0 ? opts.budget : 2000
  const ratio = opts.intake / budget
  if (ratio >= OVER_RATIO) return 'over'
  if (ratio >= APPROACH_RATIO) return 'approaching'
  const hour = opts.hour ?? new Date().getHours()
  if (ratio < TOO_LOW_RATIO && hour >= LOW_REMIND_HOUR) return 'too_low'
  if (opts.hadGoodWorkout && opts.burn >= 200) return 'satisfied'
  if (ratio >= 0.55 && ratio <= 0.85 && opts.burn > 0) return 'happy'
  return 'comfortable'
}

export function statusLabelZh(status: EnergyStatus): string {
  switch (status) {
    case 'comfortable':
      return '状态平稳'
    case 'happy':
      return '能量平衡不错'
    case 'satisfied':
      return '运动后满足'
    case 'approaching':
      return '接近热量上限'
    case 'over':
      return '已超预算'
    case 'too_low':
      return '摄入偏低'
    case 'flash_angry':
      return '超预算加餐警告'
    default:
      return '日常'
  }
}

export function buildEnergySnapshot(opts: {
  intake: number
  burn: number
  budget: number
  hour?: number
  hadGoodWorkout?: boolean
}): DailyEnergySnapshot {
  const budget = opts.budget > 0 ? opts.budget : 2000
  const intake = Math.max(0, opts.intake)
  const burn = Math.max(0, opts.burn)
  const status = resolveEnergyStatus({ ...opts, budget, intake, burn })
  return {
    intake,
    burn,
    budget,
    net: intake - burn,
    ratio: budget > 0 ? intake / budget : 0,
    status,
    emotionId: ENERGY_EMOTION_MAP[status],
    labelZh: statusLabelZh(status),
  }
}

export function approachingEmotionId(preferSurprise = false): string {
  return preferSurprise ? '13' : ENERGY_EMOTION_MAP.approaching
}

export function tooLowEmotionId(preferSad = false): string {
  return preferSad ? '12' : ENERGY_EMOTION_MAP.too_low
}
