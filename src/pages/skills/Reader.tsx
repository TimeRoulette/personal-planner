import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { db } from '../../db/database'
import { EmptyState } from '../../components/EmptyState'
import { ProgressBar } from '../../components/ProgressBar'
import { useSettings } from '../../hooks/useSettings'
import { DEFAULT_READER_SETTINGS } from '../../utils/defaults'
import { cleanEpubToc, detectTxtChapters, positionToTxtPage, type TocEntry } from '../../utils/txtToc'
import type { Book, ReaderFontFamily, ReaderSettings, ReaderTheme } from '../../types'

const FONT_STACK: Record<ReaderFontFamily, string> = {
  system: 'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Noto Sans SC", sans-serif',
  serif: '"Noto Serif SC", "Songti SC", "SimSun", Georgia, serif',
  sans: '"PingFang SC", "Noto Sans SC", "Helvetica Neue", Arial, sans-serif',
  mono: '"SF Mono", "Cascadia Code", "Sarasa Mono SC", ui-monospace, monospace',
}

function themeVars(theme: ReaderTheme): { bg: string; fg: string } | null {
  if (theme === 'paper') return { bg: '#f7f3ea', fg: '#2c2416' }
  if (theme === 'night') return { bg: '#0f1419', fg: '#d7dde5' }
  if (theme === 'sepia') return { bg: '#f0e6d2', fg: '#4a3728' }
  return null
}

function flattenNav(
  items: { id?: string; label: string; href: string; subitems?: unknown[] }[],
  acc: TocEntry[] = [],
): TocEntry[] {
  for (const it of items) {
    const raw = (it.label || '').trim()
    acc.push({
      id: it.id || it.href,
      label: raw || `章节 ${acc.length + 1}`,
      href: it.href,
      position: acc.length,
    })
    if (Array.isArray(it.subitems) && it.subitems.length) {
      flattenNav(it.subitems as typeof items, acc)
    }
  }
  return cleanEpubToc(acc)
}

/** 左 1/3 上一页、右 1/3 下一页；中部留给选文/设置。支持左右滑。 */
function usePageGestures(
  elRef: RefObject<HTMLElement | null>,
  onPrev: () => void,
  onNext: () => void,
  enabled = true,
) {
  const start = useRef<{ x: number; y: number; t: number } | null>(null)

  useEffect(() => {
    const el = elRef.current
    if (!el || !enabled) return

    const onPointerDown = (e: PointerEvent) => {
      if ((e.target as HTMLElement)?.closest?.('button,a,input,select,textarea,label')) return
      start.current = { x: e.clientX, y: e.clientY, t: Date.now() }
    }
    const onPointerUp = (e: PointerEvent) => {
      if (!start.current) return
      const dx = e.clientX - start.current.x
      const dy = e.clientY - start.current.y
      const dt = Date.now() - start.current.t
      start.current = null
      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.2 && dt < 600) {
        if (dx < 0) onNext()
        else onPrev()
        return
      }
      // tap zones
      if (Math.abs(dx) < 18 && Math.abs(dy) < 18 && dt < 450) {
        const rect = el.getBoundingClientRect()
        const rel = (e.clientX - rect.left) / rect.width
        if (rel < 0.33) onPrev()
        else if (rel > 0.67) onNext()
      }
    }
    const onPointerCancel = () => {
      start.current = null
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerCancel)
    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [elRef, onPrev, onNext, enabled])
}

