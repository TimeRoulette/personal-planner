import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { todayStr } from '../utils/id'

export interface DateGroupItem {
  id: string
  date: string
}

interface Props<T extends DateGroupItem> {
  items: T[]
  /** 今天默认展开，其余默认折叠 */
  defaultExpandToday?: boolean
  renderItem: (item: T) => ReactNode
  empty?: ReactNode
}

function formatHeader(date: string, count: number): string {
  const today = todayStr()
  const d = new Date(date + 'T00:00:00')
  const yd = new Date(today + 'T00:00:00')
  yd.setDate(yd.getDate() - 1)
  const yest = `${yd.getFullYear()}-${String(yd.getMonth() + 1).padStart(2, '0')}-${String(yd.getDate()).padStart(2, '0')}`
  let label = date
  if (date === today) label = `今天 · ${date}`
  else if (date === yest) label = `昨天 · ${date}`
  else {
    const w = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
    label = `${date} 周${w}`
  }
  return `${label}（${count}）`
}

export function DateGroupedList<T extends DateGroupItem>({
  items,
  defaultExpandToday = true,
  renderItem,
  empty,
}: Props<T>) {
  const groups = useMemo(() => {
    const map = new Map<string, T[]>()
    for (const it of items) {
      const key = it.date || '未知'
      const arr = map.get(key)
      if (arr) arr.push(it)
      else map.set(key, [it])
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [items])

  const today = todayStr()
  const [open, setOpen] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setOpen((prev) => {
      const next = { ...prev }
      let changed = false
      for (const [date] of groups) {
        if (!(date in next)) {
          next[date] = defaultExpandToday && date === today
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [groups, today, defaultExpandToday])

  if (items.length === 0) return <>{empty ?? null}</>

  return (
    <div className="date-groups">
      {groups.map(([date, list]) => {
        const expanded = !!open[date]
        return (
          <div key={date} className="date-group card">
            <button
              type="button"
              className="date-group-header"
              aria-expanded={expanded}
              onClick={() => setOpen((p) => ({ ...p, [date]: !p[date] }))}
            >
              <span className="date-group-chevron" aria-hidden>
                {expanded ? '▼' : '▶'}
              </span>
              <span className="date-group-title">{formatHeader(date, list.length)}</span>
            </button>
            {expanded && (
              <div className="date-group-body">
                {list.map((it) => (
                  <div key={it.id}>{renderItem(it)}</div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
