/** TXT / EPUB chapter heuristic detection with scoring */

export interface TocEntry {
  id: string
  label: string
  /** char offset (TXT) or EPUB href */
  href: string
  position: number
  score?: number
}

/** 中文数字 / 阿拉伯数字章节前缀 */
const CN_NUM = '[零〇一二三四五六七八九十百千万两0-9]+'

/** 明确的章意单位（优先） */
const CHAPTER_UNITS = '章节回部卷集篇'

/** 「节」仅在后接章意或合理标题时接受；排除「节课」「节日」等 */
const JIE_OK_AFTER =
  '(?:[章节回部卷集篇]|\\s*[：:\\-—–]?\\s*\\S)|$'

const FALSE_POSITIVE_EXACT = new Set([
  '目录',
  '序言',
  '序',
  '前言',
  '后记',
  '跋',
  '作者简介',
  '作者',
  '网址',
  '封面',
  '扉页',
  '版权',
  '版权页',
  '内容简介',
  '内容提要',
  '推荐序',
  '再版前言',
  '写在前面',
])

const MARKETING_RE =
  /最新最全|独家首发|免费下载|全集完结|高清完整|精品推荐|点击阅读|关注公众号|扫码关注|加微|微信群|QQ群|广告|推广|求收藏|求订阅|求票/

const JIE_REJECT_RE = new RegExp(
  `第${CN_NUM}节(?:课|日|奏|目|庆|气|能|制|点|选|流|操|拍|育|约|制|假)`,
)

interface Candidate {
  offset: number
  label: string
  score: number
  kind: string
}

function trimLabel(s: string): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, 64)
}