function ReaderSettingsPanel({
  open,
  settings,
  onChange,
  onClose,
}: {
  open: boolean
  settings: ReaderSettings
  onChange: (partial: Partial<ReaderSettings>) => void
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div className="reader-settings-panel" role="dialog" aria-label="阅读设置">
      <div className="reader-header" style={{ position: 'relative', inset: 'auto' }}>
        <strong style={{ flex: 1 }}>阅读设置</strong>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          关闭
        </button>
      </div>
      <div className="reader-settings-body">
        <div className="field">
          <label>字号 {settings.fontSize}px</label>
          <input
            type="range"
            min={14}
            max={28}
            step={1}
            value={settings.fontSize}
            onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>行距 {settings.lineHeight.toFixed(2)}</label>
          <input
            type="range"
            min={1.4}
            max={2.2}
            step={0.05}
            value={settings.lineHeight}
            onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>边距 {settings.margin}px</label>
          <input
            type="range"
            min={8}
            max={40}
            step={2}
            value={settings.margin}
            onChange={(e) => onChange({ margin: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label>字体</label>
          <div className="chip-row">
            {(
              [
                ['system', '系统'],
                ['serif', '衬线'],
                ['sans', '黑体'],
                ['mono', '等宽'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`chip ${settings.fontFamily === id ? 'active' : ''}`}
                onClick={() => onChange({ fontFamily: id })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>背景</label>
          <div className="chip-row">
            {(
              [
                ['follow', '跟随主题'],
                ['paper', '纸白'],
                ['sepia', '羊皮纸'],
                ['night', '夜间'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`chip ${settings.theme === id ? 'active' : ''}`}
                onClick={() => onChange({ theme: id })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
          点按左侧 1/3 上一页、右侧 1/3 下一页；左右滑动亦可翻页。设置会保存到本机。
        </p>
      </div>
    </div>
  )
}

function TocPanel({
  open,
  entries,
  onJump,
  onClose,
}: {
  open: boolean
  entries: TocEntry[]
  onJump: (entry: TocEntry) => void
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div className="reader-toc-panel" role="dialog" aria-label="目录">
      <div className="reader-header" style={{ position: 'relative', inset: 'auto' }}>
        <strong style={{ flex: 1 }}>目录</strong>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
          关闭
        </button>
      </div>
      <div className="reader-toc-list">
        {entries.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', padding: 12 }}>未检测到章节</p>
        ) : (
          entries.map((e) => (
            <button key={e.id} type="button" className="reader-toc-item" onClick={() => onJump(e)}>
              {e.label}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

export function Reader({
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

function useReaderPrefs() {
  const { settings, updateSettings } = useSettings()
  const reader = settings.reader ?? DEFAULT_READER_SETTINGS
  const patch = useCallback(
    (partial: Partial<ReaderSettings>) => {
      void updateSettings({ reader: { ...reader, ...partial } })
    },
    [reader, updateSettings],
  )
  return { reader, patch }
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
  const { reader, patch } = useReaderPrefs()
  const [page, setPage] = useState(Math.floor(book.currentPosition / PAGE))
  const [showToc, setShowToc] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const totalPages = Math.max(1, Math.ceil(book.content.length / PAGE))
  const text = book.content.slice(page * PAGE, (page + 1) * PAGE)
  const toc = useMemo(() => detectTxtChapters(book.content), [book.content])

  const goPrev = useCallback(() => setPage((p) => Math.max(0, p - 1)), [])
  const goNext = useCallback(() => setPage((p) => Math.min(totalPages - 1, p + 1)), [totalPages])
  usePageGestures(bodyRef, goPrev, goNext, !showToc && !showSettings)

  useEffect(() => {
    const pos = page * PAGE
    const percent = ((page + 1) / totalPages) * 100
    onProgress(pos, book.content.length, percent)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const themed = themeVars(reader.theme)

  return (
    <div
      className="reader"
      style={
        themed
          ? ({
              '--reader-bg': themed.bg,
              '--reader-fg': themed.fg,
            } as CSSProperties)
          : undefined
      }
    >
      <div className="reader-header">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          ← 返回
        </button>
        <strong style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {book.title}
        </strong>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowSettings((v) => !v)}>
          设置
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowToc((v) => !v)}>
          目录
        </button>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {page + 1}/{totalPages}
        </span>
      </div>
      <div
        className="reader-body reader-body--gestures"
        ref={bodyRef}
        style={{
          fontSize: reader.fontSize,
          lineHeight: reader.lineHeight,
          fontFamily: FONT_STACK[reader.fontFamily],
          padding: `${12}px ${reader.margin}px`,
          background: themed ? themed.bg : undefined,
          color: themed ? themed.fg : undefined,
        }}
      >
        {text}
        <div className="reader-tap-hint" aria-hidden>
          <span>‹ 上一页</span>
          <span>下一页 ›</span>
        </div>
      </div>
      <TocPanel
        open={showToc}
        entries={toc}
        onClose={() => setShowToc(false)}
        onJump={(e) => {
          setPage(positionToTxtPage(e.position, PAGE))
          setShowToc(false)
        }}
      />
      <ReaderSettingsPanel
        open={showSettings}
        settings={reader}
        onChange={patch}
        onClose={() => setShowSettings(false)}
      />
      <div className="reader-footer">
        <button type="button" className="btn btn-secondary" disabled={page <= 0} onClick={goPrev}>
          上一页
        </button>
        <div style={{ flex: 1 }}>
          <ProgressBar value={((page + 1) / totalPages) * 100} />
        </div>
        <button type="button" className="btn btn-secondary" disabled={page >= totalPages - 1} onClick={goNext}>
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
  const { reader, patch } = useReaderPrefs()
  const hostRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [percent, setPercent] = useState(book.percent)
  const [showToc, setShowToc] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [toc, setToc] = useState<TocEntry[]>([])
  const renditionRef = useRef<{
    prev: () => void
    next: () => void
    display: (target?: string) => Promise<void>
    themes?: { default: (url: string, rules: Record<string, Record<string, string>>) => void; fontSize: (v: string) => void }
    destroy?: () => void
  } | null>(null)

  const goPrev = useCallback(() => {
    renditionRef.current?.prev()
  }, [])
  const goNext = useCallback(() => {
    renditionRef.current?.next()
  }, [])
  usePageGestures(gestureRef, goPrev, goNext, !showToc && !showSettings && !error)

  // Apply typography to epubjs themes
  useEffect(() => {
    const r = renditionRef.current
    if (!r?.themes) return
    const themed = themeVars(reader.theme)
    r.themes.fontSize(`${reader.fontSize}px`)
    r.themes.default('', {
      body: {
        'font-family': FONT_STACK[reader.fontFamily] + ' !important',
        'line-height': String(reader.lineHeight) + ' !important',
        'padding-left': `${reader.margin}px !important`,
        'padding-right': `${reader.margin}px !important`,
        ...(themed
          ? {
              background: `${themed.bg} !important`,
              color: `${themed.fg} !important`,
            }
          : {}),
      },
      p: {
        'line-height': String(reader.lineHeight) + ' !important',
      },
    })
  }, [reader])

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

        try {
          await bookInst.ready
          const nav = await bookInst.loaded.navigation
          const items = nav?.toc?.length ? nav.toc : bookInst.navigation?.toc || []
          let entries = flattenNav(items as { id?: string; label: string; href: string; subitems?: unknown[] }[])
          if (!entries.length && bookInst.spine?.items?.length) {
            entries = cleanEpubToc(
              bookInst.spine.items
                .filter((s: { href?: string }) => s.href)
                .map((s: { href?: string }, i: number) => ({
                  id: `spine-${i}`,
                  label: `章节 ${i + 1}`,
                  href: s.href!,
                  position: i,
                })),
            )
          }
          if (!destroyed) setToc(cleanEpubToc(entries))
        } catch {
          /* toc optional */
        }

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

  const themed = themeVars(reader.theme)

  return (
    <div
      className="reader"
      style={
        themed
          ? ({
              '--reader-bg': themed.bg,
              '--reader-fg': themed.fg,
            } as CSSProperties)
          : undefined
      }
    >
      <div className="reader-header">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          ← 返回
        </button>
        <strong style={{ flex: 1 }}>{book.title}</strong>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowSettings((v) => !v)}>
          设置
        </button>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowToc((v) => !v)}>
          目录
        </button>
        <span style={{ fontSize: '0.8rem' }}>{percent.toFixed(0)}%</span>
      </div>
      {error ? (
        <div className="reader-body">
          <EmptyState icon="⚠️" title="无法打开 EPUB" description={error} />
        </div>
      ) : (
        <div className="reader-body reader-body--gestures" style={{ padding: 0, position: 'relative' }} ref={gestureRef}>
          <div ref={hostRef} style={{ width: '100%', height: '100%' }} />
          <div className="reader-tap-hint" aria-hidden>
            <span>‹ 上一页</span>
            <span>下一页 ›</span>
          </div>
        </div>
      )}
      <TocPanel
        open={showToc}
        entries={toc}
        onClose={() => setShowToc(false)}
        onJump={(e) => {
          void renditionRef.current?.display(e.href)
          setShowToc(false)
        }}
      />
      <ReaderSettingsPanel
        open={showSettings}
        settings={reader}
        onChange={patch}
        onClose={() => setShowSettings(false)}
      />
      <div className="reader-footer">
        <button type="button" className="btn btn-secondary" onClick={goPrev}>
          上一页
        </button>
        <div style={{ flex: 1 }}>
          <ProgressBar value={percent} />
        </div>
        <button type="button" className="btn btn-secondary" onClick={goNext}>
          下一页
        </button>
      </div>
    </div>
  )
}
