import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initSentry } from './utils/sentry'

const DEV_SW_RECOVERY_KEY = 'roundtracker-dev-sw-recovery-v1';

async function recoverStaleDevelopmentServiceWorker() {
  if (!import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  if (sessionStorage.getItem(DEV_SW_RECOVERY_KEY) === 'done') return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  if (registrations.length === 0) return;

  // A worker from an earlier local build can keep navigating the tab even
  // after the application code has been fixed. Recover once per tab session.
  sessionStorage.setItem(DEV_SW_RECOVERY_KEY, 'done');
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if (window.caches) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  }

  window.location.reload();
}

void recoverStaleDevelopmentServiceWorker().catch((error) => {
  console.warn('[pwa] No se pudo recuperar el Service Worker local:', error);
});

// Initialize error tracking
initSentry();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
