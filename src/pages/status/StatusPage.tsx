import { useMemo, useRef, useState } from 'react'
import { EmotionBallView, type BallPlayResult, type EmotionBallHandle } from '../../components/EmotionBallView'
import { Toast } from '../../components/Toast'
import { db } from '../../db/database'
import { useLiveQuery } from '../../hooks/useLiveQuery'
import { useSettings } from '../../hooks/useSettings'
import { DEFAULT_DAILY_KCAL_BUDGET, DEFAULT_DAILY_WATER_ML } from '../../utils/defaults'
import { buildEnergySnapshot } from '../../utils/energyEmotion'
import {
  compositeEmotion,
  dietDomain,
  exerciseDomain,
  goalsDomain,
  savingsDomain,
  waterDomain,
  type DomainBar,
  type StatusDomain,
} from '../../utils/statusEmotions'
import {
  computeSavingsProgress,
  formatPeriodRangeLabel,
  getPeriodRange,
} from '../../utils/goalProgress'
import { nid, nowISO, todayStr } from '../../utils/id'

type GroupKey = 'body' | 'money' | 'growth'

const GROUPS: { key: GroupKey; title: string; domains: StatusDomain[] }[] = [
  { key: 'body', title: '身体能量', domains: ['diet', 'exercise', 'water'] },
  { key: 'money', title: '财务节奏', domains: ['savings'] },
  { key: 'growth', title: '成长目标', domains: ['goals'] },
]