function isFalsePositiveLabel(label: string): boolean {
  const t = label.trim()
  if (!t) return true
  if (FALSE_POSITIVE_EXACT.has(t)) return true
  if (t.length <= 1) return true
  if (MARKETING_RE.test(t)) return true
  if (/^https?:\/\//i.test(t) || /^www\./i.test(t)) return true
  if (/^作者[：:]/.test(t) && t.length < 20) return true
  if (/^网址[：:]/.test(t)) return true
  if (/^目录$|^【?目录】?$/.test(t)) return true
  // 纯营销短标题、无编号杂讯
  if (t.length < 3 && !/\d|[一二三四五六七八九十]/.test(t)) return true
  return false
}

/** 「第N节」精细规则：节后须像章标题，排除节课/节日等 */
function scoreJieLine(trimmed: string): number | null {
  const m = trimmed.match(new RegExp(`^\\s*第(${CN_NUM})节(.*)$`))
  if (!m) return null
  const after = (m[2] || '').trim()
  if (JIE_REJECT_RE.test(trimmed)) return null
  // 「第一节课」「第二节课」
  if (/^课/.test(after)) return null
  // 「节日」「节奏」等
  if (/^(日|奏|目|庆|气|能|制|点|选|流|操|拍|育|约|假)/.test(after)) return null
  // 空 after：单独「第一节」偏弱，只有上下文像目录才要；给低分
  if (!after) return 35
  // 节后是章意内容或合理标题（冒号/破折号/空格+标题）
  if (new RegExp(`^${JIE_OK_AFTER}`).test(after) || after.length >= 1) {
    // 合理标题：非营销、有实质文字
    if (MARKETING_RE.test(after)) return null
    if (after.length >= 2 || /^[：:\\-—–]/.test(after)) return 72
    return 55
  }
  return null
}

function scoreLine(trimmed: string): Candidate | null {
  if (!trimmed || trimmed.length > 80) return null
  if (isFalsePositiveLabel(trimmed)) return null

  // 优先：第N章/回/部/卷/篇/集
  let m = trimmed.match(new RegExp(`^第(${CN_NUM})([${CHAPTER_UNITS}])([\\s　：:\\-—–].*)?$`))
  if (m) {
    const unit = m[2]
    const rest = (m[3] || '').trim()
    let score = 95
    if (unit === '章' || unit === '回') score = 100
    else if (unit === '卷' || unit === '部' || unit === '篇') score = 92
    else score = 88
    if (rest && MARKETING_RE.test(rest)) score -= 40
    return { offset: 0, label: trimLabel(trimmed), score, kind: `第N${unit}` }
  }

  // 第 N 章（空格分隔）
  m = trimmed.match(new RegExp(`^第\\s*(${CN_NUM}|\\d+)\\s*([${CHAPTER_UNITS}])([\\s　：:\\-—–].*)?$`))
  if (m) {
    return { offset: 0, label: trimLabel(trimmed), score: 90, kind: '第 N 章' }
  }

  // 节：精细规则
  const jieScore = scoreJieLine(trimmed)
  if (jieScore != null) {
    return { offset: 0, label: trimLabel(trimmed), score: jieScore, kind: '第N节' }
  }

  // 卷X
  if (new RegExp(`^[【\\[]?卷(${CN_NUM}|\\d+)[】\\]]?([\\s　：:\\-—–].*)?$`).test(trimmed)) {
    return { offset: 0, label: trimLabel(trimmed), score: 85, kind: '卷' }
  }

  // Chapter N
  if (/^Chapter\s+\d+\b/i.test(trimmed) || /^CHAPTER\s+[IVXLCDM\d]+\b/.test(trimmed)) {
    return { offset: 0, label: trimLabel(trimmed), score: 90, kind: 'Chapter' }
  }

  // 数字编号标题：1. xxx / 1、xxx（要求有实质标题，过短无编号杂讯已过滤）
  if (/^\d{1,3}([.．、]\d{1,3})*[.．、\s　]+\S.{1,40}$/.test(trimmed) && trimmed.length >= 4 && trimmed.length <= 48) {
    // 排除纯日期、纯网址噪音
    if (/^\d{1,2}[.．]\d{1,2}([.．]\d{2,4})?$/.test(trimmed)) return null
    if (MARKETING_RE.test(trimmed)) return null
    return { offset: 0, label: trimLabel(trimmed), score: 50, kind: '数字编号' }
  }

  // ALL CAPS 英文标题（谨慎）
  if (isAllCapsLine(trimmed) && !MARKETING_RE.test(trimmed)) {
    return { offset: 0, label: trimLabel(trimmed), score: 40, kind: 'ALLCAPS' }
  }

  return null
}

function isAllCapsLine(line: string): boolean {
  const t = line.trim()
  if (t.length < 4 || t.length > 60) return false
  if (!/[A-Z]/.test(t)) return false
  const letters = t.replace(/[^A-Za-z]/g, '')
  if (letters.length < 4) return false
  return letters === letters.toUpperCase()
}

function dedupeNear(entries: TocEntry[], minGap = 80): TocEntry[] {
  const out: TocEntry[] = []
  for (const e of entries) {
    const last = out[out.length - 1]
    if (last && Math.abs(e.position - last.position) < minGap) {
      // 保留分数更高者
      if ((e.score ?? 0) > (last.score ?? 0)) out[out.length - 1] = e
      continue
    }
    out.push(e)
  }
  return out
}

/**
 * 检测 TXT 章节。对候选打分，过滤误伤，避免过拆。
 */
export function detectTxtChapters(content: string): TocEntry[] {
  const lines = content.split(/\r?\n/)
  const raw: TocEntry[] = []
  let offset = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    const nextOffset = offset + line.length + 1
    if (!trimmed) {
      offset = nextOffset
      continue
    }

    const hit = scoreLine(trimmed)
    if (hit && hit.score >= 40) {
      raw.push({
        id: `txt-${offset}`,
        label: hit.label,
        href: String(offset),
        position: offset,
        score: hit.score,
      })
    }
    offset = nextOffset
  }

  // 优先保留高分；若过多则抬高阈值
  let filtered = raw
  if (raw.length > 60) {
    filtered = raw.filter((e) => (e.score ?? 0) >= 70)
  } else if (raw.length > 40) {
    filtered = raw.filter((e) => (e.score ?? 0) >= 55)
  }

  // 过拆保护：章节数相对行数过高 → 只留高分
  if (filtered.length > 80 || (lines.length > 0 && filtered.length > lines.length * 0.12)) {
    filtered = filtered.filter((e) => (e.score ?? 0) >= 85)
  }

  const deduped = dedupeNear(filtered)

  // 仍过多则均匀抽样到 50
  if (deduped.length > 50) {
    const step = Math.ceil(deduped.length / 50)
    return deduped.filter((_, idx) => idx % step === 0).slice(0, 50)
  }
  return deduped
}

export function positionToTxtPage(position: number, pageSize: number): number {
  return Math.max(0, Math.floor(position / pageSize))
}

/** 清洗 EPUB nav 标签：去掉空/营销/重复噪讯 */
export function cleanEpubTocLabel(label: string, fallback: string): string {
  const t = (label || '').replace(/\s+/g, ' ').trim()
  if (!t || isFalsePositiveLabel(t)) return fallback
  if (MARKETING_RE.test(t)) return fallback
  return t.slice(0, 64)
}

/** 过滤/清洗 EPUB TOC 条目 */
export function cleanEpubToc(entries: TocEntry[]): TocEntry[] {
  const seen = new Set<string>()
  const out: TocEntry[] = []
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    const label = cleanEpubTocLabel(e.label, `章节 ${i + 1}`)
    const key = `${e.href}::${label}`
    if (seen.has(key)) continue
    seen.add(key)
    if (!e.href) continue
    out.push({ ...e, label })
  }
  return out
}
