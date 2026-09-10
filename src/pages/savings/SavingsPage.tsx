import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { db } from '../../db/database'
import { useLiveQuery } from '../../hooks/useLiveQuery'
import { useSettings } from '../../hooks/useSettings'
import { Modal } from '../../components/Modal'
import { EmptyState } from '../../components/EmptyState'
import { ProgressBar } from '../../components/ProgressBar'
import { Toast } from '../../components/Toast'
import { DateGroupedList } from '../../components/DateGroupedList'
import { CycleStartDayField } from '../../components/CycleStartDayField'
import { CURRENCY_SYMBOL } from '../../utils/defaults'
import {
  PERIOD_LABELS,
  PERIOD_OPTIONS,
  computeSavingsProgress,
  formatPeriodRangeLabel,
  getPeriodRange,
} from '../../utils/goalProgress'
import { formatMoney, nid, nowISO, todayStr, yearMonth } from '../../utils/id'
import {
  describeFixedSchedule,
  generateFixedItemsForCycle,
  previewFixedForCycle,
} from '../../utils/fixedItems'
import type { Account, Category, FixedItem, GoalPeriod, SavingsGoal, Transaction, TxType } from '../../types'

type Tab = 'overview' | 'transactions' | 'budget' | 'goals' | 'fixed' | 'charts'

const PIE_COLORS = ['#0f766e', '#3b82f6', '#f97316', '#a855f7', '#ec4899', '#eab308', '#64748b', '#14b8a6']

