import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fonts are bundled with the app (no request to a font service, works offline as a PWA)
import '@fontsource-variable/figtree'
import '@fontsource-variable/bricolage-grotesque'
import './index.css'
import App from './App.jsx'
import { keepServerAwake } from './lib/api'
import { watchForUpdates } from './lib/appUpdate'
import { captureInstallPrompt } from './lib/install'

keepServerAwake()
// Must be listening before Chrome decides DropIt is installable
captureInstallPrompt()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register the service worker in production builds only (keeps `npm run dev` simple)
if (import.meta.env.PROD) watchForUpdates()

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('Service worker registration failed:', error)
    })
  })
}
