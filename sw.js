// Service worker : hors-ligne + réception des partages (Web Share Target).
importScripts('./db.js');

const CACHE = 'classeur-wa-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './db.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ce que WhatsApp (ou une autre appli) envoie via « Partager ».
  if (event.request.method === 'POST' && url.pathname.endsWith('/share')) {
    event.respondWith(handleShare(event.request));
    return;
  }

  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;

  // Réseau d'abord (pour récupérer tes mises à jour), cache si hors-ligne.
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(event.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});

async function handleShare(request) {
  const base = self.registration.scope;
  try {
    const form = await request.formData();
    const files = form.getAll('files').filter((f) => f && typeof f === 'object' && f.size > 0);
    const item = makeItem({
      title: form.get('title'),
      text: form.get('text'),
      url: form.get('url'),
      files,
    });
    await dbPut(item);
    return Response.redirect(base + '?shared=' + encodeURIComponent(item.id), 303);
  } catch (err) {
    return Response.redirect(base + '?share-error=1', 303);
  }
}
