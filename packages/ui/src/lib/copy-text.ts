/**
 * Copies text where the platform can, resolving true once it is on the clipboard. Native builds have no
 * clipboard module (expo-clipboard is not a dependency), so there is none: null, and the caller shows the
 * text selectable instead. The web build's copy is in `copy-text.web.ts`.
 *
 * @example
 * if (copyText) {
 *   const copied = await copyText(url);
 *   toast.show({ title: copied ? "Link copied" : "Could not copy: select the link and copy it" });
 * }
 */
export const copyText: ((text: string) => Promise<boolean>) | null = null;
