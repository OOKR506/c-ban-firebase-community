// c반놈들 - 최소 서비스워커
// 목적: (1) 크롬/안드로이드 "앱 설치" 배너가 뜨려면 fetch 핸들러가 있는 서비스워커가 필요함
//       (2) 오프라인일 때 완전 백지 대신 마지막으로 본 화면을 보여줌
// 데이터(Firestore)는 항상 최신이어야 하므로 캐시보다 네트워크를 우선합니다.

const CACHE_NAME = 'cbannomdeul-v7';
const APP_SHELL = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // 다른 도메인(Firebase Auth/Firestore, 구글, CDN 등)과 /__/ 경로는 서비스워커가 건드리지 않음
  // → 로그인 유지/실시간 통신이 서비스워커 때문에 깨지지 않도록
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/__/')) return;

  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/index.html')))
  );
});
