import React from "react";
import { createRoot } from "react-dom/client";
import { Provider as ReduxProvider } from "react-redux";
import { IntlProvider } from "react-intl";
import { HelmetProvider } from "react-helmet-async";

import reportWebVitals from "./reportWebVitals";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";
import { App } from "./App";
import store from "./store";
import { getJson } from "./utils/resourceLoader";

const metaDescription = {
  de: "Armeebauer für Warhammer: The Old World.",
  en: "Army builder for Warhammer: The Old World.",
  fr: "Un créateur de liste d'armée pour les jeux Games Workshop 'Warhammer: The Old World'.",
  es: "Creador de listas de ejército para los juegos de mesa de Games Workshop, Warhammer: The Old World.",
  it: "Costruttore di eserciti per Warhammer: The Old World.",
  pl: "Konstruktor armii dla Warhammer: The Old World.",
  cn: "《战锤：旧世界》的军队建造者。",
};

try {
  const timezone = Intl.DateTimeFormat()
    .resolvedOptions()
    .timeZone.toLowerCase()
    .split("/")[0];

  localStorage.setItem("owb.timezone", timezone);
} catch {}

// Language detection
const supportedLanguages = ["en", "de", "fr", "es", "it", "pl", "cn"];
let localStorageLanguage = null;
try {
  localStorageLanguage = localStorage.getItem("lang");
} catch (e) {
  // localStorage may be restricted in some embed contexts (e.g. wiki gadgets)
  localStorageLanguage = null;
}
const rawLocale = localStorageLanguage || navigator.language || navigator.userLanguage || "en";
let locale = String(rawLocale).slice(0, 2).toLowerCase();
// normalize legacy or non-standard codes
if (locale === "zh") {
  locale = "cn";
}
const language = supportedLanguages.indexOf(locale) === -1 ? "en" : locale;

localStorage.setItem("lang", language);
try {
  if (document && document.documentElement && typeof document.documentElement.setAttribute === 'function') {
    document.documentElement.setAttribute("lang", language);
  }
  const metaEl = (typeof document !== 'undefined' && document.querySelector) ? document.querySelector("meta[name=description]") : null;
  if (metaEl && typeof metaEl.setAttribute === 'function') {
    metaEl.setAttribute("content", metaDescription[language]);
  }
} catch (e) {
  // In some gadget/embed contexts DOM may be restricted; avoid throwing during init
  // and proceed without setting document-level attributes.
}

// Load i18n messages based on detected language
async function loadMessages(lang) {
  const configKey = `i18n-${lang}`;

  // Try to load messages for the detected language
  const rawMessages = await getJson(configKey);
  if (rawMessages && Object.keys(rawMessages).length > 0) {
    // Normalize i18n keys: replace full-width punctuation with regular punctuation
    // The i18n data uses full-width separators which don't match react-intl's expectations
    const messages = {};
    for (const [key, value] of Object.entries(rawMessages)) {
      const normalizedKey = key.replace(/[．・]/g, '.').replace(/[，、]/g, ',');
      messages[normalizedKey] = value;
    }
    return messages;
  }

  // Fallback to English if loading fails or messages are empty
  const rawEnglishMessages = await getJson('i18n-en');
  if (rawEnglishMessages && Object.keys(rawEnglishMessages).length > 0) {
    // Apply the same normalization to English messages
    const englishMessages = {};
    for (const [key, value] of Object.entries(rawEnglishMessages)) {
      const normalizedKey = key.replace(/[．・]/g, '.').replace(/[，、]/g, ',');
      englishMessages[normalizedKey] = value;
    }
    return englishMessages;
  }

  return null;
}

// Mounting logic: when used as a MediaWiki gadget the host will provide an
// element with id `builder`. Prefer that element. If it's not present yet,
// wait briefly for the host to create it. Fall back to the CRA default `root`.
async function waitForElement(id, timeout = 5000, interval = 100) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const el = document.getElementById(id);
    if (el) return el;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((res) => setTimeout(res, interval));
  }
  return null;
}

// App wrapper that ensures i18n is loaded before rendering
function AppWithI18n({ messages }) {
  // Only render the app when messages are actually loaded and non-empty
  // This prevents showing translation keys instead of translated content
  if (!messages || Object.keys(messages).length === 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#666',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
        <div style={{ fontSize: '20px', marginBottom: '8px' }}>Loading translations...</div>
        <div style={{ fontSize: '14px', color: '#999' }}>
          Language: {language}
        </div>
      </div>
    );
  }

  return (
    <IntlProvider locale={language} messages={messages}>
      <ReduxProvider store={store}>
        <React.StrictMode>
          <HelmetProvider>
            <App />
          </HelmetProvider>
        </React.StrictMode>
      </ReduxProvider>
    </IntlProvider>
  );
}

async function mountApp() {
  const preferredId = (typeof window !== 'undefined' && window.__OWB_MOUNT_ID__) ? String(window.__OWB_MOUNT_ID__) : 'builder';
  let mountEl = document.getElementById(preferredId);
  if (!mountEl && preferredId === 'builder') {
    // Wait briefly for the host to insert the container
    mountEl = await waitForElement('builder', 3000, 100);
  }

  // fallback to CRA default
  if (!mountEl) mountEl = document.getElementById('root');
  if (!mountEl) {
    console.warn('No mount element found for app (tried #' + preferredId + ' and #root). App will not be mounted.');
    return;
  }

  const root = createRoot(mountEl);

  try {
    // Load i18n messages BEFORE any rendering
    const messages = await loadMessages(language);

    // Verify messages are loaded and valid
    if (!messages || Object.keys(messages).length === 0) {
      root.render(
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontSize: '18px',
          color: '#c00',
          textAlign: 'center',
          padding: '20px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <div style={{ fontSize: '24px', marginBottom: '12px', fontWeight: '600' }}>Failed to load translations</div>
          <div style={{ fontSize: '14px', color: '#666', maxWidth: '400px', lineHeight: '1.5' }}>
            Unable to load internationalization data for language: <strong>{language}</strong>.
            <br /><br />
            Please check your internet connection and refresh the page.
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              fontSize: '14px',
              backgroundColor: '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Refresh Page
          </button>
        </div>
      );
      return;
    }

    // Only render once, with messages already loaded
    root.render(<AppWithI18n messages={messages} />);
  } catch (error) {
    root.render(
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#c00',
        textAlign: 'center',
        padding: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>💥</div>
        <div style={{ fontSize: '24px', marginBottom: '12px', fontWeight: '600' }}>Application Error</div>
        <div style={{ fontSize: '14px', color: '#666', maxWidth: '400px', lineHeight: '1.5' }}>
          An unexpected error occurred while loading the application.
        </div>
        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: '20px',
            padding: '10px 20px',
            fontSize: '14px',
            backgroundColor: '#0066cc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Refresh Page
        </button>
      </div>
    );
  }
}

mountApp();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

serviceWorkerRegistration.register();
