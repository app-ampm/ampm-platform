/**
 * The offline banner on peacock glass (offline-safe): a pill with a pearl dot, two lines of text and
 * an optional gold retry at the end. `flex` keeps the row on the web's DOM too.
 *
 *   <div className={cn(glassStyles({ recipe: "peacock" }), offlineBannerStyles)}>…</div>
 */
export const offlineBannerStyles =
  "flex flex-row items-center gap-2.5 self-start rounded-full px-4 py-2.5";

/** The 6px pearl dot, level with the middle of the first line's lowercase letters. */
export const offlineBannerDotStyles = "mt-2 h-1.5 w-1.5 self-start rounded-full bg-primary";
