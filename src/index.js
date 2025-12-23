import React from "react";
import { createRoot } from "react-dom/client";
import { Provider as ReduxProvider } from "react-redux";
import { IntlProvider } from "react-intl";
import { HelmetProvider } from "react-helmet-async";

import reportWebVitals from "./reportWebVitals";
import * as serviceWorkerRegistration from "./serviceWorkerRegistration";
import { App } from "./App";
import store from "./store";

import English from "./i18n/en.json";
import German from "./i18n/de.json";
import Spanish from "./i18n/es.json";
import French from "./i18n/fr.json";
import Italian from "./i18n/it.json";
import Polish from "./i18n/pl.json";
import Chinese from "./i18n/cn.json";

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

let messages;
if (language === "de") {
  messages = German;
} else if (language === "es") {
  messages = Spanish;
} else if (language === "fr") {
  messages = French;
} else if (language === "it") {
  messages = Italian;
} else if (language === "pl") {
  messages = Polish;
} else if (language === "cn") {
  messages = Chinese;
} else {
  messages = English;
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
  root.render(
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

mountApp();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

serviceWorkerRegistration.register();
