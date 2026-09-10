import { useEffect, useMemo, useRef, useState } from 'react'
import { EmotionBallView, type EmotionBallHandle } from '../EmotionBallView'
import { ProgressBar } from '../ProgressBar'
import { Modal } from '../Modal'
import {
  APPROACH_RATIO,
  TOO_LOW_RATIO,
  LOW_REMIND_HOUR,
  buildEnergySnapshot,
  type DailyEnergySnapshot,
} from '../../utils/energyEmotion'
import { useSettings } from '../../hooks/useSettings'
import { db } from '../../db/database'
import { useLiveQuery } from '../../hooks/useLiveQuery'
import { todayStr } from '../../utils/id'
import { DEFAULT_DAILY_KCAL_BUDGET } from '../../utils/defaults'

interface Props {
  /** 紧凑模式用于嵌在总览 */
  compact?: boolean
  /** 额外标题后缀 */
  title?: string
}

export function DailyEnergyCard({ compact = false, title = '今日能量' }: Props) {
  const { settings, updateSettings } = useSettings()
  const ballRef = useRef<EmotionBallHandle>(null)
  const [editBudget, setEditBudget] = useState(false)
  const [budgetDraft, setBudgetDraft] = useState('')
  const [lowDismissed, setLowDismissed] = useState(false)
  const [showLow, setShowLow] = useState(false)
  const today = todayStr()

  const foodLogs = useLiveQuery(
    () => db.foodLogs.where('date').equals(today).toArray(),
    [today],
    [],
  ) ?? []
  const workouts = useLiveQuery(
    () => db.workouts.where('date').equals(today).toArray(),
    [today],
    [],
  ) ?? []

  const budget = settings.dailyKcalBudget > 0 ? settings.dailyKcalBudget : DEFAULT_DAILY_KCAL_BUDGET

  const intake = useMemo(
    () => foodLogs.reduce((s, f) => s + (f.kcal || 0), 0),
    [foodLogs],
  )
  const burn = useMemo(
    () =>
      workouts.reduce((s, w) => {
        if (w.caloriesBurned != null && w.caloriesBurned > 0) return s + w.caloriesBurned
        return s
      }, 0),
    [workouts],
  )
  const hadGoodWorkout = workouts.some((w) => (w.caloriesBurned ?? 0) >= 200 || w.duration >= 30)

  const snap: DailyEnergySnapshot = useMemo(
    () =>
      buildEnergySnapshot({
        intake,
        burn,
        budget,
        hadGoodWorkout,
      }),
    [intake, burn, budget, hadGoodWorkout],
  )

  useEffect(() => {
    ballRef.current?.setEmotion(snap.emotionId)
  }, [snap.emotionId])

  // 过低强提醒（当天一次会话内可关闭）
  useEffect(() => {
    const hour = new Date().getHours()
    if (
      !lowDismissed &&
      snap.ratio < TOO_LOW_RATIO &&
      hour >= LOW_REMIND_HOUR &&
      snap.budget > 0
    ) {
      setShowLow(true)
    }
  }, [snap.ratio, snap.budget, lowDismissed])

  const pct = Math.min(150, (snap.intake / snap.budget) * 100)

  return (
    <>
      <div className={`card energy-card${compact ? ' energy-card--compact' : ''}`}>
        <div className="energy-card__head">
          <div>
            <div className="card-title" style={{ marginBottom: 4 }}>
              {title}
            </div>
            <div className="energy-card__status">{snap.labelZh}</div>
          </div>
          <EmotionBallView
            ref={ballRef}
            emotionId={snap.emotionId}
            size={compact ? 88 : 112}
            label={`情绪球：${snap.labelZh}`}
          />
        </div>

        <div className="energy-stats">
          <div className="energy-stat">
            <div className="label">摄入</div>
            <div className="value">{Math.round(snap.intake)}</div>
            <div className="unit">kcal</div>
          </div>
          <div className="energy-stat">
            <div className="label">消耗</div>
            <div className="value">{Math.round(snap.burn)}</div>
            <div className="unit">kcal</div>
          </div>
          <div className="energy-stat">
            <div className="label">预算</div>
            <div className="value">{Math.round(snap.budget)}</div>
            <div className="unit">kcal</div>
          </div>
          <div className="energy-stat">
            <div className="label">净摄入</div>
            <div className={`value ${snap.net > snap.budget ? 'negative' : ''}`}>
              {Math.round(snap.net)}
            </div>
            <div className="unit">kcal</div>
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              marginBottom: 6,
            }}
          >
            <span>
              预算进度{' '}
              {pct.toFixed(0)}%
              {snap.ratio >= APPROACH_RATIO && snap.ratio < 1 && ' · 接近上限'}
              {snap.ratio >= 1 && ' · 已超支'}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setBudgetDraft(String(budget))
                setEditBudget(true)
              }}
            >
              改预算
            </button>
          </div>
          <ProgressBar
            value={pct}
            warnAt={APPROACH_RATIO * 100}
            dangerAt={100}
          />
        </div>

        {!compact && (
          <p className="energy-hint">
            饮食流水会记入摄入；锻炼记录估算消耗。超预算再加餐会弹出强提醒。
          </p>
        )}
      </div>

      <Modal open={editBudget} title="每日热量预算" onClose={() => setEditBudget(false)}>
        <div className="field">
          <label>目标 kcal / 天（空则默认 {DEFAULT_DAILY_KCAL_BUDGET}）</label>
          <input
            type="number"
            inputMode="numeric"
            value={budgetDraft}
            onChange={(e) => setBudgetDraft(e.target.value)}
            placeholder={String(DEFAULT_DAILY_KCAL_BUDGET)}
          />
        </div>
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => {
            const n = Number(budgetDraft)
            const next = !budgetDraft.trim() || !n || n <= 0 ? DEFAULT_DAILY_KCAL_BUDGET : Math.round(n)
            void updateSettings({ dailyKcalBudget: next })
            setEditBudget(false)
          }}
        >
          保存
        </button>
      </Modal>

      <Modal
        open={showLow}
        title="摄入偏低提醒"
        onClose={() => {
          setShowLow(false)
          setLowDismissed(true)
        }}
      >
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
          <EmotionBallView emotionId="15" size={96} label="疲惫" />
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            今天摄入约 <strong>{Math.round(snap.intake)}</strong> kcal，不足预算的{' '}
            {Math.round(TOO_LOW_RATIO * 100)}%（预算 {Math.round(snap.budget)}）。
            若非刻意轻断食，建议适当补充营养，避免过低能量。
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => {
            setShowLow(false)
            setLowDismissed(true)
          }}
        >
          知道了
        </button>
      </Modal>
    </>
  )
}

/** 供记账前检查：是否已超预算 */
export async function getTodayIntakeAndBudget(dailyKcalBudget: number): Promise<{
  intake: number
  budget: number
  over: boolean
}> {
  const today = todayStr()
  const logs = await db.foodLogs.where('date').equals(today).toArray()
  const intake = logs.reduce((s, f) => s + (f.kcal || 0), 0)
  const budget = dailyKcalBudget > 0 ? dailyKcalBudget : DEFAULT_DAILY_KCAL_BUDGET
  return { intake, budget, over: intake >= budget }
}
