// Service Worker v2 — 只快取靜態資源（不攔截導覽/API，避免壓縮回應回放錯誤）
const CACHE = 'screener-v2';
const CORE = ['/css/style.css', '/js/ui.js', '/js/config.js', '/js/supabase.min.js', '/js/init.js', '/favicon.svg'];

self.addEventListener('install', e => {
  // 預先快取靜態檔（手動 fetch 並剝除 content-encoding，避免壓縮回應回放問題）
  e.waitUntil(
    Promise.all(CORE.map(async u => {
      try {
        const res = await fetch(u);
        if (res.ok) {
          const hdrs = new Headers(res.headers);
          hdrs.delete('content-encoding');
          const copy = new Response(res.clone().body, { status: res.status, statusText: res.statusText, headers: hdrs });
          const c = await caches.open(CACHE);
          await c.put(u, copy);
        }
      } catch (err) { /* 個別失敗不阻擋安裝 */ }
    })).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // 導覽與 API 一律走網路（避免 CDN 壓縮回應從快取回放造成 ERR_FAILED）
  if (e.request.mode === 'navigate' || url.pathname.startsWith('/api/')) return;
  // 只快取純靜態檔
  if (!/\.(css|js|svg|png|jpe?g|gif|webp|woff2?|ico)(\?|$)/.test(url.pathname)) return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok) {
        const hdrs = new Headers(res.headers);
        hdrs.delete('content-encoding'); // 快取內 body 已是解壓內容，避免重複解碼
        const copy = new Response(res.clone().body, { status: res.status, statusText: res.statusText, headers: hdrs });
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      }
      return res;
    })).catch(() => fetch(e.request))
  );
});
