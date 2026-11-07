import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { buttonLabelStyles, buttonStyles, cn, type ButtonSize } from "@ampm/ui/styles";

/** The button looks a link may take on the site; destructive and glass stay with real buttons. */
export type ButtonLinkVariant = "primary" | "secondary" | "highlight" | "ghost";

export interface ButtonLinkProps extends Omit<
  ComponentPropsWithoutRef<"a">,
  "href" | "className" | "children"
> {
  /** A page of the site ("/contact?type=demo") or a full URL. */
  readonly href: string;
  /** The words on the pill. */
  readonly children: ReactNode;
  /** primary (gold, one per screen), secondary (pearl outline), highlight (peacock), ghost. */
  readonly variant?: ButtonLinkVariant | undefined;
  /** sm and md keep the 44px target; lg is 48 tall. */
  readonly size?: ButtonSize | undefined;
  /** Stretch across a column (the phone layout's stacked actions). */
  readonly fullWidth?: boolean | undefined;
  readonly className?: string | undefined;
}

/**
 * A link that looks like the kit's Button (peacock-night.md §6): next/link with `buttonStyles` on the
 * anchor and `buttonLabelStyles` on the words, so the site's pills match the apps' buttons, hover,
 * press and the gold focus halo included.
 *
 *   <ButtonLink href="/contact?type=demo" size="lg">Request a demo</ButtonLink>
 *   <ButtonLink href="/destinations" variant="secondary" size="lg">Explore destinations</ButtonLink>
 */
export function ButtonLink({
  href,
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
  ...rest
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={cn(buttonStyles({ variant, size, fullWidth }), className)}
      {...rest}
    >
      <span className={cn(buttonLabelStyles({ variant, size }), "whitespace-nowrap")}>
        {children}
      </span>
    </Link>
  );
}
