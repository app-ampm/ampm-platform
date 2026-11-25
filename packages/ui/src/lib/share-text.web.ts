/**
 * The browser's share sheet (the Web Share API: phones' browsers, Safari, Edge), or null where the
 * browser has none, such as Firefox on a desktop, so the caller offers no Share button rather than one
 * that fails. The text itself goes to the sheet: never a `wa.me` link (hotel form plan §4.2). Resolves
 * false when the person cancels or the browser refuses: nothing was shared.
 */
function browserShare(): ((text: string) => Promise<boolean>) | null {
  if (typeof navigator === "undefined" || typeof navigator.share !== "function") return null;
  return async (text) => {
    try {
      await navigator.share({ text });
      return true;
    } catch {
      return false;
    }
  };
}

/**
 * Shares text through the browser's share sheet, where it has one.
 *
 * @example
 * const shared = await shareText?.(url);
 */
export const shareText: ((text: string) => Promise<boolean>) | null = browserShare();
