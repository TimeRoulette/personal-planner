interface Props {
  value: number
  warnAt?: number
  dangerAt?: number
}

export function ProgressBar({ value, warnAt = 80, dangerAt = 100 }: Props) {
  const v = Math.max(0, Math.min(100, value))
  let cls = 'progress'
  if (v >= dangerAt) cls += ' danger'
  else if (v >= warnAt) cls += ' warn'
  return (
    <div className={cls} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${v}%` }} />
    </div>
  )
}
