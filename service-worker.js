/* =========================================================
   TaskUp — service-worker.js
   Cache "offline-first" de todos os arquivos do app.
   Altere CACHE_VERSION ao publicar mudanças.
   ========================================================= */
const CACHE_VERSION = 'taskup-v4';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/boot.js',
  './js/utils.js',
  './js/crypto.js',
  './js/storage.js',
  './js/ui.js',
  './js/shop.js',
  './js/gamification.js',
  './js/tasks.js',
  './js/routine.js',
  './js/calendar.js',
  './js/pomodoro.js',
  './js/notifications.js',
  './js/backup.js',
  './js/security.js',
  './js/categories.js',
  './js/settings.js',
  './js/dashboard.js',
  './js/app.js',
  './assets/icons/icon.svg',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      // cache: 'reload' ignora o cache HTTP do navegador: instala sempre os arquivos novos
      .then((cache) => cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache primeiro, rede como reserva (e atualiza o cache em segundo plano)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached || (req.mode === 'navigate' ? caches.match('./index.html') : undefined));
      return cached || network;
    })
  );
});

// Clique na notificação: foca/abre o app
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const view = (event.notification.data && event.notification.data.view) || 'dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.postMessage({ type: 'navigate', view });
          return client.focus();
        }
      }
      return self.clients.openWindow('./index.html#/' + view);
    })
  );
});
