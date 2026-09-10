import { useEffect, useState } from 'react'
import { formatPeriodRangeLabel, getPeriodRange, normalizeCycleStartDay } from '../utils/goalProgress'

export function CycleStartDayField({
  value,
  onCommit,
  compact,
}: {
  value: number
  onCommit: (day: number) => void
  compact?: boolean
}) {
  const [draft, setDraft] = useState(String(value ?? 1))

  useEffect(() => {
    setDraft(String(value ?? 1))
  }, [value])

  const previewDay = (() => {
    const trimmed = draft.trim()
    if (trimmed === '') return 1
    const n = Number(trimmed)
    if (!Number.isFinite(n)) return 1
    return normalizeCycleStartDay(n)
  })()

  function commit() {
    const trimmed = draft.trim()
    const next =
      trimmed === '' || !Number.isFinite(Number(trimmed))
        ? 1
        : normalizeCycleStartDay(Number(trimmed))
    setDraft(String(next))
    onCommit(next)
  }

  return (
    <div className={compact ? undefined : 'card'}>
      {!compact && <div className="card-title">目标周期</div>}
      <div className="field">
        <label>周期起始日</label>
        <input
          type="number"
          min={1}
          max={31}
          value={draft}
          placeholder="1"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              ;(e.target as HTMLInputElement).blur()
            }
          }}
        />
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 0, lineHeight: 1.55 }}>
        决定储蓄「月 / 季度 / 半年 / 年」目标与固定收支的起止（默认自然月 1 日）。推荐 1–28；29–31
        在短月会钳到月末。周目标仍为周一～周日。
        <br />
        当前预览：{formatPeriodRangeLabel(getPeriodRange('month', new Date(), previewDay))}
      </p>
    </div>
  )
}
