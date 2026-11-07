import Link from "next/link";

import { cn, linkLabelStyles, linkStyles } from "@ampm/ui/styles";

import { SITE_COPY } from "./site-copy";

export interface WordmarkProps {
  /** Runs before navigating (the phone menu closes itself). */
  readonly onNavigate?: (() => void) | undefined;
  readonly className?: string | undefined;
}

/**
 * "AMPM" in Gilda Display with the wordmark tracking (0.1em) until a logo exists: 18 on a phone, 24
 * on a desktop. It links home and turns gold under the pointer like every link.
 */
export function Wordmark({ onNavigate, className }: WordmarkProps) {
  return (
    <Link
      href="/"
      aria-label={SITE_COPY.home}
      onClick={onNavigate}
      className={cn(
        linkStyles({ variant: "nav" }),
        linkLabelStyles({ variant: "nav", tone: "primary", textVariant: "wordmark" }),
        "self-center text-xl lg:text-2xl",
        className,
      )}
    >
      {SITE_COPY.wordmark}
    </Link>
  );
}
