// Synapse service worker — hand-written, no dependencies.
// Strategy:
//   - install: precache the app shell ("/", "/app")
//   - navigations: network-first, fall back to cache, then to the cached shell
//   - static assets (/_next/static/, /icons/): cache-first
//   - everything else (cross-origin, non-GET): untouched
// Defensive by design: any cache failure falls through to the network.

const CACHE = "synapse-v1";
const SHELL_URLS = ["/", "/app"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        // allSettled: one missing shell URL must not abort the install
        Promise.allSettled(SHELL_URLS.map((url) => cache.add(url)))
      )
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
      .catch(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
  }
});

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      try {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
      } catch {
        // cache write failed — the network response is still valid
      }
    }
    return response;
  } catch (networkError) {
    try {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      for (const shell of SHELL_URLS) {
        const fallback = await cache.match(shell);
        if (fallback) return fallback;
      }
    } catch {
      // no cache available either — rethrow below
    }
    throw networkError;
  }
}

async function cacheFirst(request) {
  try {
    const cached = await caches.match(request);
    if (cached) return cached;
  } catch {
    // cache lookup failed — fall through to network
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      try {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
      } catch {
        // cache write failed — the network response is still valid
      }
    }
    return response;
  } catch {
    // Last resort: a deliberately empty response beats an unhandled rejection
    // that would surface as a broken page for a non-critical asset.
    return new Response("", { status: 504, statusText: "Offline" });
  }
}
