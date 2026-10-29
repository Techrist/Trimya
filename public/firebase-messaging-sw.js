/* eslint-disable no-restricted-globals, no-undef */
/**
 * Service worker Firebase Cloud Messaging (FCM Web).
 *
 * Ce SW est séparé de `sw.js` (cache app shell) : FCM impose son propre
 * worker, enregistré sous un scope dédié. Il n'intercepte PAS les requêtes
 * fetch — son seul rôle est de recevoir les push message en arrière-plan
 * et d'afficher la notification système.
 *
 * Enregistré automatiquement par Firebase quand on appelle
 * `getMessaging(app)` depuis le client. Les versions de firebase-app /
 * firebase-messaging DOIVENT matcher avec celles du bundle principal
 * (firebase@10 ici — voir package.json).
 */

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// La config est injectée côté client via self.firebase.initializeApp dans
// le même scope ; mais pour que le SW puisse s'initialiser avant toute
// première ouverture de la page, on duplique la config publique ici.
// Ces clés SONT publiques par design (cf. règles Firestore qui restent
// le vrai garde-fou). On conseille toutefois de régénérer la clé si on
// la transfère à un autre projet.
firebase.initializeApp({
  apiKey: self.FIREBASE_API_KEY || '__INJECTED_AT_RUNTIME__',
  authDomain: self.FIREBASE_AUTH_DOMAIN || '__INJECTED_AT_RUNTIME__',
  projectId: self.FIREBASE_PROJECT_ID || '__INJECTED_AT_RUNTIME__',
  storageBucket: self.FIREBASE_STORAGE_BUCKET || '__INJECTED_AT_RUNTIME__',
  messagingSenderId: self.FIREBASE_MESSAGING_SENDER_ID || '__INJECTED_AT_RUNTIME__',
  appId: self.FIREBASE_APP_ID || '__INJECTED_AT_RUNTIME__',
});

const messaging = firebase.messaging();

// Push arrivé pendant que l'app est fermée OU en arrière-plan.
// L'OS affiche la notification native dérivée du payload.
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Trimya';
  const options = {
    body: payload.notification?.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.data?.tag || 'trimya-default',
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});

// Clic sur la notification → focus/ouvre la PWA
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windows) => {
        for (const client of windows) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
        return undefined;
      }),
  );
});
