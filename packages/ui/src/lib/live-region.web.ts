/** The page's one polite live region, found again by id after the first announcement. */
export const LIVE_REGION_ID = "ampm-live-region";

/**
 * A region's first message waits this long: Safari skips text written into a region it has only
 * just been given. Later messages go straight in.
 */
export const FIRST_MESSAGE_DELAY_MS = 100;

/** Messages leave the region after this long, so it never holds a backlog for whoever comes next. */
export const MESSAGE_LIFETIME_MS = 7000;

/** Off screen but read: a live region hidden with display none or visibility hidden is not spoken. */
const VISUALLY_HIDDEN = "web:sr-only";

function liveRegion(doc: Document): { readonly node: HTMLElement; readonly isNew: boolean } {
  const existing = doc.getElementById(LIVE_REGION_ID);
  if (existing) return { node: existing, isNew: false };
  const node = doc.createElement("div");
  node.id = LIVE_REGION_ID;
  // A log: polite, and each addition is read on its own (not the whole region again).
  node.setAttribute("role", "log");
  node.setAttribute("aria-live", "polite");
  node.setAttribute("aria-relevant", "additions");
  node.className = VISUALLY_HIDDEN;
  doc.body.appendChild(node);
  return { node, isNew: true };
}

/**
 * Speaks `message` politely on the web. Screen readers speak a change inside a live region that is
 * already on the page; a region inserted together with its text is not reliably spoken (MDN, ARIA
 * live regions), and that is how a toast or an offline banner appears. So every polite notice writes
 * into one region kept in the page (created on first use, outside React, so the server-rendered
 * markup never changes) instead of carrying its own. Each message is a new line, so the same words
 * twice are still a change.
 *
 *   announcePolitely("Offline. 3 updates queued. They sync when signal returns.");
 */
export function announcePolitely(message: string): void {
  const doc = globalThis.document;
  if (!doc?.body || message.length === 0) return;
  const { node, isNew } = liveRegion(doc);
  const write = () => {
    const line = doc.createElement("div");
    line.textContent = message;
    node.appendChild(line);
    setTimeout(() => line.remove(), MESSAGE_LIFETIME_MS);
  };
  if (isNew) setTimeout(write, FIRST_MESSAGE_DELAY_MS);
  else write();
}
