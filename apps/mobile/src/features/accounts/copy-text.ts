/**
 * Copies text where the platform can. Native builds have no clipboard module (expo-clipboard is not a
 * dependency), so there is none: the caller shows the text selectable instead. The web build's copy is
 * in `copy-text.web.ts`.
 */
export const copyText: ((text: string) => Promise<boolean>) | null = null;
