/* global firebase */
importScripts('https://www.gstatic.com/firebasejs/12.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.9.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBxbED6TcXd5yuWv5O5ViBqqBGXFfjXEw0',
  authDomain: 'golfscorings-e4338.firebaseapp.com',
  projectId: 'golfscorings-e4338',
  storageBucket: 'golfscorings-e4338.firebasestorage.app',
  messagingSenderId: '987034024177',
  appId: '1:987034024177:web:560e69822800f3a613d150',
});

const messaging = firebase.messaging();

function getAppUrl(path) {
  try {
    return new URL(path || '../friends', self.registration.scope).href;
  } catch (error) {
    return '/GolfTeam/friends';
  }
}

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Nuevo mensaje';
  const options = {
    body: payload.notification?.body || payload.data?.body || '',
    icon: getAppUrl('../pwa-192x192.png'),
    badge: getAppUrl('../pwa-192x192.png'),
    data: {
      url: payload.data?.url || getAppUrl('../friends'),
    },
  };

  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.url || getAppUrl('../friends');

  event.waitUntil((async () => {
    const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const target = new URL(targetUrl, self.location.origin).href;

    for (const client of windowClients) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        await client.focus();
        if ('navigate' in client) return client.navigate(target);
        return client;
      }
    }

    return clients.openWindow(target);
  })());
});