export function SavingsPage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [toast, setToast] = useState<string | null>(null)
  const [showTx, setShowTx] = useState(false)
  const [editTx, setEditTx] = useState<Transaction | null>(null)
  const [range, setRange] = useState<'week' | 'month' | 'year'>('month')
  const [filter, setFilter] = useState({
    type: '' as '' | TxType,
    categoryId: '',
    accountId: '',
    keyword: '',
    minAmount: '',
    maxAmount: '',
    dateFrom: '',
    dateTo: '',
  })

  const { settings, updateSettings } = useSettings()
  const symbol = CURRENCY_SYMBOL[settings.currency] || '¥'

  const categories = useLiveQuery(() => db.categories.toArray(), [], []) ?? []
  const accounts = useLiveQuery(() => db.accounts.toArray(), [], []) ?? []
  const transactions = useLiveQuery(() => db.transactions.orderBy('date').reverse().toArray(), [], []) ?? []
  const budgets = useLiveQuery(() => db.budgets.toArray(), [], []) ?? []
  const savingsGoals = useLiveQuery(() => db.savingsGoals.toArray(), [], []) ?? []
  const fixedItems = useLiveQuery(() => db.fixedItems.toArray(), [], []) ?? []

  const ym = yearMonth()
  const budget = budgets.find((b) => b.yearMonth === ym)

  const monthTx = useMemo(
    () => transactions.filter((t) => t.date.startsWith(ym)),
    [transactions, ym],
  )

  const monthIncome = monthTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
  const monthExpense = monthTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
  const netAssets = accounts.reduce((s, a) => s + a.balance, 0)
  const savingsRate = monthIncome > 0 ? ((monthIncome - monthExpense) / monthIncome) * 100 : 0
  const budgetRemaining = (budget?.totalBudget ?? 0) - monthExpense

  const filteredTx = useMemo(() => {
    return transactions.filter((t) => {
      if (filter.type && t.type !== filter.type) return false
      if (filter.categoryId && t.categoryId !== filter.categoryId) return false
      if (filter.accountId && t.accountId !== filter.accountId) return false
      if (filter.keyword) {
        const kw = filter.keyword.toLowerCase()
        if (!t.note.toLowerCase().includes(kw) && !t.tags.some((x) => x.toLowerCase().includes(kw)))
          return false
      }
      if (filter.minAmount && t.amount < Number(filter.minAmount)) return false
      if (filter.maxAmount && t.amount > Number(filter.maxAmount)) return false
      if (filter.dateFrom && t.date < filter.dateFrom) return false
      if (filter.dateTo && t.date > filter.dateTo) return false
      return true
    })
  }, [transactions, filter])

  const trendData = useMemo(() => {
    const days = range === 'week' ? 7 : range === 'month' ? 30 : 365
    const map = new Map<string, { income: number; expense: number }>()
    const start = new Date()
    start.setDate(start.getDate() - (days - 1))
    for (let i = 0; i < days; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      const key = d.toISOString().slice(0, 10)
      map.set(key, { income: 0, expense: 0 })
    }
    for (const t of transactions) {
      const bucket = map.get(t.date)
      if (!bucket) continue
      if (t.type === 'income') bucket.income += t.amount
      else bucket.expense += t.amount
    }
    return [...map.entries()].map(([date, v]) => ({
      date: date.slice(5),
      ...v,
      net: v.income - v.expense,
    }))
  }, [transactions, range])

  const categoryPie = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of monthTx.filter((x) => x.type === 'expense')) {
      map.set(t.categoryId, (map.get(t.categoryId) || 0) + t.amount)
    }
    return [...map.entries()]
      .map(([id, value]) => ({
        name: categories.find((c) => c.id === id)?.name || '未知',
        value,
      }))
      .sort((a, b) => b.value - a.value)
  }, [monthTx, categories])

  const accountDist = useMemo(
    () => accounts.map((a) => ({ name: a.name, value: Math.max(0, a.balance) })),
    [accounts],
  )

  async function saveTransaction(data: {
    type: TxType
    amount: number
    categoryId: string
    accountId: string
    date: string
    note: string
    tags: string[]
  }) {
    const t = nowISO()
    const signOf = (type: TxType) => (type === 'income' ? 1 : -1)
    if (editTx) {
      await db.transaction('rw', db.transactions, db.accounts, async () => {
        const oldAcc = await db.accounts.get(editTx.accountId)
        if (oldAcc) {
          await db.accounts.update(oldAcc.id, {
            balance: oldAcc.balance - signOf(editTx.type) * editTx.amount,
          })
        }
        const newAcc = await db.accounts.get(data.accountId)
        if (newAcc) {
          await db.accounts.update(newAcc.id, {
            balance: newAcc.balance + signOf(data.type) * data.amount,
          })
        }
        await db.transactions.update(editTx.id, { ...data, updatedAt: t })
      })
      setToast('已更新交易')
    } else {
      const tx: Transaction = { id: nid(), ...data, createdAt: t, updatedAt: t }
      await db.transaction('rw', db.transactions, db.accounts, async () => {
        await db.transactions.add(tx)
        const acc = await db.accounts.get(data.accountId)
        if (acc) {
          await db.accounts.update(acc.id, {
            balance: acc.balance + signOf(data.type) * data.amount,
          })
        }
      })
      setToast('已记一笔（储蓄目标进度已自动更新）')
    }
    setShowTx(false)
    setEditTx(null)
  }

  async function deleteTx(tx: Transaction) {
    if (!confirm('确认删除该笔交易？')) return
    await db.transaction('rw', db.transactions, db.accounts, async () => {
      const acc = await db.accounts.get(tx.accountId)
      if (acc) {
        const sign = tx.type === 'income' ? 1 : -1
        await db.accounts.update(acc.id, { balance: acc.balance - sign * tx.amount })
      }
      await db.transactions.delete(tx.id)
    })
    setToast('已删除')
  }

  async function saveBudget(total: number, categoryBudgets: Record<string, number>) {
    if (budget) {
      await db.budgets.update(budget.id, { totalBudget: total, categoryBudgets })
    } else {
      await db.budgets.add({
        id: nid(),
        yearMonth: ym,
        totalBudget: total,
        categoryBudgets,
      })
    }
    setToast('预算已保存')
  }

  async function addSavingsGoal(title: string, targetAmount: number, period: GoalPeriod) {
    await db.savingsGoals.add({
      id: nid(),
      title,
      targetAmount,
      period,
      createdAt: nowISO(),
    })
    setToast('储蓄目标已添加')
  }

  async function deleteSavingsGoal(id: string) {
    if (!confirm('删除该储蓄目标？')) return
    await db.savingsGoals.delete(id)
    setToast('已删除')
  }

  const catName = (id: string) => categories.find((c) => c.id === id)?.name || '—'
  const accName = (id: string) => accounts.find((a) => a.id === id)?.name || '—'
  const budgetUsedPct = budget?.totalBudget ? (monthExpense / budget.totalBudget) * 100 : 0

  return (
    <div>
      <h1 className="page-title">储蓄</h1>
      <div className="tabs-seg">
        {(
          [
            ['overview', '总览'],
            ['transactions', '流水'],
            ['budget', '预算'],
            ['goals', '目标'],
            ['fixed', '固定'],
            ['charts', '图表'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <CycleStartDayField
            value={settings.cycleStartDay}
            onCommit={(day) => updateSettings({ cycleStartDay: day })}
          />
          <div className="stat-grid">
            <div className="stat">
              <div className="label">净资产</div>
              <div className="value">{formatMoney(netAssets, symbol)}</div>
            </div>
            <div className="stat">
              <div className="label">本月储蓄率</div>
              <div className={`value ${savingsRate >= 0 ? 'positive' : 'negative'}`}>
                {savingsRate.toFixed(1)}%
              </div>
            </div>
            <div className="stat">
              <div className="label">本月收入</div>
              <div className="value positive">{formatMoney(monthIncome, symbol)}</div>
            </div>
            <div className="stat">
              <div className="label">本月支出</div>
              <div className="value negative">{formatMoney(monthExpense, symbol)}</div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 12 }}>
            <div className="card-title">本月预算剩余</div>
            {budget ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <strong className={budgetRemaining < 0 ? 'negative' : ''}>
                    {formatMoney(budgetRemaining, symbol)}
                  </strong>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    已用 {budgetUsedPct.toFixed(0)}% / {formatMoney(budget.totalBudget, symbol)}
                  </span>
                </div>
                <ProgressBar value={budgetUsedPct} />
                {budgetRemaining < 0 && (
                  <p style={{ color: 'var(--danger)', fontSize: '0.85rem', margin: '8px 0 0' }}>
                    ⚠️ 已超支 {formatMoney(-budgetRemaining, symbol)}
                  </p>
                )}
              </>
            ) : (
              <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.9rem' }}>
                尚未设置本月预算，可在「预算」页配置
              </p>
            )}
          </div>

          {savingsGoals.length > 0 && (
            <div className="card">
              <div className="card-title">储蓄目标进度</div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 0 }}>
                进度 = 周期内净储蓄（收入 − 支出）÷ 目标金额，记账后自动更新。
              </p>
              {savingsGoals.map((g) => {
                const p = computeSavingsProgress(g, transactions, settings.cycleStartDay)
                return (
                  <div key={g.id} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span>
                        {g.title}
                        <span className="badge muted" style={{ marginLeft: 6 }}>
                          {PERIOD_LABELS[g.period]}
                        </span>
                      </span>
                      <span>{Math.min(100, Math.max(0, p.pct)).toFixed(0)}%</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                      净储蓄 {formatMoney(p.net, symbol)} / 目标 {formatMoney(p.target, symbol)}
                      <span style={{ marginLeft: 8 }}>
                        （收 {formatMoney(p.income, symbol)} − 支 {formatMoney(p.expense, symbol)}）
                      </span>
                    </div>
                    <ProgressBar value={Math.max(0, p.pct)} warnAt={100} dangerAt={101} />
                  </div>
                )
              })}
            </div>
          )}

          <div className="card">
            <div className="card-title">收支趋势</div>
            <div className="chip-row" style={{ marginBottom: 8 }}>
              {(['week', 'month', 'year'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`chip ${range === r ? 'active' : ''}`}
                  onClick={() => setRange(r)}
                >
                  {r === 'week' ? '近一周' : r === 'month' ? '近一月' : '近一年'}
                </button>
              ))}
            </div>
            <div style={{ width: '100%', height: 200 }}>
              <ResponsiveContainer>
                <AreaChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} hide={range === 'year'} />
                  <YAxis tick={{ fontSize: 10 }} width={40} />
                  <Tooltip />
                  <Area type="monotone" dataKey="income" name="收入" stroke="#10b981" fill="#10b98133" />
                  <Area type="monotone" dataKey="expense" name="支出" stroke="#f97316" fill="#f9731633" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <button type="button" className="btn btn-primary btn-block" onClick={() => { setEditTx(null); setShowTx(true) }}>
            ＋ 快速记账
          </button>
        </>
      )}

      {tab === 'transactions' && (
        <>
          <div className="card" style={{ maxWidth: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
            <div className="field">
              <label>关键词</label>
              <input
                value={filter.keyword}
                onChange={(e) => setFilter({ ...filter, keyword: e.target.value })}
                placeholder="备注 / 标签"
                style={{ width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}
              />
            </div>
            <div className="filter-grid">
              <div className="field">
                <label>类型</label>
                <select
                  value={filter.type}
                  onChange={(e) => setFilter({ ...filter, type: e.target.value as '' | TxType })}
                >
                  <option value="">全部</option>
                  <option value="income">收入</option>
                  <option value="expense">支出</option>
                </select>
              </div>
              <div className="field">
                <label>分类</label>
                <select
                  value={filter.categoryId}
                  onChange={(e) => setFilter({ ...filter, categoryId: e.target.value })}
                >
                  <option value="">全部</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>账户</label>
                <select
                  value={filter.accountId}
                  onChange={(e) => setFilter({ ...filter, accountId: e.target.value })}
                >
                  <option value="">全部</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>金额范围</label>
                <div className="amount-range">
                  <input
                    type="number"
                    placeholder="最小"
                    value={filter.minAmount}
                    onChange={(e) => setFilter({ ...filter, minAmount: e.target.value })}
                  />
                  <input
                    type="number"
                    placeholder="最大"
                    value={filter.maxAmount}
                    onChange={(e) => setFilter({ ...filter, maxAmount: e.target.value })}
                  />
                </div>
              </div>
              <div className="field">
                <label>开始日期</label>
                <input type="date" value={filter.dateFrom} onChange={(e) => setFilter({ ...filter, dateFrom: e.target.value })} />
              </div>
              <div className="field">
                <label>结束日期</label>
                <input type="date" value={filter.dateTo} onChange={(e) => setFilter({ ...filter, dateTo: e.target.value })} />
              </div>
            </div>
          </div>

          {filteredTx.length === 0 ? (
            <EmptyState
              icon="🧾"
              title="暂无流水"
              description="点击下方按钮记一笔"
              action={{ label: '记一笔', onClick: () => { setEditTx(null); setShowTx(true) } }}
            />
          ) : (
            <DateGroupedList
              items={filteredTx}
              renderItem={(t) => (
                <div className="list-item">
                  <div className="meta" onClick={() => { setEditTx(t); setShowTx(true) }} role="button" tabIndex={0}>
                    <div className="title">
                      {categories.find((c) => c.id === t.categoryId)?.icon || '📌'} {catName(t.categoryId)}
                    </div>
                    <div className="sub">
                      {accName(t.accountId)}
                      {t.note ? ` · ${t.note}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className={`trailing ${t.type === 'income' ? 'positive' : 'negative'}`} style={{ color: t.type === 'income' ? 'var(--success)' : 'var(--danger)' }}>
                      {t.type === 'income' ? '+' : '-'}
                      {formatMoney(t.amount, symbol)}
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => deleteTx(t)}>
                      删除
                    </button>
                  </div>
                </div>
              )}
            />
          )}
        </>
      )}

      {tab === 'budget' && (
        <BudgetPanel
          budget={budget}
          categories={categories.filter((c) => c.type === 'expense')}
          monthExpense={monthExpense}
          monthTx={monthTx}
          symbol={symbol}
          onSave={saveBudget}
        />
      )}

      {tab === 'goals' && (
        <SavingsGoalsPanel
          goals={savingsGoals}
          transactions={transactions}
          symbol={symbol}
          cycleStartDay={settings.cycleStartDay}
          onAdd={addSavingsGoal}
          onDelete={deleteSavingsGoal}
        />
      )}


      {tab === 'fixed' && (
        <FixedItemsPanel
          items={fixedItems}
          categories={categories}
          accounts={accounts}
          transactions={transactions}
          symbol={symbol}
          cycleStartDay={settings.cycleStartDay}
          onToast={setToast}
        />
      )}

      {tab === 'charts' && (
        <>
          <div className="card">
            <div className="card-title">储蓄进度（本月）</div>
            <div style={{ marginBottom: 8 }}>
              结余 {formatMoney(monthIncome - monthExpense, symbol)} / 收入{' '}
              {formatMoney(monthIncome, symbol)}
            </div>
            <ProgressBar value={Math.max(0, savingsRate)} warnAt={30} dangerAt={0} />
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 6 }}>
              储蓄率 {savingsRate.toFixed(1)}%
            </div>
          </div>

          <div className="card">
            <div className="card-title">支出分类占比</div>
            {categoryPie.length === 0 ? (
              <EmptyState icon="📊" title="暂无支出数据" />
            ) : (
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={categoryPie} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {categoryPie.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatMoney(Number(v), symbol)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {categoryPie.map((c, i) => (
                <span key={c.name} className="badge muted">
                  <span style={{ color: PIE_COLORS[i % PIE_COLORS.length] }}>●</span> {c.name}{' '}
                  {formatMoney(c.value, symbol)}
                </span>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">账户资产分布</div>
            {accountDist.every((a) => a.value === 0) ? (
              <EmptyState icon="🏦" title="账户余额均为 0" />
            ) : (
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={accountDist.filter((a) => a.value > 0)} dataKey="value" nameKey="name" outerRadius={80}>
                      {accountDist.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatMoney(Number(v), symbol)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <AccountsManager accounts={accounts} symbol={symbol} onToast={setToast} />
          <CategoriesManager categories={categories} onToast={setToast} />
        </>
      )}

      <button
        type="button"
        className="fab"
        aria-label="记一笔"
        onClick={() => {
          setEditTx(null)
          setShowTx(true)
        }}
      >
        ＋
      </button>

      <TxForm
        open={showTx}
        onClose={() => { setShowTx(false); setEditTx(null) }}
        categories={categories}
        accounts={accounts}
        initial={editTx}
        onSave={saveTransaction}
      />
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  )
}

function TxForm({
  open,
  onClose,
  categories,
  accounts,
  initial,
  onSave,
}: {
  open: boolean
  onClose: () => void
  categories: Category[]
  accounts: Account[]
  initial: Transaction | null
  onSave: (data: {
    type: TxType
    amount: number
    categoryId: string
    accountId: string
    date: string
    note: string
    tags: string[]
  }) => void
}) {
  const [type, setType] = useState<TxType>(initial?.type ?? 'expense')
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? '')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '')
  const [accountId, setAccountId] = useState(initial?.accountId ?? '')
  const [date, setDate] = useState(initial?.date ?? todayStr())
  const [note, setNote] = useState(initial?.note ?? '')
  const [tags, setTags] = useState(initial?.tags?.join(',') ?? '')

  useEffect(() => {
    if (!open) return
    setType(initial?.type ?? 'expense')
    setAmount(initial?.amount?.toString() ?? '')
    setCategoryId(initial?.categoryId ?? '')
    setAccountId(initial?.accountId ?? accounts[0]?.id ?? '')
    setDate(initial?.date ?? todayStr())
    setNote(initial?.note ?? '')
    setTags(initial?.tags?.join(',') ?? '')
  }, [open, initial, accounts])

  const filteredCats = categories.filter((c) => c.type === type)

  return (
    <Modal open={open} title={initial ? '编辑交易' : '记一笔'} onClose={onClose}>
      <div className="tabs-seg">
        <button type="button" className={type === 'expense' ? 'active' : ''} onClick={() => setType('expense')}>
          支出
        </button>
        <button type="button" className={type === 'income' ? 'active' : ''} onClick={() => setType('income')}>
          收入
        </button>
      </div>
      <div className="field">
        <label>金额</label>
        <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
      </div>
      <div className="field">
        <label>分类</label>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">请选择</option>
          {filteredCats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>账户</label>
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>日期</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="field">
        <label>备注</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="可选" />
      </div>
      <div className="field">
        <label>标签（逗号分隔）</label>
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="固定,通勤" />
      </div>
      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => {
          const n = Number(amount)
          if (!n || n <= 0) return alert('请输入有效金额')
          if (!categoryId) return alert('请选择分类')
          if (!accountId) return alert('请选择账户')
          onSave({
            type,
            amount: n,
            categoryId,
            accountId,
            date,
            note,
            tags: tags
              .split(',')
              .map((x) => x.trim())
              .filter(Boolean),
          })
        }}
      >
        保存
      </button>
    </Modal>
  )
}

function BudgetPanel({
  budget,
  categories,
  monthExpense,
  monthTx,
  symbol,
  onSave,
}: {
  budget?: { totalBudget: number; categoryBudgets: Record<string, number> }
  categories: Category[]
  monthExpense: number
  monthTx: Transaction[]
  symbol: string
  onSave: (total: number, categoryBudgets: Record<string, number>) => void
}) {
  const [total, setTotal] = useState(String(budget?.totalBudget ?? 8000))
  const [cats, setCats] = useState<Record<string, string>>(() => {
    const o: Record<string, string> = {}
    for (const c of categories) {
      o[c.id] = String(budget?.categoryBudgets?.[c.id] ?? '')
    }
    return o
  })

  const spentByCat = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of monthTx.filter((x) => x.type === 'expense')) {
      m.set(t.categoryId, (m.get(t.categoryId) || 0) + t.amount)
    }
    return m
  }, [monthTx])

  return (
    <div className="card">
      <div className="card-title">本月总预算</div>
      <div className="field">
        <label>总额</label>
        <input type="number" value={total} onChange={(e) => setTotal(e.target.value)} />
      </div>
      <div style={{ marginBottom: 12 }}>
        已支出 {formatMoney(monthExpense, symbol)} / {formatMoney(Number(total) || 0, symbol)}
        {(Number(total) || 0) > 0 && monthExpense > Number(total) && (
          <span className="badge danger" style={{ marginLeft: 8 }}>
            超支
          </span>
        )}
      </div>
      <div className="card-title">分类预算</div>
      {categories.map((c) => {
        const spent = spentByCat.get(c.id) || 0
        const limit = Number(cats[c.id]) || 0
        const over = limit > 0 && spent > limit
        return (
          <div key={c.id} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>
                {c.icon} {c.name}
              </span>
              <span style={{ fontSize: '0.8rem', color: over ? 'var(--danger)' : 'var(--text-secondary)' }}>
                {formatMoney(spent, symbol)}
                {limit > 0 ? ` / ${formatMoney(limit, symbol)}` : ''}
                {over ? ' 超支' : ''}
              </span>
            </div>
            <input
              type="number"
              placeholder="不限"
              value={cats[c.id] ?? ''}
              onChange={(e) => setCats({ ...cats, [c.id]: e.target.value })}
              style={{ width: '100%', minHeight: 40, borderRadius: 10, border: '1px solid var(--border)', padding: '0 10px', background: 'var(--bg)' }}
            />
            {limit > 0 && <ProgressBar value={(spent / limit) * 100} />}
          </div>
        )
      })}
      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => {
          const cb: Record<string, number> = {}
          for (const [k, v] of Object.entries(cats)) {
            if (v && Number(v) > 0) cb[k] = Number(v)
          }
          onSave(Number(total) || 0, cb)
        }}
      >
        保存预算
      </button>
    </div>
  )
}

function AccountsManager({
  accounts,
  symbol,
  onToast,
}: {
  accounts: Account[]
  symbol: string
  onToast: (s: string) => void
}) {
  const [name, setName] = useState('')
  async function add() {
    if (!name.trim()) return
    await db.accounts.add({
      id: nid(),
      name: name.trim(),
      kind: 'other',
      balance: 0,
      color: '#64748b',
      createdAt: nowISO(),
    })
    setName('')
    onToast('账户已添加')
  }
  return (
    <div className="card">
      <div className="card-title">账户管理</div>
      {accounts.map((a) => (
        <div key={a.id} className="list-item">
          <div className="meta">
            <div className="title">{a.name}</div>
            <div className="sub">{a.kind}</div>
          </div>
          <div className="trailing">{formatMoney(a.balance, symbol)}</div>
        </div>
      ))}
      <div className="row-actions" style={{ marginTop: 8 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="新账户名称"
          style={{ flex: 1, minHeight: 44, borderRadius: 10, border: '1px solid var(--border)', padding: '0 10px', background: 'var(--bg)' }}
        />
        <button type="button" className="btn btn-secondary" onClick={add}>
          添加
        </button>
      </div>
    </div>
  )
}

function CategoriesManager({
  categories,
  onToast,
}: {
  categories: Category[]
  onToast: (s: string) => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<TxType>('expense')
  async function add() {
    if (!name.trim()) return
    await db.categories.add({
      id: nid(),
      name: name.trim(),
      type,
      icon: type === 'income' ? '➕' : '📌',
      color: '#64748b',
      isDefault: false,
      createdAt: nowISO(),
    })
    setName('')
    onToast('分类已添加')
  }
  return (
    <div className="card">
      <div className="card-title">分类管理</div>
      <div className="chip-row" style={{ marginBottom: 8 }}>
        {categories.map((c) => (
          <span key={c.id} className="chip">
            {c.icon} {c.name}
          </span>
        ))}
      </div>
      <div className="tabs-seg">
        <button type="button" className={type === 'expense' ? 'active' : ''} onClick={() => setType('expense')}>
          支出
        </button>
        <button type="button" className={type === 'income' ? 'active' : ''} onClick={() => setType('income')}>
          收入
        </button>
      </div>
      <div className="row-actions">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="新分类名称"
          style={{ flex: 1, minHeight: 44, borderRadius: 10, border: '1px solid var(--border)', padding: '0 10px', background: 'var(--bg)' }}
        />
        <button type="button" className="btn btn-secondary" onClick={add}>
          添加
        </button>
      </div>
    </div>
  )
}

function SavingsGoalsPanel({
  goals,
  transactions,
  symbol,
  cycleStartDay,
  onAdd,
  onDelete,
}: {
  goals: SavingsGoal[]
  transactions: Transaction[]
  symbol: string
  cycleStartDay: number
  onAdd: (title: string, targetAmount: number, period: GoalPeriod) => void
  onDelete: (id: string) => void
}) {
  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('5000')
  const [period, setPeriod] = useState<GoalPeriod>('month')

  function defaultTitle() {
    const p = PERIOD_OPTIONS.find((x) => x.value === period)?.label || ''
    return `${p}净储蓄 ${amount}`
  }

  return (
    <>
      <div className="card">
        <div className="card-title">储蓄目标说明</div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          选择周期（周 / 月 / 季度 / 半年 / 年）并设定目标金额。进度按<strong>当前周期内净储蓄</strong>
          （收入 − 支出）自动从流水汇总，无需手动改进度。周期起止由本页「目标周期」起始日决定（默认自然月）；换周期或记新账后总览进度条会刷新。
        </p>
      </div>

      <div className="card">
        <div className="card-title">当前目标</div>
        {goals.length === 0 ? (
          <EmptyState icon="🐷" title="暂无储蓄目标" />
        ) : (
          goals.map((g) => {
            const p = computeSavingsProgress(g, transactions, cycleStartDay)
            return (
              <div key={g.id} className="list-item">
                <div className="meta" style={{ flex: 1 }}>
                  <div className="title">
                    {g.title}{' '}
                    <span className="badge muted">{PERIOD_LABELS[g.period]}</span>
                  </div>
                  <div className="sub">
                    {formatMoney(p.net, symbol)} / {formatMoney(p.target, symbol)} · {formatPeriodRangeLabel(p.range)}
                  </div>
                  <ProgressBar value={Math.max(0, p.pct)} warnAt={100} dangerAt={101} />
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDelete(g.id)}>
                  删除
                </button>
              </div>
            )
          })
        )}
      </div>

      <div className="card">
        <div className="card-title">新建储蓄目标</div>
        <div className="field">
          <label>周期</label>
          <select value={period} onChange={(e) => setPeriod(e.target.value as GoalPeriod)}>
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>目标金额</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="field">
          <label>标题（可改）</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={defaultTitle()} />
        </div>
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => {
            const n = Number(amount)
            if (!n || n <= 0) return alert('请输入有效目标金额')
            onAdd(title.trim() || defaultTitle(), n, period)
            setTitle('')
          }}
        >
          添加目标
        </button>
      </div>
    </>
  )
}


function FixedItemsPanel({
  items,
  categories,
  accounts,
  transactions,
  symbol,
  cycleStartDay,
  onToast,
}: {
  items: FixedItem[]
  categories: Category[]
  accounts: Account[]
  transactions: Transaction[]
  symbol: string
  cycleStartDay: number
  onToast: (s: string) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<FixedItem | null>(null)
  const [busy, setBusy] = useState(false)

  const cycleRange = getPeriodRange('month', new Date(), cycleStartDay)
  const preview = previewFixedForCycle(items, transactions, cycleStartDay)

  async function generateNow() {
    setBusy(true)
    try {
      const res = await generateFixedItemsForCycle({
        cycleStartDay,
        forceFuture: true,
      })
      onToast(
        res.created > 0
          ? `已生成 ${res.created} 笔本周期固定流水`
          : '本周期固定项已全部生成或无需生成',
      )
    } catch (e) {
      onToast(e instanceof Error ? e.message : '生成失败')
    } finally {
      setBusy(false)
    }
  }

  async function toggleEnabled(item: FixedItem) {
    await db.fixedItems.update(item.id, {
      enabled: !item.enabled,
      updatedAt: nowISO(),
    })
  }

  async function removeItem(item: FixedItem) {
    if (!confirm(`删除固定项「${item.name}」？不会删除已生成的流水。`)) return
    await db.fixedItems.delete(item.id)
    onToast('已删除固定项')
  }

  async function saveItem(data: {
    name: string
    type: TxType
    amount: number
    categoryId: string
    accountId: string
    dayOfMonth: number | null
    enabled: boolean
  }) {
    const t = nowISO()
    if (editItem) {
      await db.fixedItems.update(editItem.id, {
        ...data,
        categoryId: data.categoryId || undefined,
        accountId: data.accountId || undefined,
        updatedAt: t,
      })
      onToast('固定项已更新')
    } else {
      const row: FixedItem = {
        id: nid(),
        name: data.name,
        type: data.type,
        amount: data.amount,
        categoryId: data.categoryId || undefined,
        accountId: data.accountId || undefined,
        dayOfMonth: data.dayOfMonth,
        enabled: data.enabled,
        createdAt: t,
        updatedAt: t,
      }
      await db.fixedItems.add(row)
      onToast('固定项已添加')
    }
    setShowForm(false)
    setEditItem(null)
  }

  const catName = (id?: string) => (id ? categories.find((c) => c.id === id)?.name : '默认分类') || '默认分类'
  const accName = (id?: string) => (id ? accounts.find((a) => a.id === id)?.name : '默认账户') || '默认账户'

  return (
    <>
      <div className="card">
        <div className="card-title">固定收支说明</div>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
          配置房租、通勤、工资等周期重复项。每个计费周期（跟随储蓄页周期起始日）只自动生成一次流水，不会重复。
          也可手动点「生成本周期」。当前周期：
          <strong> {formatPeriodRangeLabel(cycleRange)}</strong>
        </p>
      </div>

      <div className="card">
        <div className="card-title">本周期将应用</div>
        {preview.length === 0 ? (
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            暂无启用的固定项
          </p>
        ) : (
          preview.map(({ item, applyDate, generated }) => (
            <div key={item.id} className="list-item">
              <div className="meta">
                <div className="title">
                  {item.type === 'income' ? '＋' : '－'}
                  {item.name}
                </div>
                <div className="sub">
                  入账日 {applyDate} · {describeFixedSchedule(item)}
                </div>
              </div>
              <span className={`badge ${generated ? 'success' : 'muted'}`}>
                {generated ? '已生成' : '待生成'}
              </span>
            </div>
          ))
        )}
        <button
          type="button"
          className="btn btn-primary btn-block"
          style={{ marginTop: 10 }}
          disabled={busy}
          onClick={() => void generateNow()}
        >
          {busy ? '生成中…' : '生成本周期'}
        </button>
      </div>

      <div className="card">
        <div className="card-title">全部固定项</div>
        {items.length === 0 ? (
          <EmptyState icon="🔁" title="暂无固定项" description="添加房租、通勤等，避免每月重复记账" />
        ) : (
          items.map((item) => (
            <div key={item.id} className="list-item">
              <div
                className="meta"
                role="button"
                tabIndex={0}
                onClick={() => {
                  setEditItem(item)
                  setShowForm(true)
                }}
              >
                <div className="title">
                  {item.name}{' '}
                  <span className={`badge ${item.enabled ? 'success' : 'muted'}`}>
                    {item.enabled ? '启用' : '停用'}
                  </span>
                </div>
                <div className="sub">
                  {item.type === 'income' ? '收入' : '支出'} · {formatMoney(item.amount, symbol)} ·{' '}
                  {describeFixedSchedule(item)} · {catName(item.categoryId)} · {accName(item.accountId)}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void toggleEnabled(item)}>
                  {item.enabled ? '停用' : '启用'}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => void removeItem(item)}>
                  删除
                </button>
              </div>
            </div>
          ))
        )}
        <button
          type="button"
          className="btn btn-secondary btn-block"
          style={{ marginTop: 8 }}
          onClick={() => {
            setEditItem(null)
            setShowForm(true)
          }}
        >
          ＋ 添加固定项
        </button>
      </div>

      <FixedItemForm
        open={showForm}
        onClose={() => {
          setShowForm(false)
          setEditItem(null)
        }}
        categories={categories}
        accounts={accounts}
        initial={editItem}
        onSave={saveItem}
      />
    </>
  )
}

function FixedItemForm({
  open,
  onClose,
  categories,
  accounts,
  initial,
  onSave,
}: {
  open: boolean
  onClose: () => void
  categories: Category[]
  accounts: Account[]
  initial: FixedItem | null
  onSave: (data: {
    name: string
    type: TxType
    amount: number
    categoryId: string
    accountId: string
    dayOfMonth: number | null
    enabled: boolean
  }) => void
}) {
  const [name, setName] = useState('')
  const [type, setType] = useState<TxType>('expense')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [accountId, setAccountId] = useState('')
  const [dayMode, setDayMode] = useState<'cycle' | 'day'>('cycle')
  const [dayOfMonth, setDayOfMonth] = useState('1')
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    if (!open) return
    setName(initial?.name ?? '')
    setType(initial?.type ?? 'expense')
    setAmount(initial?.amount != null ? String(initial.amount) : '')
    setCategoryId(initial?.categoryId ?? '')
    setAccountId(initial?.accountId ?? accounts[0]?.id ?? '')
    const hasDay = initial?.dayOfMonth != null && Number(initial.dayOfMonth) > 0
    setDayMode(hasDay ? 'day' : 'cycle')
    setDayOfMonth(hasDay ? String(initial!.dayOfMonth) : '1')
    setEnabled(initial?.enabled ?? true)
  }, [open, initial, accounts])

  const filteredCats = categories.filter((c) => c.type === type)

  return (
    <Modal open={open} title={initial ? '编辑固定项' : '添加固定项'} onClose={onClose}>
      <div className="tabs-seg">
        <button type="button" className={type === 'expense' ? 'active' : ''} onClick={() => setType('expense')}>
          固定支出
        </button>
        <button type="button" className={type === 'income' ? 'active' : ''} onClick={() => setType('income')}>
          固定收入
        </button>
      </div>
      <div className="field">
        <label>名称</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="如：房租 / 通勤 / 工资" />
      </div>
      <div className="field">
        <label>金额</label>
        <input type="number" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="field">
        <label>分类（可选）</label>
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">自动（按类型默认）</option>
          {filteredCats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>账户（可选）</label>
        <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">自动（首个账户）</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>入账日</label>
        <select
          value={dayMode}
          onChange={(e) => setDayMode(e.target.value as 'cycle' | 'day')}
        >
          <option value="cycle">周期起始日</option>
          <option value="day">指定每月某日</option>
        </select>
      </div>
      {dayMode === 'day' && (
        <div className="field">
          <label>每月几号（1–31）</label>
          <input
            type="number"
            min={1}
            max={31}
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
          />
        </div>
      )}
      <label className="switch-row" style={{ marginBottom: 14 }}>
        <span style={{ fontSize: '0.9rem' }}>启用（参与本周期自动生成）</span>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
      </label>
      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => {
          const n = Number(amount)
          if (!name.trim()) return alert('请填写名称')
          if (!n || n <= 0) return alert('请输入有效金额')
          let day: number | null = null
          if (dayMode === 'day') {
            const d = Number(dayOfMonth)
            if (!Number.isFinite(d) || d < 1 || d > 31) return alert('入账日请填 1–31')
            day = Math.trunc(d)
          }
          onSave({
            name: name.trim(),
            type,
            amount: n,
            categoryId,
            accountId,
            dayOfMonth: day,
            enabled,
          })
        }}
      >
        保存
      </button>
    </Modal>
  )
}
