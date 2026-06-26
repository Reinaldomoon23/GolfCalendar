import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';
import { app, db } from '../firebase';
import { getUserDocId } from '../utils/userProfiles';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;
const PUSH_SCOPE = `${import.meta.env.BASE_URL}firebase-cloud-messaging-push-scope/`;

export async function isPushNotificationSupported() {
  if (typeof window === 'undefined') return false;
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false;
  return isSupported();
}

async function getMessagingRegistration() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Este navegador no soporta service workers.');
  }

  const existingRegistration = await navigator.serviceWorker.getRegistration(PUSH_SCOPE);
  if (existingRegistration) return existingRegistration;

  const swUrl = `${import.meta.env.BASE_URL}firebase-messaging-sw.js`;
  return navigator.serviceWorker.register(swUrl, { scope: PUSH_SCOPE });
}

export function getPushNotificationConfigStatus() {
  return {
    hasVapidKey: Boolean(VAPID_KEY),
    permission: typeof Notification === 'undefined' ? 'unsupported' : Notification.permission,
  };
}

export async function enablePushNotifications(user) {
  const uid = getUserDocId(user);
  if (!uid) throw new Error('Faltan datos de usuario para activar notificaciones.');
  if (!VAPID_KEY) throw new Error('Falta configurar VITE_FIREBASE_VAPID_KEY para activar Web Push.');

  const supported = await isPushNotificationSupported();
  if (!supported) throw new Error('Este navegador no soporta notificaciones push.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Permiso de notificaciones denegado.');
  }

  const messaging = getMessaging(app);
  const serviceWorkerRegistration = await getMessagingRegistration();
  const token = await getToken(messaging, {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration,
  });

  if (!token) {
    throw new Error('Firebase no devolvió token de notificaciones.');
  }

  await setDoc(doc(db, 'users', uid, 'push_tokens', token), {
    token,
    platform: 'web',
    user_agent: navigator.userAgent || null,
    scope: PUSH_SCOPE,
    enabled: true,
    updated_at: serverTimestamp(),
    created_at: serverTimestamp(),
  }, { merge: true });

  return token;
}

export async function disablePushNotifications(user, token) {
  const uid = getUserDocId(user);
  if (!uid || !token) return;
  await deleteDoc(doc(db, 'users', uid, 'push_tokens', token));
}

export async function subscribeToForegroundPushMessages(callback) {
  const supported = await isPushNotificationSupported();
  if (!supported) return () => {};

  const messaging = getMessaging(app);
  return onMessage(messaging, (payload) => {
    callback(payload);
  });
}
