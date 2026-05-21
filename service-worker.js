const CACHE_NAME = "field-map-v4-1-9-correct-icon";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/app.css?v=4.1.9",
  "./js/core/security-guard.js?v=4.1.9",
  "./js/core/state.js?v=4.1.9",
  "./js/modules/map/map-core.js?v=4.1.9",
  "./js/modules/map/map-state.js?v=4.1.9",
  "./js/core/app-init.js?v=4.1.9",
  "./js/modules/storage/export-folder.js?v=4.1.9",
  "./js/core/export-helper.js?v=4.1.9",
  "./js/ui/drawer.js?v=4.1.9",
  "./js/ui/menu-bar.js?v=4.1.9",
  "./js/features/search.js?v=4.1.9",
  "./js/features/filter-panel.js?v=4.1.9",
  "./js/modules/map/map-controls.js?v=4.1.9",
  "./js/features/helicopter.js?v=4.1.9",
  "./js/features/plus-menu.js?v=4.1.9",
  "./js/modules/map/map-tools.js?v=4.1.9",
  "./js/features/tool-layout.js?v=4.1.9",
  "./js/features/settings.js?v=4.1.9",
  "./js/features/production-hardening.js?v=4.1.9",
  "./js/features/corrections.js?v=4.1.9",
  "./js/data/importers.js?v=4.1.9",
  "./js/features/raw-data-inspector.js?v=4.1.9",
  "./js/ui/display-settings.js?v=4.1.9",
  "./js/data/asset-fields.js?v=4.1.9",
  "./js/modules/editor/asset-editor.js?v=4.1.9",
  "./js/main.js?v=4.1.9",
  "./js/modules/auth/pin-lock.js?v=4.1.9",
  "./js/features/field-map-final-v418.js?v=4.1.9",
  "./js/features/pwa-install-helper-v415.js?v=4.1.9",
  "./icon-v389-192.png",
  "./icon-v389-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => Promise.allSettled(ASSETS.map(asset => cache.add(asset)))));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME && /field[-_ ]?map/i.test(k)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", event => {
  const data = event.data || {};
  if (data.type === "SKIP_WAITING") self.skipWaiting();
  if (data.type === "FIELD_MAP_BACKGROUND_HEARTBEAT") event.waitUntil(Promise.resolve());
});

function sameOrigin(req){
  try { return new URL(req.url).origin === self.location.origin; } catch(e){ return false; }
}

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" && req.method !== "HEAD") return;
  if (!sameOrigin(req)) return;
  const url = new URL(req.url);
  const freshFirst = req.mode === "navigate" || /\.(html|css|js|json|webmanifest)$/i.test(url.pathname);
  if (freshFirst) {
    event.respondWith(fetch(req, { cache: "no-store" }).then(res => {
      if (res && res.ok) caches.open(CACHE_NAME).then(cache => cache.put(req, res.clone())).catch(() => null);
      return res;
    }).catch(() => caches.match(req).then(cached => cached || caches.match("./index.html"))));
    return;
  }
  event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(res => {
    if (res && res.ok) caches.open(CACHE_NAME).then(cache => cache.put(req, res.clone())).catch(() => null);
    return res;
  })));
});
