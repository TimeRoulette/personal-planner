import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type { EmotionBallInstance } from '../vendor/emotion-ball/types'

const SCRIPT_FILES = ['rings.js', 'emotions.js', 'ball.js', 'engine.js'] as const

let loadPromise: Promise<void> | null = null

function scriptBase(): string {
  const base = import.meta.env.BASE_URL || '/'
  return `${base}emotion-ball/js/`
}

function loadEmotionBallScripts(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (window.EmotionBall?.create) return Promise.resolve()
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const base = scriptBase()
    for (const file of SCRIPT_FILES) {
      const src = base + file
      const existing = document.querySelector<HTMLScriptElement>(`script[data-emotion-ball="${file}"]`)
      if (existing) {
        if (!existing.dataset.loaded) {
          await new Promise<void>((resolve, reject) => {
            existing.addEventListener('load', () => resolve(), { once: true })
            existing.addEventListener('error', () => reject(new Error(`Failed ${file}`)), { once: true })
          })
        }
        continue
      }
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script')
        s.src = src
        s.async = false
        s.dataset.emotionBall = file
        s.onload = () => {
          s.dataset.loaded = '1'
          resolve()
        }
        s.onerror = () => reject(new Error(`Failed to load ${src}`))
        document.head.appendChild(s)
      })
    }
  })()

  return loadPromise
}

type BallExt = EmotionBallInstance & {
  spin?: (n?: number, dir?: number) => void
  burst?: (n?: number) => void
  bounce?: () => void
  _blinkNow?: (t: number) => void
  handleAIMessage?: (msg: string | { emotionId: string; tips?: string }) => boolean
  startTour?: (ids: string[], interval?: number) => void
  stopTour?: () => void
}

export type BallPlayKind =
  | 'spin'
  | 'ribbons'
  | 'blink'
  | 'bounce'
  | 'flash'
  | 'tip'
  | 'combo'
  | 'peek'
  | 'tour'

export interface BallPlayResult {
  kind: BallPlayKind
  tip?: string
}

export interface EmotionBallHandle {
  setEmotion: (emotionId: string) => void
  flashEmotion: (emotionId: string, ms?: number, restoreId?: string) => void
  /** 点击互动：自旋甩彩带（基础） */
  interact: () => void
  /** 丰富互动：按模式或自动轮换 / 随机 */
  play: (kind?: BallPlayKind | 'auto' | 'random') => BallPlayResult
  bounce: () => void
  blink: () => void
  spin: (turns?: number) => void
  burst: (n?: number) => void
  showTip: (text: string) => void
}

const FUN_EMOTIONS = ['10', '13', '14', '19', '03', '11', '33', '31', '16', '21'] as const

const TIP_POOL = [
  '转一圈，元气满满～',
  '彩带来啦！✨',
  '眨眼打招呼 👀',
  '蹦一下！',
  '今天也要慢慢来',
  '喝口水再继续？',
  '你点得好勤快呀',
  '连击！气球兴奋了',
  '偷偷看你一眼～',
  '休息也是进度的一部分',
  '记录一小步也算赢',
  '嘿嘿，被你发现了',
]

interface Props {
  emotionId?: string
  size?: number
  className?: string
  shape?: 'blob' | 'wedge' | 'gem'
  color?: string
  lite?: boolean
  label?: string
  interactive?: boolean
  /** 点击时丰富互动；false 则仅基础 spin+burst */
  playful?: boolean
  onInteract?: (result?: BallPlayResult) => void
  onTip?: (text: string) => void
}

