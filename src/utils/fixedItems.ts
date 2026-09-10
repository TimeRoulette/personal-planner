import { db } from '../db/database'
import type { Account, Category, FixedItem, Transaction } from '../types'
import { getPeriodRange, normalizeCycleStartDay } from './goalProgress'
import { nid, nowISO, todayStr } from './id'

function clampDayInMonth(year: number, monthIndex: number, day: number): number {
  const last = new Date(year, monthIndex + 1, 0).getDate()
  return Math.min(Math.max(1, day), last)
}

function fmtDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** 当前自定义月周期的 cycleKey（= 周期起点 YYYY-MM-DD） */
export function currentCycleKey(cycleStartDay = 1, ref = new Date()): string {
  return getPeriodRange('month', ref, normalizeCycleStartDay(cycleStartDay)).start
}

/**
 * 计算固定项在本周期应入账的日期。
 * - dayOfMonth 为空：周期起始日
 * - 有值：周期内第一个「日=dayOfMonth」的日期（钳到月末）
 */
export function resolveFixedApplyDate(
  item: FixedItem,
  cycleStartDay = 1,
  ref = new Date(),
): string {
  const range = getPeriodRange('month', ref, normalizeCycleStartDay(cycleStartDay))
  const day = item.dayOfMonth
  if (day == null || !Number.isFinite(day) || day <= 0) {
    return range.start
  }

  const want = Math.min(31, Math.max(1, Math.trunc(day)))
  const start = new Date(range.start + 'T00:00:00')
  const end = new Date(range.end + 'T00:00:00')
  // Prefer the calendar day `want` that falls inside [start, end]
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
  for (let i = 0; i < 3; i++) {
    const dim = clampDayInMonth(cursor.getFullYear(), cursor.getMonth(), want)
    const candidate = new Date(cursor.getFullYear(), cursor.getMonth(), dim)
    if (candidate >= start && candidate <= end) {
      return fmtDate(candidate.getFullYear(), candidate.getMonth(), dim)
    }
    cursor.setMonth(cursor.getMonth() + 1, 1)
  }
  return range.start
}

export function describeFixedSchedule(item: FixedItem): string {
  if (item.dayOfMonth == null || !Number.isFinite(item.dayOfMonth) || item.dayOfMonth <= 0) {
    return '周期起始日'
  }
  return `每月 ${Math.trunc(item.dayOfMonth)} 日`
}

async function alreadyGenerated(fixedItemId: string, cycleKey: string): Promise<boolean> {
  const hit = await db.transactions
    .where('[fixedItemId+fixedCycleKey]')
    .equals([fixedItemId, cycleKey])
    .first()
  if (hit) return true
  const any = await db.transactions
    .filter((t) => t.fixedItemId === fixedItemId && t.fixedCycleKey === cycleKey)
    .first()
  return !!any
}

function pickCategoryId(item: FixedItem, categories: Category[]): string | null {
  if (item.categoryId && categories.some((c) => c.id === item.categoryId)) return item.categoryId
  const match = categories.find((c) => c.type === item.type)
  return match?.id ?? null
}

function pickAccountId(item: FixedItem, accounts: Account[]): string | null {
  if (item.accountId && accounts.some((a) => a.id === item.accountId)) return item.accountId
  return accounts[0]?.id ?? null
}

export interface GenerateFixedResult {
  created: number
  skipped: number
  cycleKey: string
}

/**
 * 为本周期幂等生成固定收支流水。
 * @param opts.forceFuture 手动「生成本周期」时，即使入账日未到也生成
 */
export async function generateFixedItemsForCycle(opts?: {
  cycleStartDay?: number
  forceFuture?: boolean
  onlyEnabled?: boolean
  ref?: Date
}): Promise<GenerateFixedResult> {
  const cycleStartDay = normalizeCycleStartDay(opts?.cycleStartDay)
  const ref = opts?.ref ?? new Date()
  const forceFuture = opts?.forceFuture ?? false
  const onlyEnabled = opts?.onlyEnabled ?? true
  const cycleKey = currentCycleKey(cycleStartDay, ref)
  const today = todayStr()

  const [items, categories, accounts] = await Promise.all([
    db.fixedItems.toArray(),
    db.categories.toArray(),
    db.accounts.toArray(),
  ])

  let created = 0
  let skipped = 0

  for (const item of items) {
    if (onlyEnabled && !item.enabled) {
      skipped++
      continue
    }
    if (await alreadyGenerated(item.id, cycleKey)) {
      skipped++
      continue
    }

    const applyDate = resolveFixedApplyDate(item, cycleStartDay, ref)
    if (!forceFuture && applyDate > today) {
      skipped++
      continue
    }

    const categoryId = pickCategoryId(item, categories)
    const accountId = pickAccountId(item, accounts)
    if (!categoryId || !accountId) {
      skipped++
      continue
    }

    const t = nowISO()
    const tx: Transaction = {
      id: nid(),
      type: item.type,
      amount: item.amount,
      categoryId,
      accountId,
      date: applyDate,
      note: item.name,
      tags: ['固定'],
      createdAt: t,
      updatedAt: t,
      fixedItemId: item.id,
      fixedCycleKey: cycleKey,
    }

    const sign = item.type === 'income' ? 1 : -1
    await db.transaction('rw', db.transactions, db.accounts, async () => {
      const exists = await db.transactions
        .where('[fixedItemId+fixedCycleKey]')
        .equals([item.id, cycleKey])
        .first()
      if (exists) return
      await db.transactions.add(tx)
      const acc = await db.accounts.get(accountId)
      if (acc) {
        await db.accounts.update(acc.id, { balance: acc.balance + sign * item.amount })
      }
    })
    created++
  }

  return { created, skipped, cycleKey }
}

/** 预览：本周期将应用的启用固定项（含是否已生成、入账日） */
export function previewFixedForCycle(
  items: FixedItem[],
  transactions: Transaction[],
  cycleStartDay = 1,
  ref = new Date(),
): Array<{
  item: FixedItem
  applyDate: string
  cycleKey: string
  generated: boolean
}> {
  const cycleKey = currentCycleKey(cycleStartDay, ref)
  return items
    .filter((i) => i.enabled)
    .map((item) => {
      const applyDate = resolveFixedApplyDate(item, cycleStartDay, ref)
      const generated = transactions.some(
        (t) => t.fixedItemId === item.id && t.fixedCycleKey === cycleKey,
      )
      return { item, applyDate, cycleKey, generated }
    })
}
