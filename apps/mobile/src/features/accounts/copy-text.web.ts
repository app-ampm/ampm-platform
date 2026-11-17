/**
 * Copies text with the browser's clipboard. Resolves false when the browser refuses (no permission, or
 * an insecure page where `navigator.clipboard` is missing), so the caller can say to copy it by hand.
 */
export const copyText: ((text: string) => Promise<boolean>) | null = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};
