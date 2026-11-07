"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn, type TextVariant } from "@ampm/ui/styles";

import { SITE_NAV_LINKS, isCurrentPath } from "./site-links";
import { navLinkStyles } from "./site.styles";

export interface NavLinksProps {
  /** Classes for the list: its direction, gaps and visibility. */
  readonly className?: string | undefined;
  /** The links' type: Manrope 15 in the bar (default), Gilda in the phone menu. */
  readonly textVariant?: TextVariant | undefined;
  /** Runs before a link navigates (the phone menu closes itself). */
  readonly onNavigate?: (() => void) | undefined;
}

/**
 * The five site pages (W1): pearl 80%, gold under the pointer; the page on screen is pearl with a gold
 * underline and `aria-current="page"`. A client component only to read the current path.
 */
export function NavLinks({ className, textVariant, onNavigate }: NavLinksProps) {
  const pathname = usePathname();
  return (
    <ul className={cn("flex items-center gap-6 xl:gap-8", className)}>
      {SITE_NAV_LINKS.map(({ href, label }) => {
        const isCurrent = isCurrentPath(pathname, href);
        return (
          <li key={href}>
            <Link
              href={href}
              aria-current={isCurrent ? "page" : undefined}
              onClick={onNavigate}
              className={navLinkStyles({ isCurrent, textVariant })}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
