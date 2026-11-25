import { describe, expect, it } from "vitest";

import {
  LINK_KEY,
  SESSION_KEY,
  forgetSession,
  keepSession,
  linkFromHash,
  storedSession,
  takeLink,
  type LinkHost,
  type SessionStore,
} from "./hotel-form-link";

/* The link in the fragment and the session (D-189 §8; plan §4.2): read, moved out of the address bar, kept per tab. */

const SECRET = `hfl_${"x".repeat(43)}`;
const SESSION = `hfs_${"y".repeat(43)}`;

/** sessionStorage as a map. */
function memoryStore(entries: Record<string, string> = {}): SessionStore & {
  readonly entries: Map<string, string>;
} {
  const map = new Map(Object.entries(entries));
  return {
    entries: map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

/** A tab at an address, recording every replaceState and every address its router is told. */
function tab(hash: string, store: SessionStore | null = memoryStore()) {
  const replaced: (string | URL | null | undefined)[] = [];
  const routed: string[] = [];
  const host: LinkHost = {
    location: { hash, pathname: "/hotel-form", search: "" },
    history: { state: null, replaceState: (_data, _unused, url) => void replaced.push(url) },
    storage: store,
    syncRouter: (url) => void routed.push(url),
  };
  return { host, replaced, routed };
}

describe("the link in the fragment", () => {
  it("reads the secret after #k=", () => {
    expect(linkFromHash(`#k=${SECRET}`)).toBe(SECRET);
    expect(linkFromHash(`k=${SECRET}`)).toBe(SECRET);
  });

  it("has no link without one", () => {
    expect(linkFromHash("")).toBeNull();
    expect(linkFromHash("#")).toBeNull();
    expect(linkFromHash("#k=")).toBeNull();
    expect(linkFromHash("#section-2")).toBeNull();
  });
});

describe("taking the link", () => {
  it("moves it out of the address bar and keeps it for the tab", () => {
    const store = memoryStore();
    const { host, replaced } = tab(`#k=${SECRET}`, store);
    expect(takeLink(host)).toBe(SECRET);
    expect(replaced).toEqual(["/hotel-form"]);
    expect(store.entries.get(LINK_KEY)).toBe(SECRET);
  });

  it("drops a session opened with another link: a forwarded or reissued link starts afresh", () => {
    const store = memoryStore({ [LINK_KEY]: "hfl_old", [SESSION_KEY]: SESSION });
    expect(takeLink(tab(`#k=${SECRET}`, store).host)).toBe(SECRET);
    expect(store.entries.has(SESSION_KEY)).toBe(false);
  });

  it("keeps the session when the same link is opened again", () => {
    const store = memoryStore({ [LINK_KEY]: SECRET, [SESSION_KEY]: SESSION });
    takeLink(tab(`#k=${SECRET}`, store).host);
    expect(store.entries.get(SESSION_KEY)).toBe(SESSION);
  });

  it("tells the page's router the address without the link, so a refresh never writes it back", () => {
    const { host, routed } = tab(`#k=${SECRET}`);
    takeLink(host);
    expect(routed).toEqual(["/hotel-form"]);
    const kept = tab("", memoryStore({ [LINK_KEY]: SECRET }));
    takeLink(kept.host);
    expect(kept.routed).toEqual([]);
  });

  it("finds the tab's link after a reload, when the address bar no longer has it", () => {
    const store = memoryStore({ [LINK_KEY]: SECRET });
    const { host, replaced } = tab("", store);
    expect(takeLink(host)).toBe(SECRET);
    expect(replaced).toEqual([]);
  });

  it("has no link in a fresh tab with an empty fragment", () => {
    expect(takeLink(tab("").host)).toBeNull();
  });

  it("still clears the address bar when the browser refuses sessionStorage", () => {
    const refusing: SessionStore = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    };
    const { host, replaced } = tab(`#k=${SECRET}`, refusing);
    expect(takeLink(host)).toBe(SECRET);
    expect(replaced).toEqual(["/hotel-form"]);
    expect(takeLink(tab(`#k=${SECRET}`, null).host)).toBe(SECRET);
  });
});

describe("the session", () => {
  it("is kept for the tab, read back only when it is a session token, and forgotten", () => {
    const store = memoryStore();
    keepSession(store, SESSION);
    expect(storedSession(store)).toBe(SESSION);
    forgetSession(store);
    expect(storedSession(store)).toBeNull();
    store.setItem(SESSION_KEY, "not-a-session");
    expect(storedSession(store)).toBeNull();
    expect(storedSession(null)).toBeNull();
  });
});
