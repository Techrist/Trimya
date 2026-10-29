/* eslint-disable no-restricted-globals */
/**
 * Service worker racine de Trimya PWA.
 *
 * Stratégie :
 *  - App shell (HTML, JS, CSS, icônes) : cache-first avec revalidation.
 *    On garde la version précédente dispo offline tant que la nouvelle n'est
 *    pas téléchargée, puis on bascule au prochain lancement.
 *  - Firebase (Firestore + Auth + Functions) : NE JAMAIS cacher. Les requêtes
 *    passent directement au réseau — Firestore gère sa propre persistance
 *    côté client via IndexedDB, pas besoin de doubler ça au niveau SW.
 *  - Images utilisateurs (photos coiffeurs, logos salons) : stale-while-revalidate.
 *
 * Mise à jour : quand le SW change (nouveau build), on appelle `skipWaiting`
 * dès que l'utilisateur confirme via un petit toast « Nouvelle version — recharger ».
 * C'est géré côté React dans src/hooks/useServiceWorkerUpdate.ts.
 */

const CACHE_VERSION = 'trimya-v1';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const IMAGES_CACHE = `${CACHE_VERSION}-images`;

// URLs minimum pour que l'app affiche quelque chose offline.
// Les bundles JS/CSS Expo ont des hash dynamiques — ils seront cachés à
// la volée au premier chargement (voir fetch handler plus bas).
const APP_SHELL_URLS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

// Hôtes dont les requêtes ne doivent JAMAIS être servies par le cache.
// On veut toujours la fraîche vérité pour l'auth, Firestore et les CF.
const NEVER_CACHE_HOSTS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'fcm.googleapis.com',
  'cloudfunctions.net',
  'firebaseio.com',
];

self.addEventListener('install', (event) => {
  // Pré-cache de l'app shell, best-effort : si une URL manque on ne
  // bloque pas l'installation (`addAll` serait trop strict).
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) =>
      Promise.all(
        APP_SHELL_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[sw] pre-cache miss', url, err);
          }),
        ),
      ),
    ),
  );
});

self.addEventListener('activate', (event) => {
  // Nettoyage des anciennes caches à chaque nouvelle version.
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  // Prend le contrôle immédiatement sans attendre la fermeture de l'onglet.
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  // Déclenché par le hook useServiceWorkerUpdate quand l'utilisateur
  // confirme la mise à jour via le toast.
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Seules les requêtes GET sont candidates au cache.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // 1) Hôtes exclus → pass-through réseau direct, pas de cache.
  if (NEVER_CACHE_HOSTS.some((h) => url.hostname.includes(h))) {
    return;
  }

  // 2) Images utilisateurs (Firebase Storage, imgix, etc.) → stale-while-revalidate
  if (req.destination === 'image') {
    event.respondWith(staleWhileRevalidate(req, IMAGES_CACHE));
    return;
  }

  // 3) Navigation (HTML) → network-first avec fallback cache (pour offline).
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Mémorise la version fraîche pour les reloads offline.
          const copy = res.clone();
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match('/index.html').then((r) => r || Response.error())),
    );
    return;
  }

  // 4) Assets (JS, CSS, fonts) → cache-first.
  if (['script', 'style', 'font'].includes(req.destination)) {
    event.respondWith(cacheFirst(req, APP_SHELL_CACHE));
    return;
  }

  // 5) Reste → network direct.
});

function cacheFirst(request, cacheName) {
  return caches.open(cacheName).then((cache) =>
    cache.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok && res.status === 200) {
          cache.put(request, res.clone());
        }
        return res;
      });
    }),
  );
}

function staleWhileRevalidate(request, cacheName) {
  return caches.open(cacheName).then((cache) =>
    cache.match(request).then((cached) => {
      const network = fetch(request)
        .then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
}
