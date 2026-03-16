// ============================================
// STELLAR FORTUNE - Service Worker
// オフライン対応・キャッシュ管理
// ============================================

const CACHE_NAME = 'stellar-fortune-v1';

// キャッシュするファイル一覧
const CACHE_FILES = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  // 外部フォント・ライブラリ（オフライン用）
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;900&family=Noto+Sans+JP:wght@300;400;500;700&family=Space+Mono:wght@400;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
];

// ============================================
// インストール：リソースをキャッシュに保存
// ============================================
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // 外部リソースはエラーが出ても続行（オプショナル）
      return Promise.allSettled(
        CACHE_FILES.map(url =>
          cache.add(url).catch(err => {
            console.warn('キャッシュ失敗（無視）:', url, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ============================================
// アクティベート：古いキャッシュを削除
// ============================================
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ============================================
// フェッチ：キャッシュ優先・ネットワークフォールバック
// ============================================
self.addEventListener('fetch', event => {
  // Chrome拡張など無視
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        // キャッシュがあればそれを返し、バックグラウンドで更新
        const fetchPromise = fetch(event.request)
          .then(response => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(() => {});
        return cached;
      }

      // キャッシュなし → ネットワークから取得＆キャッシュ保存
      return fetch(event.request)
        .then(response => {
          if (!response || response.status !== 200 || response.type === 'opaque') {
            return response;
          }
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => {
          // 完全オフライン時はindex.htmlを返す
          if (event.request.destination === 'document') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
