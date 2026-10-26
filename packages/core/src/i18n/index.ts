import i18next, { type i18n } from "i18next";

import { en } from "./en";

export type Locale = "en";

/**
 * One i18next instance per app, created once at start-up with the shared `en` namespace; the apps
 * add their own namespaces beside it. Pure: no detection, no backend, the caller picks the locale.
 */
export function createI18n(locale: Locale = "en"): i18n {
  const instance = i18next.createInstance();
  void instance.init({
    lng: locale,
    fallbackLng: "en",
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
    initAsync: false,
  });
  return instance;
}

export { en };
