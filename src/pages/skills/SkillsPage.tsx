import { useEffect, useRef, useState } from 'react'
import { db } from '../../db/database'
import { useLiveQuery } from '../../hooks/useLiveQuery'
import { Modal } from '../../components/Modal'
import { EmptyState } from '../../components/EmptyState'
import { ProgressBar } from '../../components/ProgressBar'
import { Toast } from '../../components/Toast'
import { SKILL_TYPES } from '../../utils/defaults'
import { nid, nowISO, todayStr } from '../../utils/id'
import { PACE_LABEL, skillProgress } from '../../utils/skillMath'
import type { Book, SkillGoal, SkillStage, SkillStatus, SkillType } from '../../types'

type Tab = 'goals' | 'books'

export function SkillsPage() {
  const [tab, setTab] = useState<Tab>('goals')
  const [toast, setToast] = useState<string | null>(null)
  const [showGoal, setShowGoal] = useState(false)
  const [editGoal, setEditGoal] = useState<SkillGoal | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [readingBook, setReadingBook] = useState<Book | null>(null)

  const goals =
    useLiveQuery(async () => {
      const rows = await db.skillGoals.toArray()
      return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    }, [], []) ?? []
  const stages = useLiveQuery(() => db.skillStages.toArray(), [], []) ?? []
  const books =
    useLiveQuery(async () => {
      const rows = await db.books.toArray()
      return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    }, [], []) ?? []

  const activeGoals = goals.filter((g) => g.status === 'active' || g.status === 'paused')

  async function saveGoal(data: Omit<SkillGoal, 'id' | 'createdAt' | 'updatedAt'>, stageTitles: string[]) {
    const t = nowISO()
    if (editGoal) {
      await db.skillGoals.update(editGoal.id, { ...data, updatedAt: t })
      setToast('目标已更新')
    } else {
      const id = nid()
      await db.skillGoals.add({ ...data, id, createdAt: t, updatedAt: t })
      if (stageTitles.length) {
        await db.skillStages.bulkAdd(
          stageTitles.map((title, order) => ({
            id: nid(),
            skillGoalId: id,
            title,
            completed: false,
            order,
            note: '',
          })),
        )
      }
      setToast('目标已创建')
    }
    setShowGoal(false)
    setEditGoal(null)
  }

  async function updateProgress(goal: SkillGoal, amount: number) {
    const currentAmount = Math.max(0, amount)
    const status: SkillStatus =
      currentAmount >= goal.targetQuantity ? 'completed' : goal.status === 'completed' ? 'active' : goal.status
    await db.skillGoals.update(goal.id, { currentAmount, status, updatedAt: nowISO() })
    setToast('进度已更新')
  }

  async function setStatus(goal: SkillGoal, status: SkillStatus) {
    await db.skillGoals.update(goal.id, { status, updatedAt: nowISO() })
    setToast(status === 'paused' ? '已暂停' : status === 'archived' ? '已归档' : '已恢复')
  }

  async function toggleStage(stage: SkillStage) {
    await db.skillStages.update(stage.id, { completed: !stage.completed })
  }

  async function importBook(file: File, skillGoalId?: string) {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'txt' && ext !== 'epub') {
      alert('仅支持 TXT / EPUB')
      return
    }
    const t = nowISO()
    if (ext === 'txt') {
      const content = await file.text()
      const book: Book = {
        id: nid(),
        skillGoalId,
        title: file.name.replace(/\.txt$/i, ''),
        fileName: file.name,
        fileType: 'txt',
        content,
        currentPosition: 0,
        totalLength: content.length,
        percent: 0,
        updatedAt: t,
        createdAt: t,
      }
      await db.books.add(book)
      setToast('TXT 已导入')
      setReadingBook(book)
    } else {
      const buf = await file.arrayBuffer()
      const id = nid()
      await db.blobs.put({ id, data: buf, mime: 'application/epub+zip' })
      const book: Book = {
        id,
        skillGoalId,
        title: file.name.replace(/\.epub$/i, ''),
        fileName: file.name,
        fileType: 'epub',
        content: '',
        currentPosition: 0,
        totalLength: 100,
        percent: 0,
        updatedAt: t,
        createdAt: t,
      }
      await db.books.add(book)
      setToast('EPUB 已导入')
      setReadingBook(book)
    }
  }

  async function syncBookProgress(book: Book, position: number, total: number, percent: number) {
    await db.books.update(book.id, {
      currentPosition: position,
      totalLength: total,
      percent,
      updatedAt: nowISO(),
    })
    if (book.skillGoalId) {
      const goal = await db.skillGoals.get(book.skillGoalId)
      if (goal && goal.unit.includes('页')) {
        // map percent to pages
        const pages = Math.round((percent / 100) * goal.targetQuantity)
        await db.skillGoals.update(goal.id, {
          currentAmount: Math.max(goal.currentAmount, pages),
          updatedAt: nowISO(),
          status: pages >= goal.targetQuantity ? 'completed' : goal.status,
        })
      } else if (goal) {
        await db.skillGoals.update(goal.id, {
          currentAmount: Math.max(goal.currentAmount, Math.round((percent / 100) * goal.targetQuantity)),
          updatedAt: nowISO(),
        })
      }
    }
  }

  const detail = goals.find((g) => g.id === detailId)

  return (
    <div>
      <h1 className="page-title">技能</h1>
      <div className="tabs-seg">
        <button type="button" className={tab === 'goals' ? 'active' : ''} onClick={() => setTab('goals')}>
          长期目标
        </button>
        <button type="button" className={tab === 'books' ? 'active' : ''} onClick={() => setTab('books')}>
          阅读器
        </button>
      </div>

      {tab === 'goals' && (
        <>
          {activeGoals.length === 0 ? (
            <EmptyState
              icon="🎯"
              title="还没有技能目标"
              description="创建长期目标，跟踪进度与里程碑"
              action={{
                label: '创建目标',
                onClick: () => {
                  setEditGoal(null)
                  setShowGoal(true)
                },
              }}
            />
          ) : (
            activeGoals.map((g) => {
              const prog = skillProgress(g)
              return (
                <div key={g.id} className="card" onClick={() => setDetailId(g.id)} role="button" tabIndex={0}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong>
                      {g.type} · {g.title}
                    </strong>
                    <span className={`badge ${prog.paceStatus === 'behind' ? 'danger' : prog.paceStatus === 'ahead' ? 'success' : 'muted'}`}>
                      {PACE_LABEL[prog.paceStatus]}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '6px 0' }}>
                    {g.currentAmount} / {g.targetQuantity} {g.unit} · {prog.pct.toFixed(0)}%
                    {prog.eta ? ` · 预计 ${prog.eta}` : ''}
                    {g.status === 'paused' ? ' · 已暂停' : ''}
                  </div>
                  <ProgressBar value={prog.pct} />
                  {g.endDate && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                        日历进度 {prog.calendarPct.toFixed(0)}%
                      </div>
                      <ProgressBar value={prog.calendarPct} warnAt={90} />
                    </div>
                  )}
                </div>
              )
            })
          )}
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => {
              setEditGoal(null)
              setShowGoal(true)
            }}
          >
            ＋ 新建目标
          </button>
        </>
      )}

      {tab === 'books' && (
        <>
          <div className="card">
            <div className="card-title">导入本地书籍（TXT / EPUB）</div>
            <input
              type="file"
              accept=".txt,.epub,text/plain,application/epub+zip"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void importBook(f, activeGoals.find((g) => g.type === '阅读')?.id)
                e.target.value = ''
              }}
            />
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '8px 0 0' }}>
              仅在本地解析，不会上传。导入后可将进度同步到关联的阅读目标。
            </p>
          </div>
          {books.length === 0 ? (
            <EmptyState icon="📚" title="暂无书籍" description="导入 TXT 或 EPUB 开始阅读" />
          ) : (
            <div className="card">
              {books.map((b) => (
                <div key={b.id} className="list-item">
                  <div className="meta" onClick={() => setReadingBook(b)} role="button" tabIndex={0}>
                    <div className="title">
                      {b.fileType.toUpperCase()} · {b.title}
                    </div>
                    <div className="sub">进度 {b.percent.toFixed(0)}%</div>
                  </div>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setReadingBook(b)}>
                    阅读
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <GoalForm
        open={showGoal}
        onClose={() => {
          setShowGoal(false)
          setEditGoal(null)
        }}
        initial={editGoal}
        onSave={saveGoal}
      />

      {detail && (
        <GoalDetail
          goal={detail}
          stages={stages.filter((s) => s.skillGoalId === detail.id).sort((a, b) => a.order - b.order)}
          onClose={() => setDetailId(null)}
          onProgress={updateProgress}
          onStatus={setStatus}
          onToggleStage={toggleStage}
          onEdit={() => {
            setEditGoal(detail)
            setDetailId(null)
            setShowGoal(true)
          }}
          onImport={(file) => importBook(file, detail.id)}
        />
      )}

      {readingBook && (
        <Reader
          book={readingBook}
          onClose={() => setReadingBook(null)}
          onProgress={(pos, total, pct) => syncBookProgress(readingBook, pos, total, pct)}
        />
      )}

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  )
}

function GoalForm({
  open,
  onClose,
  initial,
  onSave,
}: {
  open: boolean
  onClose: () => void
  initial: SkillGoal | null
  onSave: (data: Omit<SkillGoal, 'id' | 'createdAt' | 'updatedAt'>, stages: string[]) => void
}) {
  const [title, setTitle] = useState('')
  const [type, setType] = useState<SkillType>('学习')
  const [startDate, setStartDate] = useState(todayStr())
  const [endDate, setEndDate] = useState('')
  const [targetQuantity, setTargetQuantity] = useState('100')
  const [unit, setUnit] = useState('小时')
  const [expectedPace, setExpectedPace] = useState('1')
  const [notes, setNotes] = useState('')
  const [stagesText, setStagesText] = useState('')

  useEffect(() => {
    if (!open) return
    setTitle(initial?.title ?? '')
    setType(initial?.type ?? '学习')
    setStartDate(initial?.startDate ?? todayStr())
    setEndDate(initial?.endDate ?? '')
    setTargetQuantity(String(initial?.targetQuantity ?? 100))
    setUnit(initial?.unit ?? (initial?.type === '阅读' ? '页' : '小时'))
    setExpectedPace(String(initial?.expectedPace ?? 1))
    setNotes(initial?.notes ?? '')
    setStagesText('')
  }, [open, initial])

  return (
    <Modal open={open} title={initial ? '编辑目标' : '新建长期目标'} onClose={onClose}>
      <div className="field">
        <label>标题</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：读完某某书" />
      </div>
      <div className="field">
        <label>类型</label>
        <select
          value={type}
          onChange={(e) => {
            const t = e.target.value as SkillType
            setType(t)
            if (t === '阅读') setUnit('页')
            else if (t === '习惯') setUnit('%')
            else setUnit('小时')
          }}
        >
          {SKILL_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="field">
          <label>开始</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </div>
        <div className="field">
          <label>结束（可选）</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <div className="field">
          <label>目标量</label>
          <input type="number" value={targetQuantity} onChange={(e) => setTargetQuantity(e.target.value)} />
        </div>
        <div className="field">
          <label>单位</label>
          <input value={unit} onChange={(e) => setUnit(e.target.value)} />
        </div>
        <div className="field">
          <label>日均预期</label>
          <input type="number" value={expectedPace} onChange={(e) => setExpectedPace(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>备注</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {!initial && (
        <div className="field">
          <label>里程碑（每行一个）</label>
          <textarea value={stagesText} onChange={(e) => setStagesText(e.target.value)} placeholder="阶段一&#10;阶段二" />
        </div>
      )}
      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => {
          if (!title.trim()) return alert('请填写标题')
          onSave(
            {
              title: title.trim(),
              type,
              startDate,
              endDate: endDate || undefined,
              targetQuantity: Number(targetQuantity) || 0,
              unit,
              currentAmount: initial?.currentAmount ?? 0,
              expectedPace: Number(expectedPace) || 0,
              status: initial?.status ?? 'active',
              notes,
            },
            stagesText
              .split('\n')
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }}
      >
        保存
      </button>
    </Modal>
  )
}

function GoalDetail({
  goal,
  stages,
  onClose,
  onProgress,
  onStatus,
  onToggleStage,
  onEdit,
  onImport,
}: {
  goal: SkillGoal
  stages: SkillStage[]
  onClose: () => void
  onProgress: (g: SkillGoal, amount: number) => void
  onStatus: (g: SkillGoal, s: SkillStatus) => void
  onToggleStage: (s: SkillStage) => void
  onEdit: () => void
  onImport: (f: File) => void
}) {
  const [amount, setAmount] = useState(String(goal.currentAmount))
  const prog = skillProgress(goal)

  return (
    <Modal open title={goal.title} onClose={onClose}>
      <div style={{ marginBottom: 12 }}>
        <span className="badge muted">{goal.type}</span>{' '}
        <span className={`badge ${prog.paceStatus === 'behind' ? 'danger' : prog.paceStatus === 'ahead' ? 'success' : 'muted'}`}>
          {PACE_LABEL[prog.paceStatus]}
        </span>
      </div>
      <ProgressBar value={prog.pct} />
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        {goal.currentAmount}/{goal.targetQuantity} {goal.unit} · 预期 {prog.expected.toFixed(1)} · 偏差{' '}
        {prog.delta >= 0 ? '+' : ''}
        {prog.delta.toFixed(1)}
        {prog.eta ? ` · ETA ${prog.eta}` : ''}
      </p>
      <div className="field">
        <label>更新当前进度</label>
        <div className="row-actions">
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ flex: 1 }} />
          <button type="button" className="btn btn-primary" onClick={() => onProgress(goal, Number(amount) || 0)}>
            更新
          </button>
        </div>
      </div>
      {stages.length > 0 && (
        <>
          <div className="card-title">里程碑</div>
          {stages.map((s) => (
            <label key={s.id} className="list-item" style={{ cursor: 'pointer' }}>
              <input type="checkbox" checked={s.completed} onChange={() => onToggleStage(s)} />
              <div className="meta">
                <div className="title" style={{ textDecoration: s.completed ? 'line-through' : undefined }}>
                  {s.title}
                </div>
              </div>
            </label>
          ))}
        </>
      )}
      {goal.notes && (
        <p style={{ fontSize: '0.9rem', background: 'var(--bg-muted)', padding: 10, borderRadius: 10 }}>{goal.notes}</p>
      )}
      {goal.type === '阅读' && (
        <div className="field">
          <label>导入书籍并关联此目标</label>
          <input
            type="file"
            accept=".txt,.epub"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onImport(f)
            }}
          />
        </div>
      )}
      <div className="row-actions">
        <button type="button" className="btn btn-secondary" onClick={onEdit}>
          编辑
        </button>
        {goal.status === 'paused' ? (
          <button type="button" className="btn btn-secondary" onClick={() => onStatus(goal, 'active')}>
            恢复
          </button>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={() => onStatus(goal, 'paused')}>
            暂停
          </button>
        )}
        <button type="button" className="btn btn-danger" onClick={() => onStatus(goal, 'archived')}>
          归档
        </button>
      </div>
    </Modal>
  )
}

function Reader({
  book,
  onClose,
  onProgress,
}: {
  book: Book
  onClose: () => void
  onProgress: (position: number, total: number, percent: number) => void
}) {
  if (book.fileType === 'txt') {
    return <TxtReader book={book} onClose={onClose} onProgress={onProgress} />
  }
  return <EpubReader book={book} onClose={onClose} onProgress={onProgress} />
}

function TxtReader({
  book,
  onClose,
  onProgress,
}: {
  book: Book
  onClose: () => void
  onProgress: (position: number, total: number, percent: number) => void
}) {
  const PAGE = 1200
  const [page, setPage] = useState(Math.floor(book.currentPosition / PAGE))
  const totalPages = Math.max(1, Math.ceil(book.content.length / PAGE))
  const text = book.content.slice(page * PAGE, (page + 1) * PAGE)

  useEffect(() => {
    const pos = page * PAGE
    const pct = book.content.length ? (pos / book.content.length) * 100 : 0
    onProgress(pos, book.content.length, Math.min(100, pct + (100 / totalPages) * ((page + 1) / totalPages) * 0))
    const percent = ((page + 1) / totalPages) * 100
    onProgress(pos, book.content.length, percent)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  return (
    <div className="reader">
      <div className="reader-header">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          ← 返回
        </button>
        <strong style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {book.title}
        </strong>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {page + 1}/{totalPages}
        </span>
      </div>
      <div className="reader-body">{text}</div>
      <div className="reader-footer">
        <button type="button" className="btn btn-secondary" disabled={page <= 0} onClick={() => setPage((p) => p - 1)}>
          上一页
        </button>
        <div style={{ flex: 1 }}>
          <ProgressBar value={((page + 1) / totalPages) * 100} />
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={page >= totalPages - 1}
          onClick={() => setPage((p) => p + 1)}
        >
          下一页
        </button>
      </div>
    </div>
  )
}

function EpubReader({
  book,
  onClose,
  onProgress,
}: {
  book: Book
  onClose: () => void
  onProgress: (position: number, total: number, percent: number) => void
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [percent, setPercent] = useState(book.percent)
  const renditionRef = useRef<{ prev: () => void; next: () => void; destroy?: () => void } | null>(null)

  useEffect(() => {
    let destroyed = false
    ;(async () => {
      try {
        const blobRow = await db.blobs.get(book.id)
        if (!blobRow) throw new Error('找不到 EPUB 文件数据')
        const ePub = (await import('epubjs')).default
        const bookInst = ePub(blobRow.data)
        if (!hostRef.current || destroyed) return
        hostRef.current.innerHTML = ''
        const rendition = bookInst.renderTo(hostRef.current, {
          width: '100%',
          height: '100%',
          flow: 'paginated',
          allowScriptedContent: false,
        })
        await rendition.display()
        renditionRef.current = rendition
        bookInst.ready.then(() => {
          bookInst.locations.generate(1000).then(() => {
            rendition.on('relocated', (...args: unknown[]) => {
              const loc = args[0] as { start?: { percentage?: number; location?: number } }
              const pct = (loc?.start?.percentage ?? 0) * 100
              setPercent(pct)
              onProgress(loc?.start?.location ?? 0, 1000, pct)
            })
          })
        })
      } catch (e) {
        setError(e instanceof Error ? e.message : 'EPUB 加载失败')
      }
    })()
    return () => {
      destroyed = true
      try {
        renditionRef.current?.destroy?.()
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.id])

  return (
    <div className="reader">
      <div className="reader-header">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          ← 返回
        </button>
        <strong style={{ flex: 1 }}>{book.title}</strong>
        <span style={{ fontSize: '0.8rem' }}>{percent.toFixed(0)}%</span>
      </div>
      {error ? (
        <div className="reader-body">
          <EmptyState icon="⚠️" title="无法打开 EPUB" description={error} />
        </div>
      ) : (
        <div className="reader-body" style={{ padding: 0 }} ref={hostRef} />
      )}
      <div className="reader-footer">
        <button type="button" className="btn btn-secondary" onClick={() => renditionRef.current?.prev()}>
          上一页
        </button>
        <div style={{ flex: 1 }}>
          <ProgressBar value={percent} />
        </div>
        <button type="button" className="btn btn-secondary" onClick={() => renditionRef.current?.next()}>
          下一页
        </button>
      </div>
    </div>
  )
}
