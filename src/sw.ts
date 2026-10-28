/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

// Server push (works while the app is closed): payload {title, body, taskId}
self.addEventListener('push', event => {
  let d: { title: string; body: string; taskId?: string } = { title: 'תזכורת – Nudge', body: '' }
  try { d = { ...d, ...event.data?.json() } } catch { /* use defaults */ }
  event.waitUntil(
    self.registration.showNotification(d.title, {
      body: d.body, tag: d.taskId, icon: 'icon-192.png', badge: 'icon-192.png', lang: 'he', dir: 'rtl',
      data: { taskId: d.taskId }, requireInteraction: true, vibrate: [200, 100, 200],
      actions: [{ action: 'done', title: '✓ בוצע' }, { action: 'snooze', title: '⏰ דחה' }],
    } as NotificationOptions),
  )
})

// Tapping the notification (or one of its buttons) hands the task + chosen action to the app:
// action 'done' marks it complete, 'snooze' opens the snooze picker. Swiping the notification away = ignore.
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const taskId: string | undefined = event.notification.data?.taskId
  const action = event.action // 'done' | 'snooze' | '' (plain tap)
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const open = list[0]
      if (open) {
        if (taskId) open.postMessage({ type: 'nudge-action', taskId, action: action || 'open' })
        return open.focus()
      }
      const url = new URL(self.registration.scope)
      if (taskId) { url.searchParams.set('task', taskId); url.searchParams.set('action', action || 'open') }
      return self.clients.openWindow(url.href)
    }),
  )
})
