import type { AppSettings, Category, Account } from '../types'
import { nid, nowISO } from './id'

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  currency: 'CNY',
  cycleStartDay: 1,
  llm: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    apiKeyEnc: '',
    model: 'gpt-4o-mini',
    providerId: 'openai',
  },
}

export const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'createdAt'>[] = [
  { name: '工资', type: 'income', icon: '💰', color: '#10b981', isDefault: true },
  { name: '奖金', type: 'income', icon: '🎁', color: '#34d399', isDefault: true },
  { name: '投资收益', type: 'income', icon: '📈', color: '#059669', isDefault: true },
  { name: '其他收入', type: 'income', icon: '➕', color: '#6ee7b7', isDefault: true },
  { name: '餐饮', type: 'expense', icon: '🍜', color: '#f97316', isDefault: true },
  { name: '交通', type: 'expense', icon: '🚇', color: '#3b82f6', isDefault: true },
  { name: '住房', type: 'expense', icon: '🏠', color: '#8b5cf6', isDefault: true },
  { name: '购物', type: 'expense', icon: '🛒', color: '#ec4899', isDefault: true },
  { name: '娱乐', type: 'expense', icon: '🎮', color: '#a855f7', isDefault: true },
  { name: '医疗', type: 'expense', icon: '🏥', color: '#ef4444', isDefault: true },
  { name: '教育', type: 'expense', icon: '📚', color: '#0ea5e9', isDefault: true },
  { name: '其他支出', type: 'expense', icon: '📦', color: '#94a3b8', isDefault: true },
]

export const DEFAULT_ACCOUNTS: Omit<Account, 'id' | 'createdAt'>[] = [
  { name: '现金', kind: 'cash', balance: 0, color: '#f59e0b' },
  { name: '银行卡', kind: 'bank', balance: 0, color: '#3b82f6' },
  { name: '支付宝', kind: 'alipay', balance: 0, color: '#0ea5e9' },
  { name: '微信', kind: 'wechat', balance: 0, color: '#22c55e' },
]

export function buildDefaultCategories(): Category[] {
  const t = nowISO()
  return DEFAULT_CATEGORIES.map((c) => ({ ...c, id: nid(), createdAt: t }))
}

export function buildDefaultAccounts(): Account[] {
  const t = nowISO()
  return DEFAULT_ACCOUNTS.map((a) => ({ ...a, id: nid(), createdAt: t }))
}

export const CURRENCY_SYMBOL: Record<string, string> = {
  CNY: '¥',
  USD: '$',
  EUR: '€',
  JPY: '¥',
  HKD: 'HK$',
}

export const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']

/** 内置运动类型（可再自定义） */
export const EXERCISE_TYPES = [
  '跑步',
  '慢跑',
  '间歇跑',
  '步行',
  '骑行',
  '游泳',
  '力量',
  '力量·胸',
  '力量·背',
  '力量·腿',
  '力量·肩',
  '力量·臂',
  '力量·核心',
  '力量·全身',
  '有氧',
  'HIIT',
  '瑜伽',
  '普拉提',
  '拉伸',
  '篮球',
  '足球',
  '羽毛球',
  '网球',
  '乒乓球',
  '跳绳',
  '爬山',
  '椭圆机',
  '划船机',
  '舞蹈',
  '武术',
  '搏击',
  '攀岩',
  '滑雪',
  '其他',
] as const

export const SKILL_TYPES = ['阅读', '学习', '项目', '习惯', '自定义'] as const
