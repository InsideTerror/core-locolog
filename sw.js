// locolog service worker: keeps the whole app (and its fonts) on the phone so it opens with no connection.
const CACHE = "locolog-v3";
const PHOTO_CACHE = "locolog-photos";
const FONT_CACHE = "locolog-fonts";
const FILES = ["./", "./index.html", "./manifest.webmanifest", "./mark.png", "./stations.json", "./icon-180.png", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("locolog-") && k !== CACHE && k !== FONT_CACHE && k !== PHOTO_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Google Fonts: cache on first online visit, then serve from the phone.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(
      caches.open(FONT_CACHE).then(c => c.match(req).then(hit => {
        const net = fetch(req).then(res => { if (res.ok || res.type === "opaque") c.put(req, res.clone()); return res; });
        return hit || net.catch(() => Response.error());
      }))
    );
    return;
  }

  // Class photos and their Commons lookups: keep a copy so they show offline.
  if (url.hostname === "upload.wikimedia.org" || url.hostname === "commons.wikimedia.org") {
    e.respondWith(
      caches.open(PHOTO_CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) c.put(req, res.clone());
        return res;
      })))
    );
    return;
  }

  // App files: cache first. Updates arrive when CACHE is renamed.
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(req).catch(() => req.mode === "navigate" ? caches.match("./index.html") : Response.error());
    })
  );
});
