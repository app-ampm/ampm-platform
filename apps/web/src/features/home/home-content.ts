import type { GlassCardTone } from "@/components/site";

/*
 * The home page's lists (PUB-01), copied from the approved mock's data script and artboards
 * (`Peacock Night 1 - Website.dc.html`, W1 and W8). The selected work and the testimonials are the
 * mock's sample content: AMPM replaces them with its own weddings and its clients' words, with their
 * permission, before the site launches.
 */

export interface Stage {
  readonly number: string;
  readonly title: string;
  /** The desktop card's description (W1). */
  readonly summary: string;
  /** The phone card's shorter line (W8). */
  readonly summaryShort: string;
  /** How the stage is paid for, at the foot of the desktop card. */
  readonly terms: string;
  /** The strip runs base glass, gold glass, peacock glass. */
  readonly tone: GlassCardTone;
}

export const STAGES: readonly Stage[] = [
  {
    number: "01",
    title: "Discover hotels",
    summary:
      "Two hundred hotels across India with venues, rooms, menus and indicative rates, each marked with the date AMPM last checked it.",
    summaryShort: "200 hotels, each rate dated.",
    terms: "Subscription · one month",
    tone: "glass",
  },
  {
    number: "02",
    title: "Hotel assistance",
    summary:
      "We check availability with the property, negotiate, arrange site visits and bring you proposals to approve.",
    summaryShort: "Availability, negotiation and site visits.",
    terms: "Included · or by agreement",
    tone: "gold",
  },
  {
    number: "03",
    title: "Complete management",
    summary:
      "Functions, vendors, designs, guests, rooms, transport and the wedding day itself, run by one team.",
    summaryShort: "Functions, vendors, guests and the day.",
    terms: "Fee agreed with AMPM",
    tone: "peacock",
  },
];

export interface WorkItem {
  readonly title: string;
  readonly meta: string;
  /** What the photo will show, until the media library has it. */
  readonly photo: string;
}

/** The wedding the hero's card shows and the selected work opens with (W1). */
export const FEATURED_WORK: WorkItem = {
  title: "Three days by the lake",
  meta: "Udaipur · 320 guests · 4 functions",
  photo: "Wedding photo · Udaipur",
};

export const SELECTED_WORK: readonly WorkItem[] = [
  FEATURED_WORK,
  {
    title: "A courtyard sangeet",
    meta: "Jaipur · 180 guests · 3 functions",
    photo: "Wedding photo · Jaipur",
  },
  { title: "Vows at sunset", meta: "Goa · 140 guests · 3 functions", photo: "Wedding photo · Goa" },
];

/**
 * How many of the destinations page's list (`features/destinations/destinations-content.ts`, in the
 * mock's order) the home page shows: six in three columns on a desktop (W1), the first four on a phone
 * (W8).
 */
export const HOME_DESTINATION_COUNT = 6;
export const PHONE_DESTINATION_COUNT = 4;

export interface Testimonial {
  readonly quote: string;
  readonly source: string;
  /** The phone's shorter quote and source (W8); a testimonial without them shows on desktop only. */
  readonly phone?: { readonly quote: string; readonly source: string } | undefined;
}

export const TESTIMONIALS: readonly Testimonial[] = [
  {
    quote:
      "We saw every version of the décor before anything was built, and approved each one from our phones.",
    source: "The bride's family · Udaipur · Feb 2026",
  },
  {
    quote:
      "Three hotels side by side, and every price had a date beside it. Choosing took a weekend.",
    source: "The groom's family · Jaipur · Dec 2025",
    phone: {
      quote: "Every price had a date beside it. Choosing took a weekend.",
      source: "The groom's family · Jaipur",
    },
  },
];
