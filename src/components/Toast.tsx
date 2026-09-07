import { useEffect } from 'react'

interface Props {
  message: string | null
  onDone: () => void
  duration?: number
}

export function Toast({ message, onDone, duration = 2200 }: Props) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDone, duration)
    return () => clearTimeout(t)
  }, [message, onDone, duration])

  if (!message) return null
  return <div className="toast">{message}</div>
}
