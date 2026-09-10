import {
  APPROACH_RATIO,
  ENERGY_EMOTION_MAP,
  buildEnergySnapshot,
  type DailyEnergySnapshot,
} from './energyEmotion'

export type StatusDomain = 'composite' | 'diet' | 'exercise' | 'savings' | 'water' | 'goals'

export interface DomainBar {
  id: StatusDomain
  title: string
  /** 0–100+ */
  pct: number
  detail: string
  emotionId: string
  tone: 'good' | 'ok' | 'warn' | 'danger' | 'muted'
}

export function toneFromPct(pct: number, invertGood = false): DomainBar['tone'] {
  // invertGood: 越高越差（如饮食超预算）
  if (invertGood) {
    if (pct >= 100) return 'danger'
    if (pct >= APPROACH_RATIO * 100) return 'warn'
    if (pct < 40) return 'warn'
    if (pct >= 55 && pct <= 85) return 'good'
    return 'ok'
  }
  if (pct <= 0) return 'muted'
  if (pct < 40) return 'warn'
  if (pct < 70) return 'ok'
  if (pct <= 110) return 'good'
  return 'warn'
}

export function dietDomain(snap: DailyEnergySnapshot): DomainBar {
  const pct = snap.budget > 0 ? (snap.intake / snap.budget) * 100 : 0
  return {
    id: 'diet',
    title: '饮食',
    pct,
    detail: `摄入 ${Math.round(snap.intake)} / 预算 ${Math.round(snap.budget)} kcal · 净 ${Math.round(snap.net)}`,
    emotionId: snap.emotionId,
    tone: toneFromPct(pct, true),
  }
}

export function exerciseDomain(opts: {
  todayBurn: number
  weekCheckins: number
  weekTargetDays?: number
  hadGoodWorkout: boolean
}): DomainBar {
  const target = opts.weekTargetDays && opts.weekTargetDays > 0 ? opts.weekTargetDays : 4
  const weekPct = (opts.weekCheckins / target) * 100
  const emotionId = opts.hadGoodWorkout
    ? ENERGY_EMOTION_MAP.satisfied
    : opts.todayBurn >= 150
      ? ENERGY_EMOTION_MAP.happy
      : opts.weekCheckins === 0
        ? ENERGY_EMOTION_MAP.too_low
        : ENERGY_EMOTION_MAP.comfortable
  return {
    id: 'exercise',
    title: '锻炼',
    pct: weekPct,
    detail: `今日消耗 ${Math.round(opts.todayBurn)} kcal · 本周打卡 ${opts.weekCheckins}/${target} 天`,
    emotionId,
    tone: toneFromPct(weekPct),
  }
}

export function savingsDomain(opts: {
  net: number
  target: number
  expense: number
  budget: number
}): DomainBar {
  let pct = 0
  let detail = ''
  let emotionId = ENERGY_EMOTION_MAP.comfortable
  if (opts.target > 0) {
    pct = (opts.net / opts.target) * 100
    detail = `本周期净储蓄 ${Math.round(opts.net)} / 目标 ${Math.round(opts.target)}`
    emotionId =
      pct >= 100
        ? ENERGY_EMOTION_MAP.happy
        : pct >= 60
          ? ENERGY_EMOTION_MAP.comfortable
          : pct < 0
            ? ENERGY_EMOTION_MAP.approaching
            : ENERGY_EMOTION_MAP.too_low
  } else if (opts.budget > 0) {
    pct = (opts.expense / opts.budget) * 100
    detail = `本周期支出 ${Math.round(opts.expense)} / 预算 ${Math.round(opts.budget)}`
    emotionId =
      pct >= 100
        ? ENERGY_EMOTION_MAP.over
        : pct >= 90
          ? ENERGY_EMOTION_MAP.approaching
          : ENERGY_EMOTION_MAP.comfortable
    return {
      id: 'savings',
      title: '储蓄',
      pct,
      detail,
      emotionId,
      tone: toneFromPct(pct, true),
    }
  } else {
    detail = `本周期净储蓄 ${Math.round(opts.net)}（未设目标）`
    pct = opts.net > 0 ? 70 : opts.net < 0 ? 30 : 50
  }
  return {
    id: 'savings',
    title: '储蓄',
    pct,
    detail,
    emotionId,
    tone: toneFromPct(pct),
  }
}

export function waterDomain(ml: number, goalMl: number): DomainBar {
  const goal = goalMl > 0 ? goalMl : 2000
  const pct = (ml / goal) * 100
  const emotionId =
    pct >= 100
      ? ENERGY_EMOTION_MAP.happy
      : pct >= 60
        ? ENERGY_EMOTION_MAP.comfortable
        : pct < 30
          ? ENERGY_EMOTION_MAP.too_low
          : ENERGY_EMOTION_MAP.approaching
  return {
    id: 'water',
    title: '饮水',
    pct,
    detail: `${ml} / ${goal} ml`,
    emotionId,
    tone: toneFromPct(pct),
  }
}

export function goalsDomain(opts: { avgPct: number; activeCount: number }): DomainBar {
  const pct = opts.avgPct
  const emotionId =
    opts.activeCount === 0
      ? '02'
      : pct >= 80
        ? ENERGY_EMOTION_MAP.satisfied
        : pct >= 40
          ? ENERGY_EMOTION_MAP.comfortable
          : ENERGY_EMOTION_MAP.too_low
  return {
    id: 'goals',
    title: '目标',
    pct,
    detail:
      opts.activeCount === 0
        ? '暂无进行中的技能目标'
        : `进行中 ${opts.activeCount} 项 · 平均进度 ${Math.round(pct)}%`,
    emotionId,
    tone: opts.activeCount === 0 ? 'muted' : toneFromPct(pct),
  }
}

export function compositeEmotion(bars: DomainBar[]): string {
  const scored = bars.filter((b) => b.id !== 'composite')
  if (scored.length === 0) return ENERGY_EMOTION_MAP.comfortable
  // 危险优先
  if (scored.some((b) => b.tone === 'danger')) return ENERGY_EMOTION_MAP.over
  if (scored.filter((b) => b.tone === 'warn').length >= 2) return ENERGY_EMOTION_MAP.approaching
  const avg = scored.reduce((s, b) => s + Math.min(100, Math.max(0, b.pct)), 0) / scored.length
  if (avg >= 75) return ENERGY_EMOTION_MAP.happy
  if (avg >= 45) return ENERGY_EMOTION_MAP.comfortable
  return ENERGY_EMOTION_MAP.too_low
}

export { buildEnergySnapshot }
