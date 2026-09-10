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

export interface EmotionBallHandle {
  setEmotion: (emotionId: string) => void
  flashEmotion: (emotionId: string, ms?: number, restoreId?: string) => void
  /** 点击互动：自旋甩彩带 */
  interact: () => void
}

interface Props {
  emotionId?: string
  size?: number
  className?: string
  shape?: 'blob' | 'wedge' | 'gem'
  color?: string
  lite?: boolean
  /** 无障碍标签 */
  label?: string
  /** 点击球触发互动 */
  interactive?: boolean
  onInteract?: () => void
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
    onInteract,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null)
  const ballRef = useRef<EmotionBallInstance | null>(null)
  const emotionRef = useRef(emotionId)
  const flashTimer = useRef<number | null>(null)

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
      const b = ballRef.current as EmotionBallInstance & { spin?: (n?: number) => void; burst?: (n?: number) => void }
      try {
        b?.spin?.(1)
        b?.burst?.(12)
      } catch {
        /* ignore */
      }
    },
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
        })
        ballRef.current = ball
      })
      .catch((err) => {
        console.warn('[EmotionBall]', err)
      })

    return () => {
      cancelled = true
      if (flashTimer.current) window.clearTimeout(flashTimer.current)
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

  function handleClick() {
    if (!interactive && !onInteract) return
    const b = ballRef.current as EmotionBallInstance & { spin?: (n?: number) => void; burst?: (n?: number) => void }
    try {
      b?.spin?.(1)
      b?.burst?.(10)
    } catch {
      /* ignore */
    }
    onInteract?.()
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
      onClick={handleClick}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && (interactive || onInteract)) {
          e.preventDefault()
          handleClick()
        }
      }}
    >
      <div ref={hostRef} style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />
    </div>
  )
})
