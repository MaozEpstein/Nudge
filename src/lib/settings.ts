import { useEffect, useState } from 'react'

export type Settings = {
  layout: 'columns' | 'single' // columns: כמה עמודות לפי רוחב המסך; single: עמודה אחת
  density: 'compact' | 'comfortable'
}

const KEY = 'nudge-settings'
const DEFAULTS: Settings = { layout: 'columns', density: 'compact' }

const read = (): Settings => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') } } catch { return DEFAULTS }
}

// Per-device display settings (stored in the browser).
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(read)
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(settings)) } catch { /* ignore */ }
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
