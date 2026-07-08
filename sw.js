// DD Events Dashboard - Service Worker
// Network-first for app files (so updates always show immediately), falling
// back to cache only when offline. This also satisfies the "has a fetch
// handler" requirement browsers use to decide an app is installable.

const CACHE_NAME = 'dd-events-cache-v13';
const APP_SHELL = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    // Don't intercept cross-origin requests (CDN fonts/icons/html2canvas) -
    // let the browser handle those normally.
    if (new URL(event.request.url).origin !== self.location.origin) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                return response;
            })
            .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
});

// Web Push - shows a home-screen/system notification for events pushed from
// the Supabase Edge Function (e.g. "New event booked, apply now").
self.addEventListener('push', (event) => {
    let payload = { title: 'DD Events', body: 'You have a new update.', url: './' };
    try {
        if (event.data) payload = { ...payload, ...event.data.json() };
    } catch (e) {
        // ignore malformed payloads
    }

    event.waitUntil(
        self.registration.showNotification(payload.title, {
            body: payload.body,
            icon: './icons/icon-192.png',
            badge: './icons/icon-96.png',
            data: { url: payload.url || './' }
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = (event.notification.data && event.notification.data.url) || './';

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
            for (const client of clientsList) {
                if (client.url.includes(self.registration.scope) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(targetUrl);
            }
        })
    );
});
