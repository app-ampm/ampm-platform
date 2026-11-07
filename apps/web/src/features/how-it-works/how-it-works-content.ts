import type { GlassCardTone } from "@/components/site";

/*
 * The How it works page's words (PUB-02 + PUB-07), copied from the approved mock
 * (`Peacock Night 1 - Website.dc.html`, W2) and its data script, in one place until the public site's
 * i18n arrives. The plans match AMPM's decisions: hotel discovery is a one-month subscription of
 * Rs 50,000 and renewal is a new purchase (A-3); the demo shows three locations with one real hotel
 * each at indicative prices (decision log, 26 October 2026).
 */

export interface StagePlan {
  readonly number: string;
  readonly title: string;
  /**
   * The subscription's price. AMPM can change it in settings (A-3), so this copy changes with it;
   * the later stages have no list price.
   */
  readonly price?: string | undefined;
  /** How the stage is paid for. */
  readonly terms: string;
  readonly youGet: readonly string[];
  readonly ampmDoes: readonly string[];
  /** The panels run base glass, gold glass, peacock glass, like the home page's stages. */
  readonly tone: GlassCardTone;
}

export const STAGE_PLANS: readonly StagePlan[] = [
  {
    number: "01",
    title: "Hotel discovery",
    price: "₹50,000",
    terms: "One month from the day it activates. Renewal is a new purchase.",
    youGet: [
      "Search and filter 200 hotels",
      "Venues, rooms, menus and photographs",
      "Indicative rates with the date they were checked",
      "Save, compare and enquire",
    ],
    ampmDoes: [
      "Refreshes seasonal rates through the year",
      "Checks availability with the property when you ask",
      "Marks any rate that has gone stale",
    ],
    tone: "glass",
  },
  {
    number: "02",
    title: "Hotel assistance",
    terms:
      "Availability checks are included. Negotiation, site visits, contract review and booking help are by agreement.",
    youGet: [
      "Availability for your dates, from the property",
      "Negotiated proposals",
      "Site visits arranged",
      "Booking milestones tracked",
    ],
    ampmDoes: [
      "Talks to the hotel for you",
      "Records every quote and proposal",
      "Brings each proposal to you to approve",
    ],
    tone: "gold",
  },
  {
    number: "03",
    title: "Complete management",
    terms: "A management fee agreed with AMPM, separate from the subscription.",
    youGet: [
      "Functions, venues and the programme",
      "Vendor options to shortlist and select",
      "Designs, menus and invitations to approve",
      "Guest list, RSVP, rooms and transport",
    ],
    ampmDoes: [
      "Runs every vendor and the budget",
      "Keeps both family representatives in the loop",
      "Runs the day, then closes the accounts",
    ],
    tone: "peacock",
  },
];

/** The comparison's columns, one per stage, in the stages' order. */
export const COMPARISON_STAGES = ["Discovery", "Assistance", "Management"] as const;

export interface ComparisonRow {
  readonly label: string;
  /** Whether discovery, assistance and management include it, in the columns' order. */
  readonly included: readonly [boolean, boolean, boolean];
}

export const COMPARISON_ROWS: readonly ComparisonRow[] = [
  { label: "Search 200 hotels with dated rates", included: [true, true, true] },
  { label: "Save, compare and enquire", included: [true, true, true] },
  { label: "Availability checks with the property", included: [true, true, true] },
  { label: "Negotiation and site visits", included: [false, true, true] },
  { label: "Proposals to approve", included: [false, true, true] },
  { label: "Functions, vendors and designs", included: [false, false, true] },
  { label: "Guests, RSVP, rooms and transport", included: [false, false, true] },
  { label: "A team on the wedding day", included: [false, false, true] },
];

/** Screen readers hear these in place of the ✓ and — marks. */
export const COMPARISON_MARK_LABELS = { included: "Included", excluded: "Not included" } as const;

/** How the demo works, in order. */
export const DEMO_STEPS: readonly string[] = [
  "Sign in with your mobile number once AMPM authorises you",
  "Explore three destinations, one real hotel in each",
  "See indicative prices and street view",
  "Book a 15–20 minute Zoom walkthrough if you'd like one",
];

/** The three locations inside the demo, each with one real hotel. */
export const DEMO_DESTINATIONS: readonly string[] = ["Udaipur", "Jaipur", "Goa"];
export const DEMO_DESTINATION_DETAIL = "1 hotel · indicative prices · street view";
export const DEMO_SAMPLE_WEDDING = "Plus a sample wedding, so you can see the planning side.";

export interface FaqItem {
  readonly question: string;
  readonly answer: string;
}

export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    question: "What happens when my month ends?",
    answer:
      "Your saved hotels and your enquiries stay readable. Nothing is deleted, and renewing brings everything back.",
  },
  {
    question: "Who creates my account?",
    answer:
      "AMPM does, after we've spoken. You'll get an invitation, sign in with your mobile number, add a few wedding details and pay by card or UPI.",
  },
  {
    question: "Are the prices final?",
    answer:
      "They're indicative ranges, each with the date we last checked it. For your dates, ask for availability and the hotel team confirms with the property.",
  },
];
