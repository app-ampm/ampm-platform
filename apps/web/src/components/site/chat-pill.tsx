import Link from "next/link";

import { cn, focusRingStyles, glassStyles, textStyles } from "@ampm/ui/styles";

import { SITE_COPY } from "./site-copy";
import { CHAT_HREF } from "./site-links";
import { quietToneOn } from "./site.styles";

/**
 * The floating "Chat with AMPM" pill (W1, W8): gold glass with a gold "online" dot, gold being the
 * colour of what is live (peacock-night.md §1, §3), and "We're online" beside it from a tablet in
 * pearl 80%, the quiet tone gold glass allows. Under the pointer its gold stroke deepens. There is no
 * chat service yet, so it opens the contact page.
 */
export function ChatPill() {
  return (
    <Link
      href={CHAT_HREF}
      className={cn(
        glassStyles({ recipe: "gold" }),
        // Fixed: the pill floats over the bottom-right corner of every page, above the content and
        // below the top bar (whose phone menu covers it).
        "fixed bottom-5 right-4 z-raised flex min-h-touch items-center gap-2.5 rounded-full py-2.5 pl-3.5 pr-4.5",
        "transition-colors duration-base hover:border-brand/70 motion-reduce:transition-none",
        "md:bottom-8 md:right-10 md:gap-3 md:pl-4 md:pr-5",
        focusRingStyles,
      )}
    >
      <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand" />
      <span className={textStyles({ variant: "label" })}>{SITE_COPY.chat}</span>
      <span
        className={cn(
          textStyles({ variant: "caption", tone: quietToneOn("gold") }),
          "hidden md:inline",
        )}
      >
        {SITE_COPY.online}
      </span>
    </Link>
  );
}
