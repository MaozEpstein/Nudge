/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

declare let self: ServiceWorkerGlobalScope

cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

// Server push (works while the app is closed): payload {title, body, tag}
self.addEventListener('push', event => {
  let d: { title: string; body: string; tag?: string } = { title: 'תזכורת – Nudge', body: '' }
  try { d = { ...d, ...event.data?.json() } } catch { /* use defaults */ }
  event.waitUntil(
    self.registration.showNotification(d.title, {
      body: d.body, tag: d.tag, icon: 'icon-192.png', badge: 'icon-192.png', lang: 'he', dir: 'rtl',
    }),
  )
})

// Clicking a reminder focuses the open app, or opens it.
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const open = list[0]
      if (open) return open.focus()
      return self.clients.openWindow(self.registration.scope)
    }),
  )
})
