import { useLayoutAt } from "../layout/use-layout-at";

/**
 * How `SignInLayout` arranges the page: `phone` below 768 (P1: the header, then glass cards), `card`
 * from 768 to 1023 (one centred glass card holding everything; two columns of 384 are too narrow for
 * D1) and `split` from 1024 (D1: the headline column beside the form column).
 */
export type SignInLayoutMode = "phone" | "card" | "split";

/**
 * The arrangement `SignInLayout` uses at the current window, for slot content that changes with it:
 * the headline's size, or a glass card on a phone that is a flat tint once it sits under the form
 * card. A server render knows no window, so it is a phone until the client takes over.
 *
 *   const mode = useSignInLayoutMode();
 *   <ScreenHeader size={mode === "split" ? "hero" : "title"} title="Welcome" emphasis="back." />
 */
export function useSignInLayoutMode(): SignInLayoutMode {
  const isSplit = useLayoutAt("lg");
  const isCard = useLayoutAt("md");
  if (isSplit) return "split";
  return isCard ? "card" : "phone";
}
