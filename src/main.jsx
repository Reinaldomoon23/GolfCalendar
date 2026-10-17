import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initSentry } from './utils/sentry'

const SW_RECOVERY_KEY = 'roundtracker-sw-recovery-v2';

async function recoverStaleServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (localStorage.getItem(SW_RECOVERY_KEY) === 'done') return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  if (registrations.length === 0) return;

  // A worker from an earlier build can keep navigating the mobile PWA even
  // after the application code has been fixed. Recover once per browser.
  localStorage.setItem(SW_RECOVERY_KEY, 'done');
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if (window.caches) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  }

  window.location.reload();
}

void recoverStaleServiceWorker().catch((error) => {
  console.warn('[pwa] No se pudo recuperar el Service Worker:', error);
});

// Initialize error tracking
initSentry();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
