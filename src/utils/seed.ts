import { db } from '../db/database'
import type {
  Account,
  BodyWeight,
  Book,
  Category,
  ExerciseGoal,
  FixedItem,
  MonthlyBudget,
  SavingsGoal,
  SkillGoal,
  SkillStage,
  Transaction,
  WeeklyPlanItem,
  Workout,
} from '../types'
import { buildDefaultAccounts, buildDefaultCategories, DEFAULT_SETTINGS } from './defaults'
import { nid, nowISO, todayStr, yearMonth } from './id'
import { generateFixedItemsForCycle } from './fixedItems'

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

/** 写入演示数据，方便空状态体验 */
export async function seedDemoData(): Promise<void> {
  const t = nowISO()
  const categories = buildDefaultCategories()
  const accounts = buildDefaultAccounts()

  // 给账户初始余额
  accounts[1].balance = 28500 // 银行卡
  accounts[2].balance = 3200 // 支付宝
  accounts[3].balance = 860 // 微信
  accounts[0].balance = 450 // 现金

  const cat = (name: string) => categories.find((c) => c.name === name)!
  const acc = (name: string) => accounts.find((a) => a.name === name)!

  const transactions: Transaction[] = [
    {
      id: nid(),
      type: 'income',
      amount: 18000,
      categoryId: cat('工资').id,
      accountId: acc('银行卡').id,
      date: daysAgo(5),
      note: '本月工资',
      tags: ['固定'],
      createdAt: t,
      updatedAt: t,
    },
    {
      id: nid(),
      type: 'expense',
      amount: 45.5,
      categoryId: cat('餐饮').id,
      accountId: acc('支付宝').id,
      date: daysAgo(0),
      note: '午餐',
      tags: [],
      createdAt: t,
      updatedAt: t,
    },
    {
      id: nid(),
      type: 'expense',
      amount: 128,
      categoryId: cat('交通').id,
      accountId: acc('微信').id,
      date: daysAgo(1),
      note: '地铁月卡',
      tags: ['通勤'],
      createdAt: t,
      updatedAt: t,
    },
    {
      id: nid(),
      type: 'expense',
      amount: 3200,
      categoryId: cat('住房').id,
      accountId: acc('银行卡').id,
      date: daysAgo(8),
      note: '房租',
      tags: ['固定'],
      createdAt: t,
      updatedAt: t,
    },
    {
      id: nid(),
      type: 'expense',
      amount: 299,
      categoryId: cat('购物').id,
      accountId: acc('支付宝').id,
      date: daysAgo(3),
      note: '运动鞋',
      tags: [],
      createdAt: t,
      updatedAt: t,
    },
    {
      id: nid(),
      type: 'expense',
      amount: 68,
      categoryId: cat('娱乐').id,
      accountId: acc('微信').id,
      date: daysAgo(2),
      note: '电影',
      tags: [],
      createdAt: t,
      updatedAt: t,
    },
    {
      id: nid(),
      type: 'income',
      amount: 500,
      categoryId: cat('投资收益').id,
      accountId: acc('支付宝').id,
      date: daysAgo(10),
      note: '基金分红',
      tags: [],
      createdAt: t,
      updatedAt: t,
    },
    {
      id: nid(),
      type: 'expense',
      amount: 86,
      categoryId: cat('餐饮').id,
      accountId: acc('微信').id,
      date: daysAgo(4),
      note: '火锅',
      tags: ['聚餐'],
      createdAt: t,
      updatedAt: t,
    },
  ]

  const budget: MonthlyBudget = {
    id: nid(),
    yearMonth: yearMonth(),
    totalBudget: 8000,
    categoryBudgets: {
      [cat('餐饮').id]: 1500,
      [cat('交通').id]: 400,
      [cat('购物').id]: 800,
      [cat('娱乐').id]: 500,
    },
  }

  const workouts: Workout[] = [
    {
      id: nid(),
      type: '跑步',
      duration: 35,
      distance: 5.2,
      intensity: 4,
      feeling: 4,
      note: '晨跑',
      date: daysAgo(0),
      createdAt: t,
    },
    {
      id: nid(),
      type: '力量',
      duration: 50,
      sets: 4,
      reps: 12,
      weight: 40,
      intensity: 5,
      feeling: 3,
      note: '深蹲+卧推',
      date: daysAgo(1),
      createdAt: t,
    },
    {
      id: nid(),
      type: '骑行',
      duration: 30,
      distance: 12,
      intensity: 3,
      feeling: 5,
      note: '单车',
      date: daysAgo(3),
      createdAt: t,
    },
    {
      id: nid(),
      type: '瑜伽',
      duration: 15,
      intensity: 2,
      feeling: 5,
      note: '拉伸放松',
      date: daysAgo(2),
      createdAt: t,
    },
    {
      id: nid(),
      type: '跑步',
      duration: 40,
      distance: 6.0,
      intensity: 4,
      feeling: 4,
      note: '',
      date: daysAgo(5),
      createdAt: t,
    },
  ]

  const weeklyPlan: WeeklyPlanItem[] = [
    { id: nid(), weekday: 1, type: '跑步', plannedDuration: 30, isRest: false },
    { id: nid(), weekday: 2, type: '力量', plannedDuration: 45, isRest: false },
    { id: nid(), weekday: 3, type: '休息', plannedDuration: 0, isRest: true },
    { id: nid(), weekday: 4, type: '有氧', plannedDuration: 30, isRest: false },
    { id: nid(), weekday: 5, type: '力量', plannedDuration: 45, isRest: false },
    { id: nid(), weekday: 6, type: '跑步', plannedDuration: 40, isRest: false },
    { id: nid(), weekday: 0, type: '拉伸', plannedDuration: 20, isRest: false },
  ]

  const bodyWeights: BodyWeight[] = [
    { id: nid(), weight: 72.5, date: daysAgo(28), note: '' },
    { id: nid(), weight: 72.1, date: daysAgo(21), note: '' },
    { id: nid(), weight: 71.8, date: daysAgo(14), note: '' },
    { id: nid(), weight: 71.5, date: daysAgo(7), note: '' },
    { id: nid(), weight: 71.2, date: todayStr(), note: '' },
  ]

  const exerciseGoals: ExerciseGoal[] = [
    {
      id: nid(),
      title: '本月跑步 50 公里',
      kind: 'volume',
      workoutType: '跑步',
      metric: 'distance',
      target: 50,
      period: 'month',
      unit: 'km',
      createdAt: t,
    },
    {
      id: nid(),
      title: '本周力量训练 3 次',
      kind: 'volume',
      workoutType: '力量',
      metric: 'count',
      target: 3,
      period: 'week',
      unit: '次',
      createdAt: t,
    },
    {
      id: nid(),
      title: '体重降到 68 kg',
      kind: 'weight',
      metric: 'weight',
      target: 68,
      period: 'year',
      unit: 'kg',
      startWeight: 72.5,
      createdAt: t,
    },
  ]

  const savingsGoals: SavingsGoal[] = [
    {
      id: nid(),
      title: '本月净储蓄',
      targetAmount: 5000,
      period: 'month',
      createdAt: t,
    },
    {
      id: nid(),
      title: '本季度攒钱',
      targetAmount: 15000,
      period: 'quarter',
      createdAt: t,
    },
  ]

  const fixedItems: FixedItem[] = [
    {
      id: nid(),
      name: '房租',
      type: 'expense',
      amount: 3200,
      categoryId: cat('住房').id,
      accountId: acc('银行卡').id,
      dayOfMonth: null,
      enabled: true,
      createdAt: t,
      updatedAt: t,
    },
    {
      id: nid(),
      name: '地铁通勤',
      type: 'expense',
      amount: 200,
      categoryId: cat('交通').id,
      accountId: acc('微信').id,
      dayOfMonth: 1,
      enabled: true,
      createdAt: t,
      updatedAt: t,
    },
    {
      id: nid(),
      name: '工资',
      type: 'income',
      amount: 18000,
      categoryId: cat('工资').id,
      accountId: acc('银行卡').id,
      dayOfMonth: 5,
      enabled: true,
      createdAt: t,
      updatedAt: t,
    },
  ]

  const readingGoal: SkillGoal = {
    id: nid(),
    title: '读完《深入理解计算机系统》',
    type: '阅读',
    startDate: daysAgo(20),
    endDate: daysAgo(-40),
    targetQuantity: 600,
    unit: '页',
    currentAmount: 180,
    expectedPace: 10,
    status: 'active',
    notes: '每天至少 10 页',
    createdAt: t,
    updatedAt: t,
  }

  const learnGoal: SkillGoal = {
    id: nid(),
    title: '完成 TypeScript 进阶课程',
    type: '学习',
    startDate: daysAgo(10),
    endDate: daysAgo(-50),
    targetQuantity: 40,
    unit: '小时',
    currentAmount: 12,
    expectedPace: 1,
    status: 'active',
    notes: '',
    createdAt: t,
    updatedAt: t,
  }

  const habitGoal: SkillGoal = {
    id: nid(),
    title: '每日冥想',
    type: '习惯',
    startDate: daysAgo(30),
    endDate: daysAgo(-35),
    targetQuantity: 100,
    unit: '%',
    currentAmount: 45,
    expectedPace: 1.5,
    status: 'active',
    notes: '目标完成度',
    createdAt: t,
    updatedAt: t,
  }

  const stages: SkillStage[] = [
    {
      id: nid(),
      skillGoalId: readingGoal.id,
      title: '第 1 部分：程序结构和执行',
      targetAmount: 200,
      completed: false,
      order: 0,
      note: '',
    },
    {
      id: nid(),
      skillGoalId: readingGoal.id,
      title: '第 2 部分：在系统上运行程序',
      targetAmount: 400,
      completed: false,
      order: 1,
      note: '',
    },
    {
      id: nid(),
      skillGoalId: readingGoal.id,
      title: '第 3 部分：程序间通信与并发',
      targetAmount: 600,
      completed: false,
      order: 2,
      note: '',
    },
  ]

  const sampleTxt = `深入理解计算机系统 —— 试读

第一章 计算机系统漫游

计算机系统是由硬件和系统软件组成的，它们共同工作来运行应用程序。计算机系统的所有组件——硬件和软件——共同作用，最终决定了系统的性能、可靠性和安全性。

1.1 信息就是位 + 上下文

对我们来说，系统中所有的信息——包括磁盘文件、内存中的程序、内存中存放的用户数据以及网络上传送的数据——都是由一串比特表示的。区分不同数据对象的唯一方法是我们读到这些数据对象时的上下文。

例如，在不同的上下文中，同一个字节序列可能表示一个整数、浮点数、字符串或者机器指令。

1.2 程序被其他程序翻译成不同的格式

hello 程序的生命周期是从一个高级 C 语言程序开始的。这个程序可以被任何编辑器创建，然后以文本文件形式保存。

为了在系统上运行，每一条 C 语句都必须被其他程序转换为一系列低级机器语言指令。这些指令按照一种称为可执行目标程序的格式打好包，并以二进制磁盘文件的形式存放起来。

（演示用 TXT 样本，可在阅读器中翻页并同步进度到关联技能目标。）
`

  const book: Book = {
    id: nid(),
    skillGoalId: readingGoal.id,
    title: '深入理解计算机系统（试读）',
    fileName: 'csapp-sample.txt',
    fileType: 'txt',
    content: sampleTxt,
    currentPosition: 0,
    totalLength: sampleTxt.length,
    percent: 0,
    updatedAt: t,
    createdAt: t,
  }

  await db.transaction(
    'rw',
    [
      db.categories,
      db.accounts,
      db.transactions,
      db.budgets,
      db.workouts,
      db.weeklyPlan,
      db.bodyWeights,
      db.exerciseGoals,
      db.savingsGoals,
      db.fixedItems,
      db.skillGoals,
      db.skillStages,
      db.books,
      db.kv,
    ],
    async () => {
      await Promise.all([
        db.categories.clear(),
        db.accounts.clear(),
        db.transactions.clear(),
        db.budgets.clear(),
        db.workouts.clear(),
        db.weeklyPlan.clear(),
        db.bodyWeights.clear(),
        db.exerciseGoals.clear(),
        db.savingsGoals.clear(),
        db.fixedItems.clear(),
        db.skillGoals.clear(),
        db.skillStages.clear(),
        db.books.clear(),
      ])
      await db.categories.bulkAdd(categories as Category[])
      await db.accounts.bulkAdd(accounts as Account[])
      await db.transactions.bulkAdd(transactions)
      await db.budgets.bulkAdd([budget])
      await db.workouts.bulkAdd(workouts)
      await db.weeklyPlan.bulkAdd(weeklyPlan)
      await db.bodyWeights.bulkAdd(bodyWeights)
      await db.exerciseGoals.bulkAdd(exerciseGoals)
      await db.savingsGoals.bulkAdd(savingsGoals)
      await db.fixedItems.bulkAdd(fixedItems)
      await db.skillGoals.bulkAdd([readingGoal, learnGoal, habitGoal])
      await db.skillStages.bulkAdd(stages)
      await db.books.bulkAdd([book])
      await db.kv.put({ key: 'settings', value: DEFAULT_SETTINGS })
      await db.kv.put({ key: 'seeded', value: true })
    },
  )
}

