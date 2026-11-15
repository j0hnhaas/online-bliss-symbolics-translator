// Service worker: makes the translator work offline.
//
// * App shell (HTML/CSS/JS/data) is precached on install and refreshed in the
//   background on every visit (stale-while-revalidate), so updates arrive after one reload.
// * Symbol SVGs are cached the first time they are shown (cache-first). The page can also
//   download all of them on request ("Offline-Modus"). Their cache is separate and only
//   needs a new name when the BCI-AV data changes.
const SHELL = "bliss-shell-v1";
const SYMBOLS = "bliss-symbols-v1";

const SHELL_FILES = [
  "./",
  "index.html",
  "css/style.css",
  "js/app.js",
  "js/translate.js",
  "js/lemma.js",
  "js/layout.js",
  "js/config.js",
  "data/lexicon.json",
  "data/overrides.json",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== SHELL && key !== SYMBOLS && key.startsWith("bliss-shell-")) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // e.g. GoatCounter: never intercepted

  const scope = new URL(self.registration.scope).pathname;
  const path = url.pathname.slice(scope.length);

  if (path.startsWith("symbols/")) {
    event.respondWith(cacheFirst(req, SYMBOLS));
  } else if (req.mode === "navigate") {
    event.respondWith(networkFirstPage(req));
  } else {
    event.respondWith(staleWhileRevalidate(req, SHELL));
  }
});

async function cacheFirst(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  const fresh = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return hit || (await fresh) || Response.error();
}

async function networkFirstPage(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put("index.html", res.clone());
    return res;
  } catch {
    return (await cache.match("index.html")) || (await cache.match("./")) || Response.error();
  }
}
