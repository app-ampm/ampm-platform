import { hotelFormSessionToken } from "@ampm/core";

/*
 * The hotel form's link and session in the browser (D-189 §5, §8; plan §4.2). The link's secret arrives
 * in the URL's fragment (`/hotel-form#k=hfl_…`), which never reaches a server or a Referer header. The
 * page moves it out of the address bar at once (history.replaceState), so it is not copied, bookmarked or
 * shown on screen, keeps it in this tab's sessionStorage so a reload still opens the form, and sends it
 * only in POST bodies. The form's session token is kept beside it, and goes only in the Bearer header.
 * Both go when the tab closes; nothing is written to localStorage or a cookie.
 */

/** The keys of the tab's link and session in sessionStorage. */
export const LINK_KEY = "ampm.hotel-form.link";
export const SESSION_KEY = "ampm.hotel-form.session";

/** The part of sessionStorage the page uses; any call may throw where the browser refuses storage. */
export type SessionStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** The browser the link handling reads and changes, handed in so tests can stand in for it. */
export interface LinkHost {
  readonly location: Pick<Location, "hash" | "pathname" | "search">;
  readonly history: Pick<History, "state" | "replaceState">;
  /** The tab's sessionStorage, or null where the browser refuses it. */
  readonly storage: SessionStore | null;
}

function read(storage: SessionStore | null, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(storage: SessionStore | null, key: string, value: string | null): void {
  try {
    if (value === null) storage?.removeItem(key);
    else storage?.setItem(key, value);
  } catch {
    // Storage refused (a private window's quota, a blocked site): the page keeps the value in memory.
  }
}

/**
 * The secret in a fragment (`#k=…`), or null when there is none.
 *
 * @example
 * linkFromHash("#k=hfl_abc"); // "hfl_abc"
 */
export function linkFromHash(hash: string): string | null {
  const secret = new URLSearchParams(hash.replace(/^#/, "")).get("k");
  return secret === null || secret === "" ? null : secret;
}

/**
 * The link this tab opens: the one in the address bar, which is then moved out of it and kept for the
 * tab (a different link than the one kept drops the old link's session), or else the one kept from
 * before a reload. Null when the tab has neither.
 *
 *   const secret = takeLink(browserLinkHost());
 */
export function takeLink(host: LinkHost): string | null {
  const fromAddress = linkFromHash(host.location.hash);
  if (fromAddress === null) return read(host.storage, LINK_KEY);
  host.history.replaceState(host.history.state, "", host.location.pathname + host.location.search);
  if (read(host.storage, LINK_KEY) !== fromAddress) write(host.storage, SESSION_KEY, null);
  write(host.storage, LINK_KEY, fromAddress);
  return fromAddress;
}

/** The tab's form session, when one is kept and reads as a session token. */
export function storedSession(storage: SessionStore | null): string | null {
  const kept = read(storage, SESSION_KEY);
  return kept !== null && hotelFormSessionToken.safeParse(kept).success ? kept : null;
}

/** Keeps the session a code opened, for this tab only. */
export function keepSession(storage: SessionStore | null, sessionToken: string): void {
  write(storage, SESSION_KEY, sessionToken);
}

/** Forgets the tab's session: signed out, ended or refused. */
export function forgetSession(storage: SessionStore | null): void {
  write(storage, SESSION_KEY, null);
}

/** The tab's sessionStorage, or null where reading it throws (storage blocked for the site). */
function tabStorage(): SessionStore | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * The real browser, for the page; call it only in the browser (an effect), never while rendering on
 * the server.
 */
export function browserLinkHost(): LinkHost {
  return { location: window.location, history: window.history, storage: tabStorage() };
}
