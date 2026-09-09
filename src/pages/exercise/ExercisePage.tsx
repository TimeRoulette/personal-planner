import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { db } from '../../db/database'
import { useLiveQuery } from '../../hooks/useLiveQuery'
import { Modal } from '../../components/Modal'
import { EmptyState } from '../../components/EmptyState'
import { ProgressBar } from '../../components/ProgressBar'
import { Toast } from '../../components/Toast'
import { EXERCISE_TYPES, WEEKDAY_LABELS } from '../../utils/defaults'
import { useSettings } from '../../hooks/useSettings'
import {
  PERIOD_LABELS,
  PERIOD_OPTIONS,
  computeVolumeProgress,
  computeWeightProgress,
  formatPeriodRangeLabel,
  normalizeExerciseGoal,
} from '../../utils/goalProgress'
import { nid, nowISO, todayStr } from '../../utils/id'
import type {
  BodyWeight,
  ExerciseGoal,
  ExerciseGoalKind,
  ExerciseType,
  ExerciseVolumeMetric,
  GoalPeriod,
  Workout,
} from '../../types'

type Tab = 'overview' | 'log' | 'plan' | 'body' | 'goals'

function allTypes(extra: string[], workouts: Workout[]): string[] {
  const fromLogs = workouts.map((w) => w.type)
  const set = new Set<string>([...EXERCISE_TYPES, ...extra.filter(Boolean), ...fromLogs])
  return [...set]
}

