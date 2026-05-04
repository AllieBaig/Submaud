const VERSION = 'subliminal-v20'; 
const CACHE_NAME = `subliminal-player-${VERSION}`;

const STATIC_ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'favicon.ico',
];

const EXTERNAL_ASSETS = [
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap'
];

const PRECACHE_ASSETS = [...STATIC_ASSETS, ...EXTERNAL_ASSETS];

// Install: Cache immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch(err => {
        console.warn('[SW] Pre-cache partial fail', err);
      });
    })
  );
});

// Activate: Purge old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key.startsWith('subliminal-player-') && key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Strategy: Safe Mode
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Method bypass
  if (event.request.method !== 'GET') return;
  // 2. Protocol bypass
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  // 3. Dev tools bypass
  if (url.pathname.startsWith('/@vite') || url.pathname.includes('hot-update')) return;

  // 4. Audio Bypass (iOS Stability)
  // CRITICAL: We completely bypass the Service Worker for any audio-related requests.
  // This allows Safari's native media engine to handle range requests and HLS without interference.
  const isAudio = 
    event.request.destination === 'audio' || 
    url.pathname.match(/\.(mp3|m4a|wav|ogg|flac|aac|webm|blob|m4r|opus|mp4)$/i) ||
    url.pathname.includes('/audio/') ||
    event.request.headers.get('Accept')?.includes('audio/') ||
    event.request.headers.get('Range') || // Safari uses range requests for audio
    url.host.includes('blob'); // Blob URLs are used extensively for local storage playback
  
  if (isAudio) return;

  // 5. Navigation (SPA Fallback)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // If network is good, update cache and return
          if (networkResponse.ok && !networkResponse.redirected) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('index.html', clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // If network fails (offline), return cached index.html
          return caches.match('index.html').then(cached => {
            return cached || caches.match('./index.html') || Response.error();
          });
        })
    );
    return;
  }

  // 6. Asset Cache (Stale-while-revalidate for speed)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse.ok && networkResponse.status === 200 && !networkResponse.redirected) {
          const isCacheable = url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|webp|woff2|json|webmanifest|ico)$/);
          if (isCacheable) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
        }
        return networkResponse;
      }).catch(() => {
        // Fallback for missing assets
        return cachedResponse || new Response('', { status: 404 });
      });

      return cachedResponse || fetchPromise;
    })
  );
});
