/** 简单食物关键词 → 估算 kcal（可调） */
export const FOOD_KCAL_TABLE: { keywords: string[]; kcal: number; label: string }[] = [
  { keywords: ['米饭', '白饭', '盖饭'], kcal: 250, label: '米饭' },
  { keywords: ['面条', '拉面', '面'], kcal: 450, label: '面条' },
  { keywords: ['包子', '馒头'], kcal: 200, label: '包子/馒头' },
  { keywords: ['饺子', '水饺'], kcal: 400, label: '饺子' },
  { keywords: ['炒饭', '蛋炒饭'], kcal: 500, label: '炒饭' },
  { keywords: ['汉堡', 'burger'], kcal: 550, label: '汉堡' },
  { keywords: ['披萨', 'pizza'], kcal: 700, label: '披萨' },
  { keywords: ['炸鸡', '鸡翅', '鸡腿'], kcal: 450, label: '炸鸡' },
  { keywords: ['沙拉', 'salad'], kcal: 180, label: '沙拉' },
  { keywords: ['牛奶', '豆浆'], kcal: 120, label: '饮品' },
  { keywords: ['咖啡', '拿铁', '奶茶', '茶'], kcal: 150, label: '咖啡/茶饮' },
  { keywords: ['可乐', '汽水', '饮料'], kcal: 140, label: '碳酸饮料' },
  { keywords: ['面包', '吐司', '三明治'], kcal: 280, label: '面包' },
  { keywords: ['水果', '苹果', '香蕉', '橙子'], kcal: 100, label: '水果' },
  { keywords: ['酸奶', '优酸乳'], kcal: 130, label: '酸奶' },
  { keywords: ['零食', '薯片', '饼干', '巧克力'], kcal: 250, label: '零食' },
  { keywords: ['火锅'], kcal: 800, label: '火锅' },
  { keywords: ['烧烤', '烤肉'], kcal: 700, label: '烧烤' },
  { keywords: ['寿司', '刺身'], kcal: 350, label: '寿司' },
  { keywords: ['粥', '汤'], kcal: 150, label: '粥/汤' },
  { keywords: ['外卖', '快餐'], kcal: 650, label: '外卖快餐' },
  { keywords: ['早餐', '早饭'], kcal: 350, label: '早餐' },
  { keywords: ['午餐', '午饭', '中餐'], kcal: 600, label: '午餐' },
  { keywords: ['晚餐', '晚饭'], kcal: 650, label: '晚餐' },
  { keywords: ['宵夜', '夜宵'], kcal: 500, label: '宵夜' },
]

export const FOOD_CATEGORY_HINTS = [
  '餐饮',
  '饮食',
  '食品',
  '零食',
  '外卖',
  '早饭',
  '午饭',
  '晚饭',
  'food',
  'meal',
]

/** 默认单餐估算（无法匹配关键词时） */
export const DEFAULT_MEAL_KCAL = 500

export function isFoodCategoryName(name: string | undefined | null): boolean {
  if (!name) return false
  const n = name.toLowerCase()
  return FOOD_CATEGORY_HINTS.some((h) => n.includes(h.toLowerCase()))
}

export function estimateKcalFromText(text: string): { kcal: number; matched: string | null } {
  const t = (text || '').toLowerCase()
  if (!t.trim()) return { kcal: DEFAULT_MEAL_KCAL, matched: null }
  // 显式数字：如 "650kcal" / "650 大卡" / "卡路里650"
  const explicit = t.match(/(\d{2,4})\s*(?:kcal|大卡|卡路里|卡)/i) || t.match(/(?:kcal|大卡|卡路里)\s*[:=]?\s*(\d{2,4})/i)
  if (explicit) {
    const n = Number(explicit[1])
    if (n > 0 && n < 5000) return { kcal: n, matched: '手动/备注数字' }
  }
  for (const row of FOOD_KCAL_TABLE) {
    for (const kw of row.keywords) {
      if (t.includes(kw.toLowerCase())) {
        return { kcal: row.kcal, matched: row.label }
      }
    }
  }
  return { kcal: DEFAULT_MEAL_KCAL, matched: null }
}

export function shouldTreatAsFood(opts: {
  categoryName?: string | null
  markAsFood?: boolean
  tags?: string[]
  note?: string
}): boolean {
  if (opts.markAsFood) return true
  if (isFoodCategoryName(opts.categoryName)) return true
  const tags = (opts.tags || []).map((x) => x.toLowerCase())
  if (tags.some((t) => FOOD_CATEGORY_HINTS.some((h) => t.includes(h.toLowerCase())))) return true
  const note = (opts.note || '').toLowerCase()
  if (FOOD_CATEGORY_HINTS.some((h) => note.includes(h.toLowerCase()))) return true
  // 备注命中食物关键词也算
  const est = estimateKcalFromText(opts.note || '')
  if (est.matched && est.matched !== '手动/备注数字') return true
  return false
}
