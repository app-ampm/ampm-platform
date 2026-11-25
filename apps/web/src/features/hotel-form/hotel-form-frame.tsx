import type { ReactNode } from "react";

import { cn, textStyles } from "@ampm/ui/styles";

import { GlowOrbs } from "@/components/site/glow-orbs";
import { siteColumnStyles, siteGutterStyles } from "@/components/site/site.styles";
import { MAIN_ID, SkipLink } from "@/components/site/skip-link";

import { HOTEL_FORM_COPY as COPY } from "./hotel-form-copy";

/**
 * The hotel form's own frame (D-189 §8), apart from the marketing site's: the wordmark as plain text (no
 * link away from the form, no navigation, no chat pill), the step centred in <main> under the page's
 * glow, and one quiet line as the footer. The skip link still leads past the bar to the step.
 *
 *   <HotelFormFrame>{children}</HotelFormFrame>
 */
export function HotelFormFrame({ children }: { readonly children: ReactNode }) {
  return (
    <>
      <SkipLink />
      <div className="relative isolate flex min-h-screen flex-col">
        <GlowOrbs />
        <header className={cn("relative pt-6 md:pt-10", siteGutterStyles)}>
          <div className={cn(siteColumnStyles, "flex-row items-baseline gap-3")}>
            <p className={cn(textStyles({ variant: "wordmark" }), "text-xl lg:text-2xl")}>
              {COPY.wordmark}
            </p>
            <p className={textStyles({ variant: "eyebrow", tone: "muted" })}>{COPY.eyebrow}</p>
          </div>
        </header>
        <main id={MAIN_ID} className={cn("relative flex flex-1 flex-col", siteGutterStyles)}>
          <div className={cn(siteColumnStyles, "items-center pb-14 pt-8 md:pb-24 md:pt-14")}>
            {children}
          </div>
        </main>
        <footer className={cn("relative pb-8", siteGutterStyles)}>
          <p className={cn(siteColumnStyles, textStyles({ variant: "caption", tone: "muted" }))}>
            {COPY.footer}
          </p>
        </footer>
      </div>
    </>
  );
}
