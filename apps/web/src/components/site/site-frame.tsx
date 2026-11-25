import type { ReactNode } from "react";

import { ChatPill } from "./chat-pill";
import { RouteFooter } from "./route-footer";
import { SiteHeader } from "./site-header";
import { MAIN_ID, SkipLink } from "./skip-link";

/**
 * The marketing site's frame around a page: the skip link, the glass top bar, the page in <main>, the
 * footer (the home page's full one, the compact one elsewhere) and the chat pill floating over it. The
 * frame is `relative` so a page's GlowOrbs light it from the bar to the footer, and `scroll-pt-28` on
 * <html> keeps in-page links clear of the sticky bar. The (site) group's layout draws it around every
 * marketing page, and the not-found page around itself; the hotel form has a frame of its own.
 *
 *   <SiteFrame>{children}</SiteFrame>
 */
export function SiteFrame({ children }: { readonly children: ReactNode }) {
  return (
    <>
      <SkipLink />
      <div className="relative isolate flex min-h-screen flex-col">
        <SiteHeader />
        <main id={MAIN_ID} className="flex flex-1 flex-col">
          {children}
        </main>
        <RouteFooter />
        <ChatPill />
      </div>
    </>
  );
}