export function StatusPage() {
  const { settings, updateSettings } = useSettings()
  const ballRef = useRef<EmotionBallHandle>(null)
  const [focus, setFocus] = useState<StatusDomain>('composite')
  const [openGroup, setOpenGroup] = useState<Record<GroupKey, boolean>>({
    body: false,
    money: false,
    growth: false,
  })
  const [toast, setToast] = useState<string | null>(null)
  const [ballTip, setBallTip] = useState<string | null>(null)
  const tipHide = useRef<number | null>(null)

  function showBallTip(msg: string) {
    setBallTip(msg)
    if (tipHide.current) window.clearTimeout(tipHide.current)
    tipHide.current = window.setTimeout(() => setBallTip(null), 2200)
  }

  function onBallInteract(result?: BallPlayResult) {
    const kindLabel: Record<string, string> = {
      spin: '自旋',
      ribbons: '彩带',
      blink: '眨眼',
      bounce: '弹跳',
      flash: '表情闪换',
      tip: '小提示',
      combo: '连击',
      peek: '偷看',
      tour: '巡回',
    }
    const tip = result?.tip || '元气球嗨起来了～'
    showBallTip(tip)
    if (result?.kind) setToast(`互动：${kindLabel[result.kind] || result.kind}`)
  }
  const [waterDraft, setWaterDraft] = useState('')
  const today = todayStr()

  const foodLogs = useLiveQuery(() => db.foodLogs.where('date').equals(today).toArray(), [today], []) ?? []
  const workouts = useLiveQuery(() => db.workouts.where('date').equals(today).toArray(), [today], []) ?? []
  const allWorkouts = useLiveQuery(() => db.workouts.toArray(), [], []) ?? []
  const waterLogs = useLiveQuery(() => db.waterLogs.where('date').equals(today).toArray(), [today], []) ?? []
  const txs = useLiveQuery(() => db.transactions.toArray(), [], []) ?? []
  const savingsGoals = useLiveQuery(() => db.savingsGoals.toArray(), [], []) ?? []
  const budgets = useLiveQuery(() => db.budgets.toArray(), [], []) ?? []
  const skillGoals = useLiveQuery(() => db.skillGoals.toArray(), [], []) ?? []

  const budget = settings.dailyKcalBudget > 0 ? settings.dailyKcalBudget : DEFAULT_DAILY_KCAL_BUDGET
  const waterGoal = settings.dailyWaterGoalMl > 0 ? settings.dailyWaterGoalMl : DEFAULT_DAILY_WATER_ML

  const intake = foodLogs.reduce((s, f) => s + (f.kcal || 0), 0)
  const burn = workouts.reduce((s, w) => s + (w.caloriesBurned || 0), 0)
  const hadGoodWorkout = workouts.some((w) => (w.caloriesBurned ?? 0) >= 200 || w.duration >= 30)
  const waterMl = waterLogs.reduce((s, w) => s + w.ml, 0)

  const energySnap = useMemo(
    () => buildEnergySnapshot({ intake, burn, budget, hadGoodWorkout }),
    [intake, burn, budget, hadGoodWorkout],
  )

  const weekCheckins = useMemo(() => {
    const d = new Date()
    const day = d.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + mondayOffset)
    d.setHours(0, 0, 0, 0)
    const start = d.toISOString().slice(0, 10)
    return new Set(allWorkouts.filter((w) => w.date >= start).map((w) => w.date)).size
  }, [allWorkouts])

  const savingsBar = useMemo(() => {
    const range = getPeriodRange('month', new Date(), settings.cycleStartDay)
    const inRange = txs.filter((t) => t.date >= range.start && t.date <= range.end)
    const income = inRange.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = inRange.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    const net = income - expense
    const goal = savingsGoals[0]
    let target = 0
    if (goal) {
      const p = computeSavingsProgress(goal, txs, settings.cycleStartDay)
      target = goal.targetAmount
      return savingsDomain({ net: p.net, target, expense, budget: 0 })
    }
    const ym = today.slice(0, 7)
    const b = budgets.find((x) => x.yearMonth === ym)
    return savingsDomain({
      net,
      target: 0,
      expense,
      budget: b?.totalBudget ?? 0,
    })
  }, [txs, savingsGoals, budgets, settings.cycleStartDay, today])

  const goalsBar = useMemo(() => {
    const active = skillGoals.filter((g) => g.status === 'active')
    if (active.length === 0) return goalsDomain({ avgPct: 0, activeCount: 0 })
    const avg =
      active.reduce((s, g) => {
        const pct = g.targetQuantity > 0 ? (g.currentAmount / g.targetQuantity) * 100 : 0
        return s + Math.min(150, Math.max(0, pct))
      }, 0) / active.length
    return goalsDomain({ avgPct: avg, activeCount: active.length })
  }, [skillGoals])

  const bars: DomainBar[] = useMemo(() => {
    const list = [
      dietDomain(energySnap),
      exerciseDomain({
        todayBurn: burn,
        weekCheckins,
        hadGoodWorkout,
      }),
      savingsBar,
      waterDomain(waterMl, waterGoal),
      goalsBar,
    ]
    return list
  }, [energySnap, burn, weekCheckins, hadGoodWorkout, savingsBar, waterMl, waterGoal, goalsBar])

  const compositeId = useMemo(() => compositeEmotion(bars), [bars])
  const activeEmotion =
    focus === 'composite' ? compositeId : bars.find((b) => b.id === focus)?.emotionId || compositeId
  const focusLabel =
    focus === 'composite' ? '综合状态' : bars.find((b) => b.id === focus)?.title || '综合'

  async function addWater(ml: number) {
    if (!ml || ml <= 0) return
    await db.waterLogs.add({
      id: nid(),
      date: today,
      ml: Math.round(ml),
      createdAt: nowISO(),
    })
    setToast(`+${Math.round(ml)} ml 饮水`)
    setFocus('water')
  }

  const periodHint = formatPeriodRangeLabel(getPeriodRange('month', new Date(), settings.cycleStartDay))

  return (
    <div className="status-page">
      <h1 className="page-title">元气球</h1>
      <p className="status-sub">丰富点球互动 · 点状态条切换表情 · 分组默认折叠</p>

      <div className="status-sticky">
        <div className="status-ball-wrap">
          <EmotionBallView
            ref={ballRef}
            emotionId={activeEmotion}
            size={200}
            interactive
            playful
            label={`元气球：${focusLabel}`}
            onInteract={onBallInteract}
            onTip={showBallTip}
          />
          {ballTip && <div className="status-ball-tip" role="status">{ballTip}</div>}
          <p className="status-ball-hint">点我玩：自旋 / 彩带 / 眨眼 / 弹跳 / 表情闪 / 提示 / 偷看 / 连击 / 巡回 · 连点触发 Combo</p>
        </div>
        <div className="status-sticky__meta">
          <div className="status-sticky__title">{focusLabel}</div>
          <div className="status-sticky__hint">
            {focus === 'composite' ? energySnap.labelZh : bars.find((b) => b.id === focus)?.detail}
          </div>
          {focus !== 'composite' && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFocus('composite')}>
              回到综合
            </button>
          )}
        </div>
      </div>

      <div className="status-scroll">
        {GROUPS.map((g) => {
          const open = openGroup[g.key]
          const groupBars = bars.filter((b) => g.domains.includes(b.id))
          return (
            <div key={g.key} className="card accordion-card status-group">
              <button
                type="button"
                className="accordion-header"
                aria-expanded={open}
                onClick={() => setOpenGroup((s) => ({ ...s, [g.key]: !s[g.key] }))}
              >
                <span>{g.title}</span>
                <span className="chevron">{open ? '▼' : '▶'}</span>
              </button>
              {open && (
                <div className="accordion-body">
                  {groupBars.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      className={`status-bar status-bar--${b.tone} ${focus === b.id ? 'active' : ''}`}
                      onClick={() => {
                        setFocus(b.id)
                        ballRef.current?.setEmotion(b.emotionId)
                      }}
                    >
                      <div className="status-bar__head">
                        <strong>{b.title}</strong>
                        <span>{Math.round(Math.min(999, b.pct))}%</span>
                      </div>
                      <div className="status-bar__track">
                        <div
                          className="status-bar__fill"
                          style={{ width: `${Math.min(100, Math.max(4, b.pct))}%` }}
                        />
                      </div>
                      <div className="status-bar__detail">{b.detail}</div>
                    </button>
                  ))}

                  {g.key === 'body' && (
                    <div className="status-water">
                      <div className="chip-row" style={{ marginBottom: 8 }}>
                        {[200, 300, 500].map((ml) => (
                          <button key={ml} type="button" className="chip" onClick={() => void addWater(ml)}>
                            +{ml}ml
                          </button>
                        ))}
                      </div>
                      <div className="row-actions" style={{ gap: 8 }}>
                        <input
                          type="number"
                          inputMode="numeric"
                          placeholder="自定义 ml"
                          value={waterDraft}
                          onChange={(e) => setWaterDraft(e.target.value)}
                          style={{ flex: 1, minHeight: 40, borderRadius: 10, border: '1px solid var(--border)', padding: '0 10px', background: 'var(--bg)' }}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => {
                            const n = Number(waterDraft)
                            if (!n) return alert('请输入毫升')
                            void addWater(n)
                            setWaterDraft('')
                          }}
                        >
                          记饮水
                        </button>
                      </div>
                      <div className="field" style={{ marginTop: 10, marginBottom: 0 }}>
                        <label>每日饮水目标 ml</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={waterGoal}
                          onChange={(e) => {
                            const n = Number(e.target.value)
                            void updateSettings({
                              dailyWaterGoalMl: !n || n <= 0 ? DEFAULT_DAILY_WATER_ML : Math.round(n),
                            })
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {g.key === 'money' && (
                    <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      储蓄周期：{periodHint}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}

        <p className="status-foot">
          Emotion Ball 署名见 public/emotion-ball/ATTRIBUTION.md · 综合表情默认跟随整体表现
        </p>
      </div>

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  )
}
