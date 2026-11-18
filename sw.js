const CACHE = 'scanpress-v2';
const ASSETS = ['./', 'index.html', 'help.html', 'privacy.html', 'style.css', 'scan-core.js', 'app.js', 'tesseract.min.js', 'worker.min.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-lstm.wasm.js', 'pdf.min.mjs', 'pdf.worker.min.mjs', 'manifest.json', 'icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'LICENSE-tesseract.txt', 'LICENSE-pdfjs.txt'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k.startsWith('scanpress')).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
// the reading data for each language is kept by the text reader itself (in this computer's storage)
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) e.respondWith(caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req)));
});
