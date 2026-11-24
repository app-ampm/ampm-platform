/**
 * Hands text to the share sheet where the browser has one (the Web Share API, `share-text.web.ts`),
 * resolving true once shared. A native build offers none here: null, and the caller shows no Share
 * button. Never a `wa.me` link, which hands the whole text to a third party's redirect (hotel form
 * plan §4.2, D-188 §7).
 *
 * @example
 * {shareText ? <Button onPress={() => void shareText(url)}>Share</Button> : null}
 */
export const shareText: ((text: string) => Promise<boolean>) | null = null;
