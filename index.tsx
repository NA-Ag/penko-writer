import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerServiceWorker, setupInstallPrompt } from './utils/pwa';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register service worker for PWA functionality
if (import.meta.env.PROD) {
  // Only register in production builds
  registerServiceWorker();
  setupInstallPrompt();
} else {
  console.log('[PWA] Service Worker registration skipped in development mode');
}