// Service worker: makes the translator work offline.
//
// * App shell (HTML/CSS/JS/data of German and English) is precached on install. Afterwards every
//   shell file is fetched network-first, revalidated with the server (cache: "no-cache"), and the
//   cached copy is only used offline or when the network is very slow. This keeps HTML, scripts and
//   data from different releases from ever being mixed (which would break the app after a deploy).
// * Symbol SVGs are cached the first time they are shown (cache-first). The page can also
//   download all of them on request ("Offline-Modus"). Their cache is separate and only
//   needs a new name when the BCI-AV data changes.
const SHELL = "bliss-shell-v3";
const SYMBOLS = "bliss-symbols-v1";

const SHELL_FILES = [
  "./",
  "index.html",
  "css/style.css",
  "js/app.js",
  "js/translate.js",
  "js/langs/index.js",
  "js/langs/util.js",
  "js/langs/de.js",
  "js/langs/en.js",
  "js/langs/fr.js",
  "js/langs/es.js",
  "js/langs/it.js",
  "js/langs/pt.js",
  "js/langs/eo.js",
  "js/layout.js",
  "js/config.js",
  "data/symbols.json",
  "data/lang/de.json",
  "data/lang/en.json",
  "data/overrides.json",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES.map((f) => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting()));
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
    event.respondWith(networkFirst(req, "index.html"));
  } else {
    event.respondWith(networkFirst(req, req.url));
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

const SLOW_MS = 5000;

/** Network first (always revalidated); the cached copy answers offline or when the network is very slow. */
async function networkFirst(req, key) {
  const cache = await caches.open(SHELL);
  const hit = await cache.match(key, { ignoreSearch: true });
  const fresh = fetch(req.url, { cache: "no-cache" }).then((res) => {
    if (res.ok) cache.put(key, res.clone());
    return res;
  });
  if (!hit) return fresh.catch(() => Response.error());
  const slow = new Promise((resolve) => setTimeout(() => resolve(hit), SLOW_MS));
  return Promise.race([fresh, slow]).catch(() => hit);
}