export async function ensureDefaults(): Promise<void> {
  const catCount = await db.categories.count()
  if (catCount === 0) {
    await db.categories.bulkAdd(buildDefaultCategories())
  }
  const accCount = await db.accounts.count()
  if (accCount === 0) {
    await db.accounts.bulkAdd(buildDefaultAccounts())
  }
  const settings = await db.kv.get('settings')
  if (!settings) {
    await db.kv.put({ key: 'settings', value: DEFAULT_SETTINGS })
  }

  // Seed a couple of example fixed items once (non-destructive)
  const fixedCount = await db.fixedItems.count()
  if (fixedCount === 0) {
    const categories = await db.categories.toArray()
    const accounts = await db.accounts.toArray()
    const catByName = (name: string) => categories.find((c) => c.name === name)
    const accByName = (name: string) => accounts.find((a) => a.name === name)
    const t = nowISO()
    const examples: FixedItem[] = []
    const housing = catByName('住房')
    const transit = catByName('交通')
    const bank = accByName('银行卡') || accounts[0]
    const wechat = accByName('微信') || accounts[0]
    if (housing && bank) {
      examples.push({
        id: nid(),
        name: '房租',
        type: 'expense',
        amount: 3200,
        categoryId: housing.id,
        accountId: bank.id,
        dayOfMonth: null,
        enabled: false,
        createdAt: t,
        updatedAt: t,
      })
    }
    if (transit && wechat) {
      examples.push({
        id: nid(),
        name: '地铁通勤',
        type: 'expense',
        amount: 200,
        categoryId: transit.id,
        accountId: wechat.id,
        dayOfMonth: 1,
        enabled: false,
        createdAt: t,
        updatedAt: t,
      })
    }
    if (examples.length) await db.fixedItems.bulkAdd(examples)
  }

  // Auto-generate due fixed items for the current billing cycle (idempotent)
  try {
    const row = await db.kv.get('settings')
    const cycleStartDay =
      (row?.value as { cycleStartDay?: number } | undefined)?.cycleStartDay ?? 1
    await generateFixedItemsForCycle({ cycleStartDay, forceFuture: false })
  } catch (e) {
    console.warn('fixed items generate skipped', e)
  }
}
