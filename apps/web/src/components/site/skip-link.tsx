import { buttonLabelStyles, buttonStyles, cn } from "@ampm/ui/styles";

import { SITE_COPY } from "./site-copy";

/** The id of the root layout's <main>, the skip link's target. */
export const MAIN_ID = "main";

/**
 * "Skip to content": the first stop for the keyboard, hidden until it has focus, so a keyboard user
 * can pass the top bar. It shows as a glass pill in the top-left corner.
 */
export function SkipLink() {
  return (
    <a
      href={`#${MAIN_ID}`}
      className={cn(
        buttonStyles({ variant: "glass", size: "sm" }),
        "sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-toast focus:px-5 focus:py-2",
      )}
    >
      <span className={buttonLabelStyles({ variant: "glass", size: "sm" })}>
        {SITE_COPY.skipToContent}
      </span>
    </a>
  );
}
