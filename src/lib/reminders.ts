import { useEffect, useRef, useState } from 'react'
import type { Task } from '../types'

const FIRED_KEY = 'nudge-fired'
const LATE_MS = 2 * 60 * 1000

const loadFired = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) || '[]')) } catch { return new Set() }
}
const saveFired = (s: Set<string>) => {
  try { localStorage.setItem(FIRED_KEY, JSON.stringify([...s].slice(-200))) } catch { /* ignore */ }
}

export const notificationsSupported = () => 'Notification' in window

export async function ensureNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported'
  if (Notification.permission === 'default') return Notification.requestPermission()
  return Notification.permission
}

async function notify(task: Task) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  const opts: NotificationOptions = {
    body: task.title, icon: 'icon-192.png', badge: 'icon-192.png', tag: task.id, lang: 'he', dir: 'rtl',
  }
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) await reg.showNotification('תזכורת – Nudge', opts)
    else new Notification('תזכורת – Nudge', opts)
  } catch {
    try { new Notification('תזכורת – Nudge', opts) } catch { /* ignore */ }
  }
}

// Checks due reminders while the app is open. Returns tasks that came due
// (shown as an in-app banner, e.g. reminders missed while the app was closed).
export function useReminders(tasks: Task[]) {
  const [due, setDue] = useState<Task[]>([])
  const tasksRef = useRef(tasks)
  tasksRef.current = tasks

  useEffect(() => {
    const fired = loadFired()
    const check = () => {
      const now = Date.now()
      const fresh: Task[] = []
      for (const t of tasksRef.current) {
        if (!t.remind_at || t.done) continue
        const key = `${t.id}@${t.remind_at}`
        if (fired.has(key) || new Date(t.remind_at).getTime() > now) continue
        fired.add(key)
        fresh.push(t)
        notify(t)
      }
      if (fresh.length) {
        saveFired(fired)
        setDue(d => [...d, ...fresh.filter(f => !d.some(x => x.id === f.id))])
      }
    }
    check()
    const iv = window.setInterval(check, 15000)
    const onVis = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVis)
    return () => { window.clearInterval(iv); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  // drop banner entries that were completed/deleted/rescheduled
  const live = due.filter(d => tasks.some(t => t.id === d.id && !t.done && t.remind_at === d.remind_at))
  return {
    due: live,
    dismiss: (id: string) => setDue(d => d.filter(x => x.id !== id)),
    isLate: (t: Task) => !!t.remind_at && Date.now() - new Date(t.remind_at).getTime() > LATE_MS,
  }
}
