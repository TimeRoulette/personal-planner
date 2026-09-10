/** MET 风格估算：kcal ≈ MET × 体重(kg) × 时长(h) */

export const WORKOUT_MET: Record<string, number> = {
  跑步: 9.8,
  慢跑: 7.0,
  间歇跑: 11.0,
  步行: 3.5,
  骑行: 7.5,
  游泳: 8.0,
  力量: 5.0,
  '力量·胸': 5.0,
  '力量·背': 5.0,
  '力量·腿': 6.0,
  '力量·肩': 5.0,
  '力量·臂': 4.5,
  '力量·核心': 4.0,
  '力量·全身': 6.0,
  有氧: 6.5,
  HIIT: 10.0,
  瑜伽: 2.5,
  普拉提: 3.0,
  拉伸: 2.3,
  篮球: 8.0,
  足球: 8.5,
  羽毛球: 5.5,
  网球: 7.0,
  乒乓球: 4.0,
  跳绳: 11.0,
  爬山: 7.5,
  椭圆机: 6.0,
  划船机: 7.0,
  舞蹈: 5.5,
  武术: 6.0,
  搏击: 9.0,
  攀岩: 8.0,
  滑雪: 7.0,
  其他: 4.5,
}

export const DEFAULT_BODY_WEIGHT_KG = 65

export function metForType(type: string): number {
  if (WORKOUT_MET[type] != null) return WORKOUT_MET[type]
  // 模糊匹配
  for (const [k, v] of Object.entries(WORKOUT_MET)) {
    if (type.includes(k) || k.includes(type)) return v
  }
  return WORKOUT_MET['其他']
}

/** 估算消耗 kcal；可选手动覆盖 */
export function estimateWorkoutKcal(opts: {
  type: string
  durationMin: number
  weightKg?: number
  distanceKm?: number
  intensity?: number // 1-5，微调 MET
}): number {
  const w = opts.weightKg && opts.weightKg > 0 ? opts.weightKg : DEFAULT_BODY_WEIGHT_KG
  const hours = Math.max(0, opts.durationMin) / 60
  let met = metForType(opts.type)
  if (opts.intensity != null) {
    // 强度 3 = 基准；每档 ±8%
    met *= 1 + (opts.intensity - 3) * 0.08
  }
  // 跑步有距离时用粗略 1km≈kcal≈体重系数
  if (opts.distanceKm && opts.distanceKm > 0 && /跑|走|步行/.test(opts.type)) {
    const byDist = opts.distanceKm * w * 0.9
    const byMet = met * w * hours
    return Math.round(Math.max(byDist, byMet))
  }
  return Math.round(met * w * hours)
}
