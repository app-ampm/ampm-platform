/**
 * Native: nothing to do. iOS speaks through AccessibilityInfo (useAnnounce) and Android through the
 * notices' own live regions; the page-wide live region exists on the web only (live-region.web.ts).
 */
export function announcePolitely(_message: string): void {
  return undefined;
}
