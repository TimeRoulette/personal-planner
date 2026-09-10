import { useEffect, useMemo, useRef, useState } from 'react'
import { db } from '../../db/database'
import { EmptyState } from '../../components/EmptyState'
import { ProgressBar } from '../../components/ProgressBar'
import { detectTxtChapters, positionToTxtPage, type TocEntry } from '../../utils/txtToc'
import type { Book } from '../../types'

function flattenNav(
  items: { id?: string; label: string; href: string; subitems?: unknown[] }[],
  acc: TocEntry[] = [],
): TocEntry[] {
  for (const it of items) {
    acc.push({
      id: it.id || it.href,
      label: it.label?.trim() || it.href,
      href: it.href,
      position: acc.length,
    })
    if (Array.isArray(it.subitems) && it.subitems.length) {
      flattenNav(it.subitems as typeof items, acc)
    }
  }
  return acc
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
  const [showToc, setShowToc] = useState(false)
  const totalPages = Math.max(1, Math.ceil(book.content.length / PAGE))
  const text = book.content.slice(page * PAGE, (page + 1) * PAGE)
  const toc = useMemo(() => detectTxtChapters(book.content), [book.content])

  useEffect(() => {
    const pos = page * PAGE
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
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowToc((v) => !v)}>
          目录
        </button>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          {page + 1}/{totalPages}
        </span>
      </div>
      <div className="reader-body">{text}</div>
      <TocPanel
        open={showToc}
        entries={toc}
        onClose={() => setShowToc(false)}
        onJump={(e) => {
          setPage(positionToTxtPage(e.position, PAGE))
          setShowToc(false)
        }}
      />
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
  const [showToc, setShowToc] = useState(false)
  const [toc, setToc] = useState<TocEntry[]>([])
  const renditionRef = useRef<{
    prev: () => void
    next: () => void
    display: (target?: string) => Promise<void>
    destroy?: () => void
  } | null>(null)

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
            entries = bookInst.spine.items
              .filter((s) => s.href)
              .map((s, i) => ({
                id: `spine-${i}`,
                label: `章节 ${i + 1}`,
                href: s.href!,
                position: i,
              }))
          }
          if (!destroyed) setToc(entries)
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

  return (
    <div className="reader">
      <div className="reader-header">
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          ← 返回
        </button>
        <strong style={{ flex: 1 }}>{book.title}</strong>
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
        <div className="reader-body" style={{ padding: 0 }} ref={hostRef} />
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
