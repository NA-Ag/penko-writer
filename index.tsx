import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { loadLanguage, LanguageCode } from './utils/translations';
import './index.css';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '@fontsource/playfair-display/400.css';
import '@fontsource/playfair-display/700.css';
import '@fontsource/merriweather/300.css';
import '@fontsource/merriweather/400.css';
import '@fontsource/merriweather/700.css';
import '@fontsource/source-code-pro/400.css';
import '@fontsource/source-code-pro/600.css';
import { registerServiceWorker, setupInstallPrompt } from './utils/pwa';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
// Load the saved UI language before the first render to avoid an English flash
let savedLanguage: LanguageCode = 'en-US';
try {
  savedLanguage = (localStorage.getItem('penko_writer_ui_lang') as LanguageCode) || 'en-US';
} catch {
  /* storage unavailable */
}
void loadLanguage(savedLanguage).finally(() => root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
));

// PWA: capture the install prompt as early as possible (before React mounts
// InstallPrompt) and register the Workbox service worker in production builds.
setupInstallPrompt();
if (import.meta.env.PROD) {
  registerServiceWorker();
}
