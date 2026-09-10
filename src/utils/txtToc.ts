/** TXT chapter heuristic detection */

export interface TocEntry {
  id: string
  label: string
  /** char offset (TXT) or EPUB href */
  href: string
  position: number
}

const PATTERNS: RegExp[] = [
  new RegExp('^\\s*第[零一二三四五六七八九十百千0-9]+[章节回部卷集篇]\\s*\\S*.{0,40}$'),
  new RegExp('^\\s*Chapter\\s+\\d+\\b.*$', 'i'),
  new RegExp('^\\s*CHAPTER\\s+[IVXLCDM\\d]+\\b.*$'),
  new RegExp('^\\s*第\\s*\\d+\\s*[章节回部卷集篇].{0,40}$'),
  new RegExp('^\\s*\\d+(\\.\\d+)*[\\.、\\s]+\\S.{0,40}$'),
  new RegExp('^\\s*[【\\[]?卷[零一二三四五六七八九十百千0-9]+[】\\]]?.{0,40}$'),
]

function isAllCapsLine(line: string): boolean {
  const t = line.trim()
  if (t.length < 4 || t.length > 60) return false
  if (!/[A-Z]/.test(t)) return false
  const letters = t.replace(/[^A-Za-z]/g, '')
  if (letters.length < 4) return false
  return letters === letters.toUpperCase()
}

export function detectTxtChapters(content: string): TocEntry[] {
  const lines = content.split(/\r?\n/)
  const entries: TocEntry[] = []
  let offset = 0
  const seen = new Set<number>()

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    const nextOffset = offset + line.length + 1
    if (!trimmed) {
      offset = nextOffset
      continue
    }

    let hit = PATTERNS.some((re) => re.test(trimmed))
    if (!hit && isAllCapsLine(trimmed)) hit = true
    if (!hit && /^\d{1,3}[.\s、]\S.{0,30}$/.test(trimmed) && trimmed.length < 40) {
      hit = true
    }

    if (hit && !seen.has(offset)) {
      seen.add(offset)
      entries.push({
        id: `txt-${offset}`,
        label: trimmed.slice(0, 48),
        href: String(offset),
        position: offset,
      })
    }
    offset = nextOffset
  }

  if (entries.length > 80 && entries.length > lines.length * 0.15) {
    return entries.filter((_, idx) => idx % Math.ceil(entries.length / 40) === 0).slice(0, 40)
  }
  return entries
}

export function positionToTxtPage(position: number, pageSize: number): number {
  return Math.max(0, Math.floor(position / pageSize))
}
