// Service worker : le site reste consultable hors connexion.
// Incrémentez VERSION à chaque modification des fichiers du site.
const VERSION = "bl-v2";
const SHELL = ["./", "./index.html", "./assets/style.css", "./assets/app.js", "./assets/shared.js",
  "./assets/common.js", "./config.js", "./icon.svg", "./manifest.webmanifest", "./data/collections.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return; // sources externes : réseau direct

  // Catalogue : réseau d'abord (toujours à jour), cache si hors ligne
  if (url.pathname.endsWith("/data/index.json")) {
    e.respondWith(fetch(req).then(res => { put(req, res.clone()); return res; }).catch(() => caches.match(req)));
    return;
  }
  // Reste du site : réponse immédiate depuis le cache, mise à jour en arrière-plan
  e.respondWith(caches.match(req, { ignoreSearch: req.mode === "navigate" && url.pathname.endsWith("/") }).then(cached => {
    const network = fetch(req).then(res => { if (res.ok) put(req, res.clone()); return res; })
      .catch(() => cached || caches.match("./index.html"));
    return cached || network;
  }));
});

function put(req, res) {
  caches.open(VERSION).then(c => c.put(req, res));
}
