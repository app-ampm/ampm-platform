import { cn } from "../../lib/cn";
import { variants, type VariantProps } from "../../lib/variants";
import { focusRingStyles } from "../glass-panel/glass-panel.styles";
import {
  SINGLE_WEIGHT_VARIANTS,
  textStyles,
  type TextTone,
  type TextVariant,
} from "../text/text.styles";

/**
 * Peacock Night links (docs/design/peacock-night.md §6): gold Manrope 700, often followed by " →" in
 * the caller's copy ("Sign in →"); navigation links are pearl 80% and turn gold on hover.
 *
 *   inline      in running text: gold, underlined (colour alone never marks a link)
 *   standalone  a gold action on its own line with a 44px target
 *   nav         site and workspace navigation: pearl 80%, gold on hover, 44px target
 *
 * The box: the target, the focus border and halo, and `group` so the label turns gold wherever the
 * pointer is over the target. Standalone and nav links carry a transparent 1px stroke for the focus
 * border; inline links take the halo alone so running text does not shift.
 */
export const linkStyles = variants(["group rounded-sm", focusRingStyles], {
  variants: {
    variant: {
      inline: "self-start",
      standalone:
        "flex min-h-touch flex-row items-center gap-1.5 self-start border border-transparent",
      nav: "flex min-h-touch flex-row items-center gap-1.5 self-start border border-transparent",
    },
  },
  defaultVariants: { variant: "inline" },
});

export type LinkVariant = NonNullable<VariantProps<typeof linkStyles>["variant"]>;
export type LinkTone = Extract<TextTone, "brand" | "primary" | "body" | "muted">;

/** Any tone but gold turns gold under the pointer: on the label itself or through the box's group. */
const HOVER_GOLD = "web:hover:text-brand web:group-hover:text-brand";

const linkInk = variants(
  "web:transition-colors web:duration-base web:motion-reduce:transition-none",
  {
    variants: {
      variant: { inline: "underline", standalone: "", nav: "" },
      tone: { brand: "", primary: HOVER_GOLD, body: HOVER_GOLD, muted: HOVER_GOLD },
    },
  },
);

/** Gold for inline and standalone links, pearl 80% for navigation. */
export const linkDefaultTone = {
  inline: "brand",
  standalone: "brand",
  nav: "body",
} as const satisfies Record<LinkVariant, LinkTone>;

/** Manrope 15 unless the caller picks a Text variant. */
export const linkTextVariant = {
  inline: "body",
  standalone: "body",
  nav: "body",
} as const satisfies Record<LinkVariant, TextVariant>;

const LINK_WEIGHT = { inline: "bold", standalone: "bold", nav: "normal" } as const;

export interface LinkLabelStyleProps {
  readonly variant?: LinkVariant | undefined;
  readonly tone?: LinkTone | undefined;
  /** The type the link takes; Manrope 15 by default. Gilda variants keep their single weight. */
  readonly textVariant?: TextVariant | undefined;
}

/**
 * The label's classes: family, size, weight, colour and the hover gold. The website's link is one DOM
 * element, so it takes both recipes:
 *
 *   <a className={cn(linkStyles({ variant: "nav" }), linkLabelStyles({ variant: "nav" }))}>About</a>
 */
export function linkLabelStyles({
  variant = "inline",
  tone,
  textVariant,
}: LinkLabelStyleProps = {}): string {
  const type = textVariant ?? linkTextVariant[variant];
  const ink = tone ?? linkDefaultTone[variant];
  const weight = SINGLE_WEIGHT_VARIANTS.has(type) ? "normal" : LINK_WEIGHT[variant];
  return cn(textStyles({ variant: type, tone: ink, weight }), linkInk({ variant, tone: ink }));
}
