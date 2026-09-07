import { useEffect } from 'react'
import { useSettings } from './useSettings'

export function useTheme() {
  const { settings, updateSettings } = useSettings()

  useEffect(() => {
    const root = document.documentElement
    const apply = (dark: boolean) => {
      root.dataset.theme = dark ? 'dark' : 'light'
      root.style.colorScheme = dark ? 'dark' : 'light'
    }

    if (settings.theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      apply(mq.matches)
      const handler = (e: MediaQueryListEvent) => apply(e.matches)
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
    apply(settings.theme === 'dark')
  }, [settings.theme])

  return { theme: settings.theme, setTheme: (theme: typeof settings.theme) => updateSettings({ theme }) }
}