export const EmotionBallView = forwardRef<EmotionBallHandle, Props>(function EmotionBallView(
  {
    emotionId = '02',
    size = 120,
    className,
    shape = 'blob',
    color,
    lite = true,
    label = '情绪球',
    interactive = false,
    playful = true,
    onInteract,
    onTip,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null)
  const ballRef = useRef<BallExt | null>(null)
  const emotionRef = useRef(emotionId)
  const flashTimer = useRef<number | null>(null)
  const tapTimes = useRef<number[]>([])
  const playIdx = useRef(0)
  const tipTimer = useRef<number | null>(null)
  const onTipRef = useRef(onTip)
  onTipRef.current = onTip

  function getBall(): BallExt | null {
    return ballRef.current
  }

  function emitTip(text: string) {
    onTipRef.current?.(text)
  }

  function doBlink() {
    const b = getBall()
    try {
      b?._blinkNow?.(performance.now())
    } catch {
      /* ignore */
    }
  }

  function doSpin(turns = 1) {
    try {
      getBall()?.spin?.(turns)
    } catch {
      /* ignore */
    }
  }

  function doBurst(n = 12) {
    try {
      getBall()?.burst?.(n)
    } catch {
      /* ignore */
    }
  }

  function doBounce() {
    try {
      getBall()?.bounce?.()
    } catch {
      /* ignore */
    }
  }

  function doFlash() {
    const id = FUN_EMOTIONS[Math.floor(Math.random() * FUN_EMOTIONS.length)]
    const b = getBall()
    b?.setEmotion(id)
    if (flashTimer.current) window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => {
      b?.setEmotion(emotionRef.current)
    }, 1400)
    return id
  }

  function doPeek() {
    // 待机窥视：短暂好奇/害羞再回
    const peekId = Math.random() < 0.5 ? '03' : '14'
    const b = getBall()
    b?.setEmotion(peekId)
    doBlink()
    if (flashTimer.current) window.clearTimeout(flashTimer.current)
    flashTimer.current = window.setTimeout(() => {
      b?.setEmotion(emotionRef.current)
    }, 1100)
  }

  function doTour() {
    const b = getBall()
    const ids = ['10', '13', '19', '33', emotionRef.current]
    try {
      b?.stopTour?.()
      b?.startTour?.(ids, 700)
      window.setTimeout(() => b?.stopTour?.(), 3200)
    } catch {
      /* ignore */
    }
  }

  function playKind(kind: BallPlayKind): BallPlayResult {
    const tip = TIP_POOL[Math.floor(Math.random() * TIP_POOL.length)]
    switch (kind) {
      case 'spin':
        doSpin(1)
        emitTip(tip)
        return { kind, tip }
      case 'ribbons':
        doSpin(2)
        doBurst(16)
        emitTip(tip)
        return { kind, tip }
      case 'blink':
        doBlink()
        emitTip(tip)
        return { kind, tip }
      case 'bounce':
        doBounce()
        emitTip(tip)
        return { kind, tip }
      case 'flash': {
        doFlash()
        emitTip(tip)
        return { kind, tip }
      }
      case 'tip': {
        try {
          getBall()?.handleAIMessage?.({ emotionId: emotionRef.current, tips: tip })
        } catch {
          /* ignore */
        }
        emitTip(tip)
        return { kind, tip }
      }
      case 'combo':
        doSpin(1)
        doBounce()
        window.setTimeout(() => {
          doBurst(14)
          doBlink()
        }, 280)
        emitTip('连击彩带 Combo！')
        return { kind, tip: '连击彩带 Combo！' }
      case 'peek':
        doPeek()
        emitTip(tip)
        return { kind, tip }
      case 'tour':
        doTour()
        emitTip('表情巡回中…')
        return { kind, tip: '表情巡回中…' }
      default:
        doSpin(1)
        doBurst(10)
        return { kind: 'spin', tip }
    }
  }

  function resolveAuto(): BallPlayKind {
    const cycle: BallPlayKind[] = [
      'spin',
      'ribbons',
      'blink',
      'bounce',
      'flash',
      'tip',
      'peek',
      'combo',
      'tour',
    ]
    const k = cycle[playIdx.current % cycle.length]
    playIdx.current += 1
    return k
  }

  function play(kind: BallPlayKind | 'auto' | 'random' = 'auto'): BallPlayResult {
    const now = Date.now()
    tapTimes.current = tapTimes.current.filter((t) => now - t < 900)
    tapTimes.current.push(now)

    // 多击连打：0.9s 内 ≥3 次 → combo
    if (tapTimes.current.length >= 3) {
      tapTimes.current = []
      return playKind('combo')
    }

    let k: BallPlayKind
    if (kind === 'auto') k = resolveAuto()
    else if (kind === 'random') {
      const all: BallPlayKind[] = ['spin', 'ribbons', 'blink', 'bounce', 'flash', 'tip', 'peek', 'combo', 'tour']
      k = all[Math.floor(Math.random() * all.length)]
    } else k = kind
    return playKind(k)
  }

  useImperativeHandle(ref, () => ({
    setEmotion(id: string) {
      emotionRef.current = id
      ballRef.current?.setEmotion(id)
    },
    flashEmotion(id: string, ms = 1600, restoreId?: string) {
      ballRef.current?.setEmotion(id)
      if (flashTimer.current) window.clearTimeout(flashTimer.current)
      flashTimer.current = window.setTimeout(() => {
        const back = restoreId ?? emotionRef.current
        ballRef.current?.setEmotion(back)
      }, ms)
    },
    interact() {
      play('ribbons')
    },
    play,
    bounce: doBounce,
    blink: doBlink,
    spin: doSpin,
    burst: doBurst,
    showTip: emitTip,
  }))

  useEffect(() => {
    let cancelled = false
    const el = hostRef.current
    if (!el) return

    void loadEmotionBallScripts()
      .then(() => {
        if (cancelled || !hostRef.current || !window.EmotionBall?.create) return
        hostRef.current.innerHTML = ''
        const ball = window.EmotionBall.create(hostRef.current, {
          emotion: emotionRef.current,
          shape,
          color,
          idle: true,
          lite,
          eyeScale: size <= 100 ? 1.45 : 1.15,
          fallbackId: '02',
        }) as BallExt
        ballRef.current = ball

        // 引擎 tips 事件冒泡到 UI
        try {
          ball.on?.('tips', (payload: unknown) => {
            const text = (payload as { text?: string })?.text
            if (text) emitTip(text)
          })
        } catch {
          /* ignore */
        }
      })
      .catch((err) => {
        console.warn('[EmotionBall]', err)
      })

    return () => {
      cancelled = true
      if (flashTimer.current) window.clearTimeout(flashTimer.current)
      if (tipTimer.current) window.clearTimeout(tipTimer.current)
      try {
        ballRef.current?.destroy()
      } catch {
        /* ignore */
      }
      ballRef.current = null
      if (el) el.innerHTML = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    emotionRef.current = emotionId
    if (ballRef.current) {
      ballRef.current.setEmotion(emotionId)
    }
  }, [emotionId])

  function handleClick(e?: { stopPropagation?: () => void }) {
    e?.stopPropagation?.()
    if (!interactive && !onInteract) return
    let result: BallPlayResult | undefined
    if (playful) {
      result = play('auto')
    } else {
      doSpin(1)
      doBurst(10)
      result = { kind: 'spin' }
    }
    onInteract?.(result)
  }

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        position: 'relative',
        cursor: interactive || onInteract ? 'pointer' : undefined,
        touchAction: 'manipulation',
      }}
      aria-label={label}
      role={interactive || onInteract ? 'button' : 'img'}
      tabIndex={interactive || onInteract ? 0 : undefined}
      onClick={(e) => handleClick(e)}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && (interactive || onInteract)) {
          e.preventDefault()
          handleClick(e)
        }
      }}
    >
      <div ref={hostRef} style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />
    </div>
  )
})
