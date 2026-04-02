const CACHE_NAME = 'task-app-v1';

// Only precache the app shell static assets — never dynamic pages
const PRECACHE_URLS = [
  '/manifest.json',
];

// ── IndexedDB helpers ──────────────────────────────────────────────────────────

const DB_NAME = 'task-app-offline';
const STORE_NAME = 'pending-actions';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

function savePendingAction(action) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.add(action);
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  }));
}

function getPendingActions() {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = (e) => reject(e.target.error);
  }));
}

function deletePendingAction(id) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
  }));
}

// ── Replay logic (server wins) ─────────────────────────────────────────────────

async function replayPendingActions() {
  const actions = await getPendingActions();
  for (const action of actions) {
    try {
      const res = await fetch(action.url, {
        method: action.method,
        headers: { 'Content-Type': 'application/json' },
        body: action.body,
      });
      await deletePendingAction(action.id);
      console.log('[SW] replayed action', action.id, res.status);
    } catch {
      console.log('[SW] replay failed (offline), keeping action', action.id);
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function isNextInternal(url) {
  return (
    url.includes('/_next/') ||
    url.includes('/api/auth/') ||
    url.includes('/__nextjs') ||
    // Next.js RSC / router requests carry special headers — never cache
    url.includes('?_rsc=') ||
    url.includes('?__nextjs')
  );
}

function isStaticAsset(url) {
  return (
    url.includes('/_next/static/') ||
    /\.(js|css|woff2?|ttf|otf|eot|ico|png|jpg|jpeg|gif|webp|svg)(\?|$)/.test(url)
  );
}

// ── Lifecycle ──────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ── Fetch ──────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  // Never intercept Next.js internal requests — they carry special headers
  // that break the router if served from cache
  if (isNextInternal(url)) return;

  // Queue non-GET API mutations for offline replay (excluding auth)
  if (request.method !== 'GET' && url.includes('/api/')) {
    event.respondWith(
      request.clone().text().then((body) =>
        fetch(request).catch(async () => {
          await savePendingAction({
            url,
            method: request.method,
            body: body || null,
            timestamp: Date.now(),
          });
          return new Response(JSON.stringify({ queued: true }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        })
      )
    );
    return;
  }

  // Only cache static assets (JS, CSS, fonts, images) — never HTML pages
  if (request.method === 'GET' && isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
      })
    );
    return;
  }

  // All other requests (HTML pages, API routes) — always network-first, no cache
});

// ── Background Sync ────────────────────────────────────────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-actions') {
    event.waitUntil(replayPendingActions());
  }
});

// ── Online message fallback ────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'ONLINE') {
    event.waitUntil(replayPendingActions());
  }
});
