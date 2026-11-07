import { cn, glassStyles } from "@ampm/ui/styles";

import { ButtonLink } from "./button-link";
import { MobileMenu } from "./mobile-menu";
import { NavLinks } from "./nav-links";
import { SITE_COPY } from "./site-copy";
import { CLIENT_SIGN_IN_URL, DEMO_HREF } from "./site-links";
import { navLinkStyles } from "./site.styles";
import { Wordmark } from "./wordmark";

/** From 1024: client sign-in in pearl 58% and the gold demo request (W1). */
function DesktopActions() {
  return (
    <div className="hidden items-center gap-5 lg:flex">
      <a
        href={CLIENT_SIGN_IN_URL}
        className={navLinkStyles({ tone: "muted", textVariant: "bodySmall" })}
      >
        {SITE_COPY.clientSignIn}
      </a>
      <ButtonLink href={DEMO_HREF} size="sm">
        {SITE_COPY.requestDemo}
      </ButtonLink>
    </div>
  );
}

/** Below 1024: the gold "Demo" pill and the MENU button (W8). */
function PhoneActions() {
  return (
    <div className="flex items-center gap-2 lg:hidden">
      <ButtonLink href={DEMO_HREF} size="sm" aria-label={SITE_COPY.requestDemo} className="px-4">
        {SITE_COPY.demoShort}
      </ButtonLink>
      <MobileMenu />
    </div>
  );
}

/**
 * The site's top bar (W1, W8): a glass pill 24 below the top and 40 in from the sides on a desktop
 * (16 and 16 on a phone) holding the AMPM wordmark, the five pages, client sign-in and the gold
 * "Request a demo"; below 1024 the pages move into the MENU.
 */
export function SiteHeader() {
  return (
    // Sticky: the bar floats at the top of the window while the page scrolls beneath its glass.
    <header className="sticky top-4 z-sticky mx-4 mt-4 md:top-6 md:mx-10 md:mt-6">
      <nav
        aria-label={SITE_COPY.mainNav}
        className={cn(
          glassStyles({ recipe: "base" }),
          "flex items-center justify-between gap-4 rounded-full py-2 pl-4.5 pr-2 lg:py-3 lg:pl-7 lg:pr-3",
        )}
      >
        <Wordmark />
        <NavLinks className="hidden lg:flex" />
        <DesktopActions />
        <PhoneActions />
      </nav>
    </header>
  );
}