export function ExercisePage() {
  const { settings } = useSettings()
  const [tab, setTab] = useState<Tab>('overview')
  const [toast, setToast] = useState<string | null>(null)
  const [showLog, setShowLog] = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [customType, setCustomType] = useState('')

  const workouts = useLiveQuery(() => db.workouts.orderBy('date').reverse().toArray(), [], []) ?? []
  const weeklyPlan = useLiveQuery(() => db.weeklyPlan.toArray(), [], []) ?? []
  const bodyWeights = useLiveQuery(() => db.bodyWeights.orderBy('date').toArray(), [], []) ?? []
  const goals = useLiveQuery(() => db.exerciseGoals.toArray(), [], []) ?? []

  const weekStart = useMemo(() => {
    const d = new Date()
    const day = d.getDay()
    const mondayOffset = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + mondayOffset)
    d.setHours(0, 0, 0, 0)
    return d
  }, [])

  const weekWorkouts = useMemo(() => {
    const start = weekStart.toISOString().slice(0, 10)
    return workouts.filter((w) => w.date >= start)
  }, [workouts, weekStart])

  const weekDuration = weekWorkouts.reduce((s, w) => s + w.duration, 0)
  const weekCheckins = new Set(weekWorkouts.map((w) => w.date)).size

  const streak = useMemo(() => {
    const days = new Set(workouts.map((w) => w.date))
    let s = 0
    const d = new Date()
    for (;;) {
      const key = d.toISOString().slice(0, 10)
      if (days.has(key)) {
        s++
        d.setDate(d.getDate() - 1)
      } else {
        if (s === 0 && key === todayStr()) {
          d.setDate(d.getDate() - 1)
          continue
        }
        break
      }
    }
    return s
  }, [workouts])

  const planCompletion = useMemo(() => {
    const active = weeklyPlan.filter((p) => !p.isRest)
    if (active.length === 0) return 0
    let done = 0
    for (const p of active) {
      const hasDay = weekWorkouts.some((w) => new Date(w.date + 'T00:00:00').getDay() === p.weekday)
      if (hasDay) done++
    }
    return (done / active.length) * 100
  }, [weeklyPlan, weekWorkouts])

  const filtered = useMemo(() => {
    if (!typeFilter) return workouts
    return workouts.filter((w) => w.type === typeFilter)
  }, [workouts, typeFilter])

  const heatmap = useMemo(() => {
    const cells: { date: string; count: number }[] = []
    const map = new Map<string, number>()
    for (const w of workouts) map.set(w.date, (map.get(w.date) || 0) + 1)
    for (let i = 27; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      cells.push({ date: key, count: map.get(key) || 0 })
    }
    return cells
  }, [workouts])

  const typeList = useMemo(() => allTypes([customType], workouts), [customType, workouts])

  async function saveWorkout(data: Omit<Workout, 'id' | 'createdAt'>) {
    await db.workouts.add({ ...data, id: nid(), createdAt: nowISO() })
    setShowLog(false)
    setToast('训练已记录（相关目标进度已自动更新）')
  }

  async function savePlanItem(weekday: number, type: string, duration: number, isRest: boolean) {
    const existing = weeklyPlan.find((p) => p.weekday === weekday)
    if (existing) {
      await db.weeklyPlan.update(existing.id, { type, plannedDuration: duration, isRest })
    } else {
      await db.weeklyPlan.add({
        id: nid(),
        weekday,
        type,
        plannedDuration: duration,
        isRest,
      })
    }
    setToast('周计划已更新')
  }

  async function addWeight(weight: number, date: string, note: string) {
    await db.bodyWeights.add({ id: nid(), weight, date, note })
    setToast('体重已记录（体重目标进度已自动更新）')
  }

  async function addExerciseGoal(goal: Omit<ExerciseGoal, 'id' | 'createdAt'>) {
    await db.exerciseGoals.add({ ...goal, id: nid(), createdAt: nowISO() })
    setToast('目标已添加')
  }

  async function deleteExerciseGoal(id: string) {
    if (!confirm('删除该锻炼目标？')) return
    await db.exerciseGoals.delete(id)
    setToast('目标已删除')
  }

  return (
    <div>
      <h1 className="page-title">锻炼</h1>
      <div className="tabs-seg">
        {(
          [
            ['overview', '总览'],
            ['log', '记录'],
            ['plan', '计划'],
            ['body', '身体'],
            ['goals', '目标'],
          ] as const
        ).map(([k, l]) => (
          <button key={k} type="button" className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="stat-grid">
            <div className="stat">
              <div className="label">本周打卡</div>
              <div className="value">{weekCheckins} 天</div>
            </div>
            <div className="stat">
              <div className="label">本周时长</div>
              <div className="value">{weekDuration} 分</div>
            </div>
            <div className="stat">
              <div className="label">连续天数</div>
              <div className="value">{streak} 🔥</div>
            </div>
            <div className="stat">
              <div className="label">计划完成</div>
              <div className="value">{planCompletion.toFixed(0)}%</div>
            </div>
          </div>

          {goals.length > 0 && (
            <div className="card" style={{ marginTop: 12 }}>
              <div className="card-title">目标进度（由记录自动汇总）</div>
              {goals.map((raw) => {
                const g = normalizeExerciseGoal(raw)
                if (g.kind === 'weight') {
                  const p = computeWeightProgress(g, bodyWeights)
                  return (
                    <div key={g.id} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span>
                          {g.title}
                          <span className="badge muted" style={{ marginLeft: 6 }}>
                            体重
                          </span>
                        </span>
                        <span>{Math.min(100, Math.max(0, p.pct)).toFixed(0)}%</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                        {p.current != null ? `${p.current} kg` : '暂无体重'} → 目标 {p.target} kg
                        {p.start ? `（起始 ${p.start} kg）` : ''}
                      </div>
                      <ProgressBar value={p.pct} warnAt={100} dangerAt={101} />
                    </div>
                  )
                }
                const p = computeVolumeProgress(g, workouts, settings.cycleStartDay)
                return (
                  <div key={g.id} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span>
                        {g.title}
                        <span className="badge muted" style={{ marginLeft: 6 }}>
                          {g.workoutType || '全部'} · {PERIOD_LABELS[g.period]}
                        </span>
                      </span>
                      <span>{Math.min(100, p.pct).toFixed(0)}%</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                      {g.metric === 'distance'
                        ? `${p.current.toFixed(1)} / ${p.target} ${g.unit}`
                        : `${p.current} / ${p.target} ${g.unit}`}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                      {formatPeriodRangeLabel(p.range)}
                    </div>
                    <ProgressBar value={p.pct} warnAt={100} dangerAt={101} />
                  </div>
                )
              })}
            </div>
          )}

          <div className="card">
            <div className="card-title">近 4 周活动热力图</div>
            <div className="heatmap">
              {heatmap.map((c) => {
                const level =
                  c.count === 0 ? '' : c.count === 1 ? 'l1' : c.count === 2 ? 'l2' : c.count === 3 ? 'l3' : 'l4'
                return <div key={c.date} className={`cell ${level}`} title={`${c.date}: ${c.count} 次`} />
              })}
            </div>
          </div>

          <button type="button" className="btn btn-primary btn-block" onClick={() => setShowLog(true)}>
            ＋ 记录训练
          </button>
        </>
      )}

      {tab === 'log' && (
        <>
          <div className="chip-row" style={{ marginBottom: 12, maxHeight: 120, overflowY: 'auto' }}>
            <button type="button" className={`chip ${!typeFilter ? 'active' : ''}`} onClick={() => setTypeFilter('')}>
              全部
            </button>
            {typeList.map((t) => (
              <button
                key={t}
                type="button"
                className={`chip ${typeFilter === t ? 'active' : ''}`}
                onClick={() => setTypeFilter(t)}
              >
                {t}
              </button>
            ))}
          </div>
          {filtered.length === 0 ? (
            <EmptyState
              icon="🏃"
              title="暂无训练记录"
              action={{ label: '记录一次', onClick: () => setShowLog(true) }}
            />
          ) : (
            <div className="card">
              {filtered.map((w) => (
                <div key={w.id} className="list-item">
                  <div className="meta">
                    <div className="title">
                      {w.type} · {w.duration} 分钟
                    </div>
                    <div className="sub">
                      {w.date}
                      {w.distance ? ` · ${w.distance} km` : ''}
                      {w.sets ? ` · ${w.sets}组×${w.reps || '?'}` : ''}
                      {w.note ? ` · ${w.note}` : ''}
                    </div>
                  </div>
                  <div className="trailing" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    强度 {w.intensity}/5
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'plan' && (
        <div className="card">
          <div className="card-title">每周计划模板</div>
          {[0, 1, 2, 3, 4, 5, 6].map((wd) => {
            const item = weeklyPlan.find((p) => p.weekday === wd)
            return (
              <PlanRow
                key={wd}
                weekday={wd}
                item={item}
                types={typeList}
                onSave={savePlanItem}
              />
            )
          })}
          <div className="field" style={{ marginTop: 8 }}>
            <label>自定义运动类型（加入选择器）</label>
            <input value={customType} onChange={(e) => setCustomType(e.target.value)} placeholder="例如：皮划艇" />
          </div>
        </div>
      )}

      {tab === 'body' && (
        <>
          <div className="card">
            <div className="card-title">体重趋势</div>
            {bodyWeights.length === 0 ? (
              <EmptyState icon="⚖️" title="暂无体重记录" />
            ) : (
              <div style={{ width: '100%', height: 200 }}>
                <ResponsiveContainer>
                  <LineChart data={bodyWeights.map((b) => ({ date: b.date.slice(5), weight: b.weight }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10 }} width={40} />
                    <Tooltip />
                    <Line type="monotone" dataKey="weight" name="体重 kg" stroke="#0f766e" strokeWidth={2} dot />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
          <WeightForm onSave={addWeight} />
        </>
      )}

      {tab === 'goals' && (
        <GoalsPanel
          goals={goals}
          workouts={workouts}
          bodyWeights={bodyWeights}
          types={typeList}
          latestWeight={bodyWeights.length ? bodyWeights[bodyWeights.length - 1]!.weight : undefined}
          cycleStartDay={settings.cycleStartDay}
          onAdd={addExerciseGoal}
          onDelete={deleteExerciseGoal}
        />
      )}

      <button type="button" className="fab" aria-label="记录训练" onClick={() => setShowLog(true)}>
        ＋
      </button>

      <WorkoutForm
        open={showLog}
        onClose={() => setShowLog(false)}
        onSave={saveWorkout}
        types={typeList}
      />
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  )
}

function GoalsPanel({
  goals,
  workouts,
  bodyWeights,
  types,
  latestWeight,
  cycleStartDay,
  onAdd,
  onDelete,
}: {
  goals: ExerciseGoal[]
  workouts: Workout[]
  bodyWeights: BodyWeight[]
  types: string[]
  latestWeight?: number
  cycleStartDay: number
  onAdd: (g: Omit<ExerciseGoal, 'id' | 'createdAt'>) => void
  onDelete: (id: string) => void
}) {
  const [kind, setKind] = useState<ExerciseGoalKind>('volume')
  const [title, setTitle] = useState('')
  const [workoutType, setWorkoutType] = useState(types[0] || '跑步')
  const [metric, setMetric] = useState<ExerciseVolumeMetric>('distance')
  const [target, setTarget] = useState('10')
  const [period, setPeriod] = useState<GoalPeriod>('month')
  const [startWeight, setStartWeight] = useState(latestWeight != null ? String(latestWeight) : '')

  function autoTitle() {
    if (kind === 'weight') return `体重目标 ${target} kg`
    const unit = metric === 'distance' ? '公里' : metric === 'duration' ? '分钟' : '次'
    const p = PERIOD_OPTIONS.find((x) => x.value === period)?.label || ''
    return `${p}${workoutType} ${target} ${unit}`
  }

  return (
    <>
      <div className="card">
        <div className="card-title">当前目标</div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 0 }}>
          进度不手动填写：记录对应类型训练或体重后，总览会自动汇总。
        </p>
        {goals.length === 0 ? (
          <EmptyState icon="🎯" title="暂无锻炼目标" />
        ) : (
          goals.map((raw) => {
            const g = normalizeExerciseGoal(raw)
            if (g.kind === 'weight') {
              const p = computeWeightProgress(g, bodyWeights)
              return (
                <div key={g.id} className="list-item">
                  <div className="meta">
                    <div className="title">{g.title}</div>
                    <div className="sub">
                      体重 · {p.current != null ? `${p.current}` : '—'} → {p.target} kg ·{' '}
                      {Math.min(100, Math.max(0, p.pct)).toFixed(0)}%
                    </div>
                    <ProgressBar value={p.pct} warnAt={100} dangerAt={101} />
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => onDelete(g.id)}>
                    删除
                  </button>
                </div>
              )
            }
            const p = computeVolumeProgress(g, workouts, cycleStartDay)
            return (
              <div key={g.id} className="list-item">
                <div className="meta">
                  <div className="title">{g.title}</div>
                  <div className="sub">
                    {g.workoutType || '全部'} · {PERIOD_LABELS[g.period]} ·{' '}
                    {g.metric === 'distance' ? `${p.current.toFixed(1)}` : p.current} / {p.target} {g.unit}
                    {' · '}
                    {formatPeriodRangeLabel(p.range)}
                  </div>
                  <ProgressBar value={p.pct} warnAt={100} dangerAt={101} />
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
        <div className="card-title">新建目标</div>
        <div className="tabs-seg">
          <button type="button" className={kind === 'volume' ? 'active' : ''} onClick={() => setKind('volume')}>
            运动量
          </button>
          <button type="button" className={kind === 'weight' ? 'active' : ''} onClick={() => setKind('weight')}>
            体重
          </button>
        </div>

        {kind === 'volume' ? (
          <>
            <div className="field">
              <label>运动类型</label>
              <select value={workoutType} onChange={(e) => setWorkoutType(e.target.value)}>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>指标</label>
              <select value={metric} onChange={(e) => setMetric(e.target.value as ExerciseVolumeMetric)}>
                <option value="distance">距离 km</option>
                <option value="duration">时长 分钟</option>
                <option value="count">次数（会话）</option>
              </select>
            </div>
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
          </>
        ) : (
          <div className="field">
            <label>起始体重 kg（可选，默认取当前最新）</label>
            <input type="number" value={startWeight} onChange={(e) => setStartWeight(e.target.value)} />
          </div>
        )}

        <div className="field">
          <label>{kind === 'weight' ? '目标体重 kg' : '目标值'}</label>
          <input type="number" value={target} onChange={(e) => setTarget(e.target.value)} />
        </div>
        <div className="field">
          <label>标题（可改）</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={autoTitle()}
          />
        </div>
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => {
            const t = Number(target)
            if (!t || t <= 0) return alert('请输入有效目标值')
            if (kind === 'volume') {
              if (!workoutType) return alert('请选择运动类型')
              onAdd({
                title: title.trim() || autoTitle(),
                kind: 'volume',
                workoutType,
                metric,
                target: t,
                period,
                unit: metric === 'distance' ? 'km' : metric === 'duration' ? '分钟' : '次',
              })
            } else {
              const sw = startWeight ? Number(startWeight) : latestWeight
              onAdd({
                title: title.trim() || autoTitle(),
                kind: 'weight',
                metric: 'weight',
                target: t,
                period: 'year',
                unit: 'kg',
                startWeight: sw,
              })
            }
            setTitle('')
          }}
        >
          添加目标
        </button>
      </div>
    </>
  )
}

function WorkoutForm({
  open,
  onClose,
  onSave,
  types,
}: {
  open: boolean
  onClose: () => void
  onSave: (data: Omit<Workout, 'id' | 'createdAt'>) => void
  types: string[]
}) {
  const [type, setType] = useState<ExerciseType>(types[0] || '跑步')
  const [duration, setDuration] = useState('30')
  const [distance, setDistance] = useState('')
  const [sets, setSets] = useState('')
  const [reps, setReps] = useState('')
  const [weight, setWeight] = useState('')
  const [intensity, setIntensity] = useState(3)
  const [feeling, setFeeling] = useState(4)
  const [note, setNote] = useState('')
  const [date, setDate] = useState(todayStr())
  const [custom, setCustom] = useState('')

  const options = custom.trim() && !types.includes(custom.trim()) ? [...types, custom.trim()] : types

  return (
    <Modal open={open} title="记录训练" onClose={onClose}>
      <div className="field">
        <label>类型</label>
        <select
          value={options.includes(type) ? type : options[0]}
          onChange={(e) => setType(e.target.value)}
        >
          {options.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>自定义类型（可选）</label>
        <input
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value)
            if (e.target.value.trim()) setType(e.target.value.trim())
          }}
          placeholder="不在列表中则填写"
        />
      </div>
      <div className="field">
        <label>时长（分钟）</label>
        <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
      </div>
      <div className="field">
        <label>距离（公里，可选）</label>
        <input type="number" value={distance} onChange={(e) => setDistance(e.target.value)} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div className="field">
          <label>组数</label>
          <input type="number" value={sets} onChange={(e) => setSets(e.target.value)} />
        </div>
        <div className="field">
          <label>次数</label>
          <input type="number" value={reps} onChange={(e) => setReps(e.target.value)} />
        </div>
        <div className="field">
          <label>重量 kg</label>
          <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>强度 {intensity}/5</label>
        <input type="range" min={1} max={5} value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} />
      </div>
      <div className="field">
        <label>感受 {feeling}/5</label>
        <input type="range" min={1} max={5} value={feeling} onChange={(e) => setFeeling(Number(e.target.value))} />
      </div>
      <div className="field">
        <label>日期</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="field">
        <label>备注</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => {
          const d = Number(duration)
          if (!d || d <= 0) return alert('请输入时长')
          onSave({
            type: custom.trim() || type,
            duration: d,
            distance: distance ? Number(distance) : undefined,
            sets: sets ? Number(sets) : undefined,
            reps: reps ? Number(reps) : undefined,
            weight: weight ? Number(weight) : undefined,
            intensity,
            feeling,
            note,
            date,
          })
        }}
      >
        保存
      </button>
    </Modal>
  )
}

function PlanRow({
  weekday,
  item,
  types,
  onSave,
}: {
  weekday: number
  item?: { type: string; plannedDuration: number; isRest: boolean }
  types: string[]
  onSave: (weekday: number, type: string, duration: number, isRest: boolean) => void
}) {
  const [type, setType] = useState(item?.isRest ? '休息' : item?.type || '跑步')
  const [duration, setDuration] = useState(String(item?.plannedDuration ?? 30))
  const list = ['休息', ...types]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 72px 56px', gap: 6, alignItems: 'center', marginBottom: 8 }}>
      <strong>周{WEEKDAY_LABELS[weekday]}</strong>
      <select
        value={list.includes(type) ? type : type}
        onChange={(e) => setType(e.target.value)}
        style={{ minHeight: 40, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)' }}
      >
        {!list.includes(type) && type !== '休息' && (
          <option value={type}>{type}</option>
        )}
        {list.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <input
        type="number"
        value={duration}
        onChange={(e) => setDuration(e.target.value)}
        disabled={type === '休息'}
        style={{ minHeight: 40, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg)', padding: '0 6px' }}
      />
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => onSave(weekday, type, Number(duration) || 0, type === '休息')}
      >
        存
      </button>
    </div>
  )
}

function WeightForm({ onSave }: { onSave: (w: number, date: string, note: string) => void }) {
  const [weight, setWeight] = useState('')
  const [date, setDate] = useState(todayStr())
  const [note, setNote] = useState('')
  return (
    <div className="card">
      <div className="card-title">记录体重</div>
      <div className="field">
        <label>体重 kg</label>
        <input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
      </div>
      <div className="field">
        <label>日期</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="field">
        <label>备注</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => {
          const w = Number(weight)
          if (!w) return alert('请输入体重')
          onSave(w, date, note)
          setWeight('')
        }}
      >
        保存
      </button>
    </div>
  )
}
