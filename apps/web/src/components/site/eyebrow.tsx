import type { ReactNode } from "react";

import { cn, textStyles } from "@ampm/ui/styles";

export interface EyebrowProps {
  /** Written in sentence case; the style sets it in capitals. */
  readonly children: ReactNode;
  /** sm: 10 everywhere (cards, captions); md: 10 on a phone, 11 from a tablet (section intros). */
  readonly size?: "sm" | "md" | undefined;
  readonly className?: string | undefined;
}

/**
 * The small tracked label above a heading ("Destination weddings · India"): the kit's `eyebrow` type,
 * Manrope 600 in capitals, tracking 0.22em, pearl 58%.
 *
 *   <Eyebrow size="md">How it works</Eyebrow>
 */
export function Eyebrow({ children, size = "sm", className }: EyebrowProps) {
  return (
    <p
      className={cn(
        textStyles({ variant: "eyebrow", tone: "muted" }),
        size === "md" && "md:text-xs",
        className,
      )}
    >
      {children}
    </p>
  );
}
