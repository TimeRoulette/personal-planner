import { useEffect, useState } from 'react'
import { db } from '../../db/database'
import { useLiveQuery } from '../../hooks/useLiveQuery'
import { Modal } from '../../components/Modal'
import { EmptyState } from '../../components/EmptyState'
import { ProgressBar } from '../../components/ProgressBar'
import { Toast } from '../../components/Toast'
import { DateGroupedList } from '../../components/DateGroupedList'
import { SKILL_TYPES } from '../../utils/defaults'
import { nid, nowISO, todayStr } from '../../utils/id'
import { PACE_LABEL, skillProgress } from '../../utils/skillMath'
import { SKILL_TEMPLATES, nextReviewDate, type SkillTemplate } from '../../utils/skillTemplates'
import { skillCheckinStreak, suggestNextStep, daysSinceLastNote } from '../../utils/skillInsights'
import { Reader } from './Reader'
import type { Book, SkillGoal, SkillNote, SkillNoteKind, SkillStage, SkillStatus, SkillType } from '../../types'

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
  const notes = useLiveQuery(() => db.skillNotes.toArray(), [], []) ?? []
  const books =
    useLiveQuery(async () => {
      const rows = await db.books.toArray()
      return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    }, [], []) ?? []

  const activeGoals = goals.filter((g) => g.status === 'active' || g.status === 'paused')

  async function saveGoal(
    data: Omit<SkillGoal, 'id' | 'createdAt' | 'updatedAt'>,
    stageTitles: string[],
  ) {
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

  async function addNote(goal: SkillGoal, content: string, kind: SkillNoteKind) {
    const text = content.trim()
    if (!text) return
    const date = todayStr()
    await db.skillNotes.add({
      id: nid(),
      skillGoalId: goal.id,
      date,
      content: text,
      kind,
      createdAt: nowISO(),
    })
    await db.skillGoals.update(goal.id, { lastCheckIn: date, updatedAt: nowISO() })
    setToast(kind === 'checkin' ? '已打卡' : '笔记已保存')
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
          学习成长
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
              title="还没有学习目标"
              description="用模板快速创建阅读 / 语言 / 编程 / 考试计划"
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
              const gNotes = notes.filter((n) => n.skillGoalId === g.id)
              const streak = skillCheckinStreak(gNotes)
              const gStages = stages.filter((s) => s.skillGoalId === g.id).sort((a, b) => a.order - b.order)
              const tip = suggestNextStep(g, gStages, gNotes)
              return (
                <div key={g.id} className="card" onClick={() => setDetailId(g.id)} role="button" tabIndex={0}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <strong>
                      {g.type} · {g.title}
                    </strong>
                    <span
                      className={`badge ${prog.paceStatus === 'behind' ? 'danger' : prog.paceStatus === 'ahead' ? 'success' : 'muted'}`}
                    >
                      {PACE_LABEL[prog.paceStatus]}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '6px 0' }}>
                    {g.currentAmount} / {g.targetQuantity} {g.unit} · {prog.pct.toFixed(0)}%
                    {prog.eta ? ` · 预计 ${prog.eta}` : ''}
                    {streak > 0 ? ` · 连续 ${streak} 天` : ''}
                    {g.status === 'paused' ? ' · 已暂停' : ''}
                  </div>
                  <ProgressBar value={prog.pct} />
                  <div className="insight-box" style={{ marginTop: 10, marginBottom: 0 }}>
                    💡 {tip}
                  </div>
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
              仅在本地解析。阅读器支持自动目录跳转（EPUB nav/spine；TXT 启发式章节）。
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
          notes={notes
            .filter((n) => n.skillGoalId === detail.id)
            .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))}
          onClose={() => setDetailId(null)}
          onProgress={updateProgress}
          onStatus={setStatus}
          onToggleStage={toggleStage}
          onAddNote={addNote}
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
  const [templateId, setTemplateId] = useState<string | undefined>()

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
    setTemplateId(initial?.templateId)
  }, [open, initial])

  function applyTemplate(tpl: SkillTemplate) {
    setTemplateId(tpl.id)
    setTitle(tpl.title)
    setType(tpl.type)
    setUnit(tpl.unit)
    setTargetQuantity(String(tpl.targetQuantity))
    setExpectedPace(String(tpl.expectedPace))
    setNotes(tpl.notes)
    setStagesText(tpl.stages.join('\n'))
  }

  return (
    <Modal open={open} title={initial ? '编辑目标' : '新建学习目标'} onClose={onClose}>
      {!initial && (
        <>
          <div className="card-title">模板</div>
          <div className="template-grid">
            {SKILL_TEMPLATES.map((tpl) => (
              <button key={tpl.id} type="button" className="template-chip" onClick={() => applyTemplate(tpl)}>
                <strong>{tpl.name}</strong>
                <span>{tpl.stages.length} 阶段 · {tpl.unit}</span>
              </button>
            ))}
          </div>
        </>
      )}
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
        <label>备注 / 学习计划说明</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      {!initial && (
        <div className="field">
          <label>阶段计划（每行一个）</label>
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
              templateId,
              lastCheckIn: initial?.lastCheckIn,
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
  notes,
  onClose,
  onProgress,
  onStatus,
  onToggleStage,
  onAddNote,
  onEdit,
  onImport,
}: {
  goal: SkillGoal
  stages: SkillStage[]
  notes: SkillNote[]
  onClose: () => void
  onProgress: (g: SkillGoal, amount: number) => void
  onStatus: (g: SkillGoal, s: SkillStatus) => void
  onToggleStage: (s: SkillStage) => void
  onAddNote: (g: SkillGoal, content: string, kind: SkillNoteKind) => void
  onEdit: () => void
  onImport: (f: File) => void
}) {
  const [amount, setAmount] = useState(String(goal.currentAmount))
  const [noteText, setNoteText] = useState('')
  const [noteKind, setNoteKind] = useState<SkillNoteKind>('checkin')
  const prog = skillProgress(goal)
  const streak = skillCheckinStreak(notes)
  const since = daysSinceLastNote(notes)
  const tpl = SKILL_TEMPLATES.find((t) => t.id === goal.templateId)
  const intervals = tpl?.reviewIntervals ?? [1, 3, 7]
  const review = nextReviewDate(goal.lastCheckIn || notes[0]?.date, intervals)
  const tip = suggestNextStep(goal, stages, notes, intervals)

  return (
    <Modal open title={goal.title} onClose={onClose}>
      <div style={{ marginBottom: 12 }}>
        <span className="badge muted">{goal.type}</span>{' '}
        <span
          className={`badge ${prog.paceStatus === 'behind' ? 'danger' : prog.paceStatus === 'ahead' ? 'success' : 'muted'}`}
        >
          {PACE_LABEL[prog.paceStatus]}
        </span>
        {streak > 0 && <span className="badge success">连续 {streak} 天</span>}
      </div>
      <div className="insight-box">
        <div>💡 建议下一步：{tip}</div>
        <div style={{ marginTop: 6 }}>
          节奏 vs 计划：预期 {prog.expected.toFixed(1)} {goal.unit}，偏差 {prog.delta >= 0 ? '+' : ''}
          {prog.delta.toFixed(1)}
          {review ? ` · 下次复习提醒 ${review}` : ''}
          {since !== null ? ` · 距上次笔记 ${since} 天` : ' · 尚无笔记'}
        </div>
      </div>
      <ProgressBar value={prog.pct} />
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
        {goal.currentAmount}/{goal.targetQuantity} {goal.unit}
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
          <div className="card-title">学习阶段</div>
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
      <div className="card-title">打卡 / 笔记 / 反思</div>
      <div className="tabs-seg" style={{ marginBottom: 8 }}>
        {(
          [
            ['checkin', '打卡'],
            ['note', '笔记'],
            ['reflection', '反思'],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" className={noteKind === k ? 'active' : ''} onClick={() => setNoteKind(k)}>
            {label}
          </button>
        ))}
      </div>
      <div className="field">
        <textarea
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder={noteKind === 'checkin' ? '今天学了什么？' : noteKind === 'reflection' ? '哪里卡住了？下次怎么做？' : '记下要点…'}
        />
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => {
            onAddNote(goal, noteText, noteKind)
            setNoteText('')
          }}
        >
          保存
        </button>
      </div>
      <DateGroupedList
        items={notes}
        renderItem={(n) => (
          <div className="list-item">
            <div className="meta">
              <div className="title">
                {n.kind === 'checkin' ? '✅ 打卡' : n.kind === 'reflection' ? '🪞 反思' : '📝 笔记'}
              </div>
              <div className="sub">{n.content}</div>
            </div>
          </div>
        )}
        empty={<p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>暂无活动记录</p>}
      />
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
