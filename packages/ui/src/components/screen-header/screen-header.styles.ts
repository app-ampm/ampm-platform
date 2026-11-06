import { variants, type VariantProps } from "../../lib/variants";

/**
 * A screen's header: the back button on its own row, then the text block (eyebrow, title row,
 * subtitle). The eyebrow sits 6 above the title and the subtitle 12 below it (P1, T1).
 */
export const screenHeaderStyles = variants("flex flex-col gap-4", {
  variants: {
    size: { title: "", display: "md:gap-6" },
  },
  defaultVariants: { size: "title" },
});

export type ScreenHeaderStyleProps = VariantProps<typeof screenHeaderStyles>;
/** title: Gilda 36 for app screens · display: Gilda 64 for wide desktop pages. */
export type ScreenHeaderSize = NonNullable<ScreenHeaderStyleProps["size"]>;

export const screenHeaderTextStyles = "flex flex-col gap-1.5";
/** The title takes the room; a trailing avatar, badge or action keeps its own size at the right. */
export const screenHeaderTitleRowStyles = "flex flex-row items-center justify-between gap-3";
export const screenHeaderSubtitleStyles = "mt-1.5";
