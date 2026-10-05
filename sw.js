/**
 * Service worker Presensi Siswa — membuat halaman tetap bisa dibuka tanpa sinyal.
 * Naikkan VERSI setiap kali Anda mengganti library atau ikon, supaya cache lama dibuang.
 * (index.html tidak perlu: selalu diambil versi terbaru saat ada sinyal.)
 */
const VERSI = 'presensi-v1';
const LIB = 'https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/html5-qrcode.min.js';
const INTI = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-180.png', LIB];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSI).then(c => c.addAll(INTI)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSI).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // kiriman presensi (POST) tidak disentuh
  const url = new URL(req.url);
  if (/script\.google(usercontent)?\.com$/.test(url.hostname)) return;   // API Apps Script selalu langsung

  // Halaman: ambil terbaru dari internet; kalau offline/lambat, pakai yang tersimpan
  if (req.mode === 'navigate') {
    e.respondWith(jaringanDulu(req, './index.html'));
    return;
  }
  // Library pemindai (versi terkunci): cukup dari cache
  if (url.href === LIB) {
    e.respondWith(caches.match(req).then(r => r || ambilDanSimpan(req)));
    return;
  }
  // File sendiri & font Google: pakai cache, perbarui di belakang
  if (url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(cacheLaluPerbarui(req));
  }
});

async function ambilDanSimpan(req) {
  const res = await fetch(req);
  if (res && (res.ok || res.type === 'opaque')) {
    const c = await caches.open(VERSI);
    c.put(req, res.clone());
  }
  return res;
}

async function jaringanDulu(req, cadangan) {
  try {
    const res = await Promise.race([
      ambilDanSimpan(req),
      new Promise((_, gagal) => setTimeout(() => gagal(new Error('lambat')), 4000))
    ]);
    return res;
  } catch (err) {
    return (await caches.match(req, { ignoreSearch: true })) || (await caches.match(cadangan));
  }
}

async function cacheLaluPerbarui(req) {
  const lama = await caches.match(req);
  const baru = ambilDanSimpan(req).catch(() => null);
  return lama || (await baru) || Response.error();
}
