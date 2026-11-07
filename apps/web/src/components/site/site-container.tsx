import type { ReactNode } from "react";

import { cn } from "@ampm/ui/styles";

import { siteColumnStyles, siteGutterStyles } from "./site.styles";

export interface SiteContainerProps {
  readonly children: ReactNode;
  /** Classes for the column (gaps, padding top and bottom); the gutter and width are fixed. */
  readonly className?: string | undefined;
}

/**
 * A page's content column: the phone gutter (16), 40 on a tablet, 80 on a desktop, centred at 1280
 * (the 1440 mock less its gutters). `relative`, so it paints over the page's GlowOrbs.
 *
 *   <SiteContainer className="gap-14 pt-14 md:gap-32 md:pt-28">…sections…</SiteContainer>
 */
export function SiteContainer({ children, className }: SiteContainerProps) {
  return (
    <div className={cn("relative", siteGutterStyles)}>
      <div className={cn(siteColumnStyles, className)}>{children}</div>
    </div>
  );
}
