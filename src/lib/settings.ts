import { useEffect, useState } from 'react'

export type Settings = {
  layout: 'columns' | 'single' // columns: כמה עמודות לפי רוחב המסך; single: עמודה אחת
  density: 'compact' | 'comfortable'
  theme: 'auto' | 'light' | 'dark' // auto: לפי הגדרת המכשיר
}

const KEY = 'nudge-settings'
const DEFAULTS: Settings = { layout: 'columns', density: 'compact', theme: 'auto' }

export const readSettings = (): Settings => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return DEFAULTS }
}

const THEME_COLORS = { light: '#f8f7f4', dark: '#17171a' }

// Applies the theme to <html> (CSS reads data-theme) and the browser/status-bar color.
export function applyTheme(theme: Settings['theme']) {
  const root = document.documentElement
  if (theme === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
  const dark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? THEME_COLORS.dark : THEME_COLORS.light)
}

// Per-device display settings (stored in the browser).
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(readSettings)
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(settings)) } catch { /* ignore */ }
    applyTheme(settings.theme)
    if (settings.theme !== 'auto') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('auto')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [settings])
  return [settings, (patch: Partial<Settings>) => setSettings(s => ({ ...s, ...patch }))] as const
}

const COLLAPSED_KEY = 'nudge-collapsed'

// Manual collapse choices per section id. Absent = automatic (collapsed when all tasks done).
export function useCollapsed() {
  const [map, setMap] = useState<Record<string, boolean>>(() => {
    try { return JSON.parse(localStorage.getItem(COLLAPSED_KEY) || '{}') } catch { return {} }
  })
  useEffect(() => {
    try { localStorage.setItem(COLLAPSED_KEY, JSON.stringify(map)) } catch { /* ignore */ }
  }, [map])
  return [map, (id: string, value: boolean) => setMap(m => ({ ...m, [id]: value }))] as const
}
