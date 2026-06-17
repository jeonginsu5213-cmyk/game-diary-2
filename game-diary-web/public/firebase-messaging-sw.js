// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker by passing in the messagingSenderId.
firebase.initializeApp({
  apiKey: self.location.search ? new URLSearchParams(self.location.search).get('apiKey') : "",
  authDomain: self.location.search ? new URLSearchParams(self.location.search).get('authDomain') : "",
  projectId: self.location.search ? new URLSearchParams(self.location.search).get('projectId') : "",
  storageBucket: self.location.search ? new URLSearchParams(self.location.search).get('storageBucket') : "",
  messagingSenderId: self.location.search ? new URLSearchParams(self.location.search).get('messagingSenderId') : "",
  appId: self.location.search ? new URLSearchParams(self.location.search).get('appId') : ""
});

const messaging = firebase.messaging();

// FCM SDK가 notification 페이로드를 받아 백그라운드 상태에서 자동으로 알림을 띄워주므로,
// 중복 알림(Double Notification)이 뜨는 것을 막기 위해 수동 showNotification 호출을 생략합니다.
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
});

// 알림 클릭 이벤트 핸들러
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const targetUrl = event.notification.data?.url || '/diary';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus().then(() => client.navigate(targetUrl));
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
