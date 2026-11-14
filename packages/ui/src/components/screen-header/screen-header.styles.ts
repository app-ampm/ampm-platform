import { variants, type VariantProps } from "../../lib/variants";

/**
 * A screen's header: the back button on its own row, then the text block (eyebrow, title row,
 * subtitle). The eyebrow sits 6 above the title and the subtitle 12 below it (P1, T1).
 */
export const screenHeaderStyles = variants("flex flex-col gap-4", {
  variants: {
    size: { title: "", display: "md:gap-6", hero: "md:gap-6" },
    // T3: a record's header on its own glass panel, 24 by 28 inside on a desktop.
    variant: { plain: "", panel: "rounded-xl p-5 lg:px-7 lg:py-6" },
  },
  defaultVariants: { size: "title", variant: "plain" },
});

export type ScreenHeaderStyleProps = VariantProps<typeof screenHeaderStyles>;
/** title: Gilda 36, 44 from 1024 · display: Gilda 64 for wide desktop pages · hero: 44, 88 from 1024. */
export type ScreenHeaderSize = NonNullable<ScreenHeaderStyleProps["size"]>;
/** plain (default): on the canvas · panel: on its own glass panel, a record's header (T3). */
export type ScreenHeaderVariant = NonNullable<ScreenHeaderStyleProps["variant"]>;

/**
 * The text block and the actions: stacked on a phone, where the actions wrap under the subtitle; from
 * 768 the actions sit at the right of the whole block, centred on it (T2, T3, T4, T12).
 */
export const screenHeaderBodyStyles = "flex flex-col gap-4 md:flex-row md:items-center md:gap-6";
/**
 * The actions wrap rather than run off the edge: under the title on a phone, and onto a second line
 * at the right from 768 when the title needs its floor (a record's header on a tablet: T3).
 */
export const screenHeaderActionsStyles =
  "flex flex-row flex-wrap items-center gap-2 md:shrink md:justify-end";
/** The title and a status chip read together: the chip follows the title, wrapping under a long one. */
export const screenHeaderTitleGroupStyles =
  "flex flex-1 flex-row flex-wrap items-center gap-x-3 gap-y-1";

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

// From 768 the title keeps 224 however many actions sit beside it, so it never collapses to a letter a line.
export const screenHeaderTextStyles = variants("flex flex-col gap-1.5 md:min-w-56 md:flex-1", {
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
