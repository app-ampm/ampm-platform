/*
 * The words of the site's not-found and error pages, in one place until the public site's i18n
 * arrives. No artboard draws these pages: they take the legal pages' frame (a page heading and one
 * line under the page's glow) with an eyebrow and the kit's buttons.
 */

export const NOT_FOUND_CONTENT = {
  metaTitle: "Page not found · AMPM",
  eyebrow: "Page not found",
  title: "This page",
  emphasis: "isn't here.",
  body: "The link may be out of date, or the page may have moved. Start again from the home page, or tell us what you were looking for.",
  home: "Back to home",
  contact: "Contact us",
} as const;

export const ERROR_CONTENT = {
  metaTitle: "Something went wrong · AMPM",
  eyebrow: "Something went wrong",
  title: "We couldn't load",
  emphasis: "this page.",
  body: "It may be a passing problem. Try again, or start from the home page. If it keeps happening, tell us on the contact page.",
  retry: "Try again",
  home: "Back to home",
} as const;
