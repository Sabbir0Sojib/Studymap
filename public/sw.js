// StudyMap offline support. The page always comes from the network when online (so a new version shows at once)
// and from the copy kept here when offline. Code files carry their version in their name, so a kept copy is always
// right; the code of the version in use (precache.json, written by the build) is kept on the first visit, so every
// tool works offline, and copies from older versions are dropped. Bundled data and fonts are served from the copy
// and refreshed behind. Boundaries, terrain and imagery tiles come from the network first; the copies kept from
// earlier visits are used when offline.
const SHELL = 'studymap-shell-v2';
const ASSETS = 'studymap-assets-v1';
const DATA = 'studymap-data-v1';
const MAX_DATA = 700;
const MAX_ASSETS = 160; // about three versions of the app's code and fonts

self.addEventListener('install', (e) => {
  e.waitUntil(
    Promise.all([
      caches.open(SHELL).then((c) => c.addAll(['./', './favicon.svg', './manifest.webmanifest'])),
      keepCode().catch(() => { /* no list (a dev server): files are kept as they are used */ }),
    ]).then(() => self.skipWaiting()),
  );
});

/** Keeps every code file of this version, and drops code files of older versions. */
async function keepCode() {
  const res = await fetch('./precache.json', { cache: 'no-store' });
  if (!res.ok) return;
  const files = (await res.json()).map((f) => new URL(f, self.registration.scope).href);
  const c = await caches.open(ASSETS);
  const have = new Set((await c.keys()).map((r) => r.url));
  await Promise.all(files.filter((u) => !have.has(u)).map((u) => c.add(u).catch(() => {})));
  // old versions' code is never asked for again (new names each build); fonts and pictures stay until trimmed
  const keep = new Set(files);
  for (const r of await c.keys()) if (/\.(js|css)$/.test(new URL(r.url).pathname) && !keep.has(r.url)) await c.delete(r);
}

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('studymap-') && k !== SHELL && k !== ASSETS && k !== DATA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Oldest copies go first once a cache holds more than `max`. */
async function trim(name, max) {
  const c = await caches.open(name);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]);
}

/** Keeps a copy; a full storage only means no copy (the answer itself still reaches the page). */
async function keep(name, req, res, max) {
  try {
    await (await caches.open(name)).put(req, res);
    if (max) await trim(name, max);
  } catch { /* storage full or blocked */ }
}

async function networkFirst(req, cacheName) {
  try {
    const res = await fetch(req);
    if (res.ok) keep(cacheName, req, res.clone(), cacheName === DATA ? MAX_DATA : 0);
    return res;
  } catch (err) {
    const hit = await caches.match(req);
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) keep(ASSETS, req, res.clone(), MAX_ASSETS);
  return res;
}

async function staleWhileRevalidate(req) {
  const hit = await caches.match(req);
  const fresh = fetch(req).then((res) => { if (res.ok) keep(SHELL, req, res.clone(), 0); return res; }).catch(() => hit);
  return hit ?? fresh;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);
  if (u.origin === self.location.origin) {
    if (u.pathname.endsWith('/precache.json')) return;
    if (req.mode === 'navigate') e.respondWith(networkFirst(req, SHELL));
    else if (u.pathname.includes('/assets/')) e.respondWith(cacheFirst(req));
    else e.respondWith(staleWhileRevalidate(req));
    return;
  }
  // map data from the free services the app uses: keep a copy for offline use
  if (/geoboundaries|githubusercontent|mapterhorn|eox\.at|epsg\.io|jsdelivr|fonts\.g/.test(u.host)) e.respondWith(networkFirst(req, DATA));
});
