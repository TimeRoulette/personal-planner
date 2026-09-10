import { useMemo, useRef, useState, type ReactNode } from 'react'
import { db } from '../../db/database'
import { useSettings } from '../../hooks/useSettings'
import { Toast } from '../../components/Toast'
import { Modal } from '../../components/Modal'
import { localAdapter } from '../../sync'
import { chatCompletion, toApiMessages } from '../../utils/llm'
import { nid, nowISO } from '../../utils/id'
import { CRYPTO_LIMITATION_ZH } from '../../utils/cryptoKey'
import { LLM_PRESETS, findPreset } from '../../utils/llmPresets'
import type { ChatMessage, CurrencyCode, ThemeMode } from '../../types'
import { useLiveQuery } from '../../hooks/useLiveQuery'

function Accordion({
  title,
  open,
  onToggle,
  children,
}: {
  title: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="card accordion-card">
      <button type="button" className="accordion-header" aria-expanded={open} onClick={onToggle}>
        <span>{title}</span>
        <span className="chevron">{open ? '▼' : '▶'}</span>
      </button>
      {open && <div className="accordion-body">{children}</div>}
    </div>
  )
}

export function SettingsPage() {
  const { settings, updateSettings } = useSettings()
  const [toast, setToast] = useState<string | null>(null)
  const [showChat, setShowChat] = useState(false)
  const [openSec, setOpenSec] = useState<{ appearance: boolean; data: boolean; ai: boolean }>({
    appearance: false,
    data: false,
    ai: false,
  })
  const fileRef = useRef<HTMLInputElement>(null)

  async function exportJson() {
    const payload = await localAdapter.pull()
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `personal-planner-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setToast('已导出 JSON')
  }

  async function importJson(file: File) {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!data || typeof data !== 'object' || !Array.isArray(data.transactions)) {
        throw new Error('文件格式不正确')
      }
      if (!confirm('导入将覆盖当前本地数据，确认继续？')) return
      await localAdapter.push(data)
      setToast('导入成功')
    } catch (e) {
      alert(e instanceof Error ? e.message : '导入失败')
    }
  }

  async function clearAll() {
    if (!confirm('确认清空所有本地数据？此操作不可恢复。')) return
    if (!confirm('再次确认：真的要清空吗？')) return
    await db.delete()
    location.reload()
  }

  function applyPreset(id: string) {
    const p = findPreset(id)
    if (!p) return
    if (p.id === 'custom') {
      updateSettings({ llm: { ...settings.llm, providerId: 'custom' } })
      return
    }
    updateSettings({
      llm: {
        ...settings.llm,
        providerId: p.id,
        baseUrl: p.baseUrl,
        model: p.model,
      },
    })
    setToast(`已套用 ${p.name}`)
  }

  const providerId = settings.llm.providerId || 'custom'

  return (
    <div>
      <h1 className="page-title">设置</h1>

      <Accordion
        title="外观"
        open={openSec.appearance}
        onToggle={() => setOpenSec((s) => ({ ...s, appearance: !s.appearance }))}
      >
        <div className="field">
          <label>主题</label>
          <select
            value={settings.theme}
            onChange={(e) => updateSettings({ theme: e.target.value as ThemeMode })}
          >
            <option value="system">跟随系统</option>
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </div>
        <div className="field">
          <label>货币</label>
          <select
            value={settings.currency}
            onChange={(e) => updateSettings({ currency: e.target.value as CurrencyCode })}
          >
            <option value="CNY">人民币 CNY</option>
            <option value="USD">美元 USD</option>
            <option value="EUR">欧元 EUR</option>
            <option value="JPY">日元 JPY</option>
            <option value="HKD">港币 HKD</option>
          </select>
        </div>
      </Accordion>

      <Accordion
        title="数据"
        open={openSec.data}
        onToggle={() => setOpenSec((s) => ({ ...s, data: !s.data }))}
      >
        <div className="row-actions" style={{ flexDirection: 'column' }}>
          <button type="button" className="btn btn-secondary btn-block" onClick={exportJson}>
            导出 JSON
          </button>
          <button type="button" className="btn btn-secondary btn-block" onClick={() => fileRef.current?.click()}>
            导入 JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importJson(f)
              e.target.value = ''
            }}
          />
          <button type="button" className="btn btn-danger btn-block" onClick={clearAll}>
            清空全部数据
          </button>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 0 }}>
          数据保存在本机 IndexedDB。SyncAdapter 接口已预留，未来可接入云同步。周期起始日请到「储蓄」页设置。
        </p>
      </Accordion>

      <Accordion
        title="AI 助手（OpenAI 兼容）"
        open={openSec.ai}
        onToggle={() => setOpenSec((s) => ({ ...s, ai: !s.ai }))}
      >
        <div className="field">
          <label>服务商预设</label>
          <select value={providerId} onChange={(e) => applyPreset(e.target.value)}>
            {LLM_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="chip-row" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
          {LLM_PRESETS.filter((p) => p.id !== 'custom').map((p) => (
            <button
              key={p.id}
              type="button"
              className={`chip ${providerId === p.id ? 'active' : ''}`}
              onClick={() => applyPreset(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
        <div className="field">
          <label>Base URL</label>
          <input
            value={settings.llm.baseUrl}
            onChange={(e) =>
              updateSettings({ llm: { ...settings.llm, baseUrl: e.target.value, providerId: 'custom' } })
            }
            placeholder="https://api.openai.com/v1"
          />
        </div>
        <div className="field">
          <label>API Key</label>
          <input
            type="password"
            value={settings.llm.apiKey}
            onChange={(e) => updateSettings({ llm: { ...settings.llm, apiKey: e.target.value } })}
            placeholder="粘贴 API Key…"
            autoComplete="off"
          />
        </div>
        <div className="field">
          <label>模型</label>
          <input
            value={settings.llm.model}
            onChange={(e) => updateSettings({ llm: { ...settings.llm, model: e.target.value } })}
            placeholder="gpt-4o-mini"
          />
        </div>
        <button type="button" className="btn btn-primary btn-block" onClick={() => setShowChat(true)}>
          打开 AI 对话
        </button>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 0, lineHeight: 1.5 }}>
          {CRYPTO_LIMITATION_ZH}
        </p>
      </Accordion>

      <div className="card">
        <div className="card-title">关于</div>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          个人规划助手 v1 · 本地优先 PWA · 储蓄 / 锻炼 / 技能
        </p>
      </div>

      <ChatSheet open={showChat} onClose={() => setShowChat(false)} />
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  )
}

function ChatSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings } = useSettings()
  const messages = useLiveQuery(() => db.chatMessages.orderBy('createdAt').toArray(), [], []) ?? []
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [withContext, setWithContext] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  const visible = useMemo(() => messages.filter((m) => m.role !== 'system'), [messages])

  async function buildContextSummary(): Promise<string> {
    const [txs, workouts, goals] = await Promise.all([
      db.transactions.orderBy('date').reverse().limit(20).toArray(),
      db.workouts.orderBy('date').reverse().limit(10).toArray(),
      db.skillGoals.filter((g) => g.status === 'active').toArray(),
    ])
    const income = txs.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0)
    const expense = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0)
    return [
      '你是用户的个人规划助手，用简体中文回答，简洁实用。',
      '以下是用户模块摘要（可能不完整）：',
      `近期流水：收入合计约 ${income.toFixed(0)}，支出合计约 ${expense.toFixed(0)}，共 ${txs.length} 条样本。`,
      `近期锻炼：${workouts.map((w) => `${w.date}${w.type}${w.duration}分`).join('；') || '无'}`,
      `进行中技能：${goals.map((g) => `${g.title}(${g.currentAmount}/${g.targetQuantity}${g.unit})`).join('；') || '无'}`,
    ].join('\n')
  }

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setError(null)
    setInput('')
    const userMsg: ChatMessage = { id: nid(), role: 'user', content: text, createdAt: nowISO() }
    await db.chatMessages.add(userMsg)
    setLoading(true)
    try {
      const history = await db.chatMessages.orderBy('createdAt').toArray()
      const system = withContext ? await buildContextSummary() : '你是用户的个人规划助手，用简体中文简洁回答。'
      const apiMessages = toApiMessages(history.slice(-20), system)
      const reply = await chatCompletion(settings.llm, apiMessages)
      await db.chatMessages.add({
        id: nid(),
        role: 'assistant',
        content: reply,
        createdAt: nowISO(),
      })
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch (e) {
      setError(e instanceof Error ? e.message : '请求失败')
    } finally {
      setLoading(false)
    }
  }

  async function clearChat() {
    await db.chatMessages.clear()
  }

  return (
    <Modal open={open} title="AI 对话" onClose={onClose}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: '0.85rem' }}>
        <input type="checkbox" checked={withContext} onChange={(e) => setWithContext(e.target.checked)} />
        附带模块摘要上下文（储蓄/锻炼/技能）
      </label>
      <div
        style={{
          maxHeight: '45vh',
          overflowY: 'auto',
          background: 'var(--bg)',
          borderRadius: 12,
          padding: 10,
          marginBottom: 10,
          minHeight: 160,
        }}
      >
        {visible.length === 0 && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center' }}>
            问问本周储蓄情况，或帮你规划锻炼节奏…
          </p>
        )}
        {visible.map((m) => (
          <div key={m.id} className={`chat-bubble ${m.role}`}>
            {m.content}
          </div>
        ))}
        {loading && <div className="chat-bubble assistant">思考中…</div>}
        <div ref={bottomRef} />
      </div>
      {error && (
        <div className="badge danger" style={{ display: 'block', marginBottom: 8, padding: 8 }}>
          {error}
        </div>
      )}
      <div className="row-actions">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="输入消息…"
          style={{
            flex: 1,
            minHeight: 44,
            borderRadius: 12,
            border: '1px solid var(--border)',
            padding: '0 12px',
            background: 'var(--bg)',
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              void send()
            }
          }}
        />
        <button type="button" className="btn btn-primary" disabled={loading} onClick={() => void send()}>
          发送
        </button>
      </div>
      <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => void clearChat()}>
        清空对话
      </button>
    </Modal>
  )
}
