import { variants, type VariantProps } from "../../lib/variants";

/**
 * A screen's header: the back button on its own row, then the text block (eyebrow, title row,
 * subtitle). The eyebrow sits 6 above the title and the subtitle 12 below it (P1, T1).
 */
export const screenHeaderStyles = variants("flex flex-col gap-4", {
  variants: {
    size: { title: "", display: "md:gap-6", hero: "md:gap-6" },
  },
  defaultVariants: { size: "title" },
});

export type ScreenHeaderStyleProps = VariantProps<typeof screenHeaderStyles>;
/** title: Gilda 36, 44 from 1024 · display: Gilda 64 for wide desktop pages · hero: 44, 88 from 1024. */
export type ScreenHeaderSize = NonNullable<ScreenHeaderStyleProps["size"]>;

/**
 * The title's size per header size, on top of its Text variant. Desktop page titles are larger than a
 * phone's (T 39, D and C 41–68): a screen title steps up to 44 from 1024. The hero (D1's 86) starts
 * at 44 on a phone, where P1's title is 49, and takes the full 88 from 1024.
 */
export const screenHeaderTitleStyles = variants("", {
  variants: {
    size: { title: "lg:text-5xl", display: "", hero: "text-5xl lg:text-7xl" },
  },
  defaultVariants: { size: "title" },
});

export const screenHeaderTextStyles = variants("flex flex-col gap-1.5", {
  variants: {
    // D1: 22 between the hero title and its lead paragraph.
    size: { title: "", display: "", hero: "lg:gap-5.5" },
  },
  defaultVariants: { size: "title" },
});
/** The title takes the room; a trailing avatar, badge or action keeps its own size at the right. */
export const screenHeaderTitleRowStyles = "flex flex-row items-center justify-between gap-3";
/** The subtitle; a hero's is D1's 18px lead paragraph, a reading line wide at most. */
export const screenHeaderSubtitleStyles = variants("mt-1.5", {
  variants: {
    size: { title: "", display: "", hero: "lg:mt-0 lg:max-w-md lg:text-xl" },
  },
  defaultVariants: { size: "title" },
});
