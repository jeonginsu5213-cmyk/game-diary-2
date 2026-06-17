import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase (SSR Safe)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const requestFcmToken = async (): Promise<string | null> => {
  try {
    if (typeof window === "undefined") return null;

    // 브라우저가 서비스 워커 및 알림을 지원하는지 확인
    const supported = await isSupported();
    if (!supported) {
      console.warn("FCM is not supported in this browser.");
      return null;
    }

    // 알림 권한 허가 체크
    if (Notification.permission === "default") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.warn("Notification permission denied.");
        return null;
      }
    } else if (Notification.permission === "denied") {
      console.warn("Notification permission was previously denied.");
      return null;
    }

    const messaging = getMessaging(app);

    // 서비스 워커에 Firebase Config를 쿼리 파라미터로 주입하여 동적으로 초기화하도록 유도 (Vercel 환경 변수 연동 최적화)
    const queryParams = new URLSearchParams(firebaseConfig as any).toString();
    const swUrl = `/firebase-messaging-sw.js?${queryParams}`;

    const registration = await navigator.serviceWorker.register(swUrl, {
      scope: "/",
    });

    // 서비스 워커가 활성화(activated)될 때까지 대기하여 "no active Service Worker" 에러 방지
    await navigator.serviceWorker.ready;
    if (!registration.active) {
      await new Promise<void>((resolve) => {
        const waitingWorker = registration.installing || registration.waiting;
        if (waitingWorker) {
          waitingWorker.addEventListener("statechange", (e: any) => {
            if (e.target.state === "activated") {
              resolve();
            }
          });
        } else {
          resolve();
        }
      });
    }

    // FCM 토큰 받기
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    return token;
  } catch (error) {
    console.error("Error requesting FCM token:", error);
    return null;
  }
};
