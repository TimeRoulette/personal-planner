/** Emotion Ball engine instance (vendored vanilla JS) */
export interface EmotionBallInstance {
  setEmotion: (id: string, opts?: { auto?: boolean }) => boolean
  handleAIMessage: (msg: string | { emotionId: string; tips?: string }) => boolean
  on: (event: 'change' | 'tips' | 'error', cb: (payload: unknown) => void) => void
  destroy: () => void
  startTour?: (ids: string[], interval?: number) => void
  stopTour?: () => void
}

export interface EmotionBallCreateOpts {
  emotion?: string
  shape?: 'blob' | 'wedge' | 'gem'
  color?: string
  idle?: boolean | Record<string, unknown>
  lite?: boolean
  eyeScale?: number
  autostart?: boolean
  fallbackId?: string
}

export interface EmotionBallStatic {
  create: (el: HTMLElement, opts?: EmotionBallCreateOpts) => EmotionBallInstance
}

declare global {
  interface Window {
    EmotionBall?: EmotionBallStatic
    EMOTION_SEED?: unknown
    EB_RINGS?: unknown
  }
}

export {}
