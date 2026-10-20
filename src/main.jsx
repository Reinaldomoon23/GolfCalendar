import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initSentry } from './utils/sentry'

// The app no longer registers a Service Worker automatically. Unregister any
// worker left by an older build without reloading the page.
if ('serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      void registration.unregister();
    }
  }).catch((error) => {
    console.warn('[pwa] No se pudo limpiar un Service Worker antiguo:', error);
  });
}

// Initialize error tracking
initSentry();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
