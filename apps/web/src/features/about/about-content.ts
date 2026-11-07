import type { GlassCardTone } from "@/components/site";

/*
 * The about page's words (PUB-05), copied from the approved mock's W5 artboard
 * (`Peacock Night 1 - Website.dc.html`). The team shows roles only: the portraits are placeholders
 * until AMPM supplies the photographs, and no names are given.
 */

export const ABOUT_COPY = {
  eyebrow: "About AMPM",
  title: "One team, from the first call",
  emphasis: "to the last departure.",
  story: [
    "AMPM plans destination weddings in India. We started with hotels: knowing which ones work for a wedding, what they really cost, and who to call.",
    "That knowledge is now a database you can search yourself. When you want more, the same team runs the rest, function by function.",
  ],
  teamTitle: "The people you'll work with",
  portrait: "Portrait",
  ctaTitle: "Start with a conversation.",
  requestDemo: "Request a demo",
  contactUs: "Contact us",
} as const;

export interface Principle {
  readonly title: string;
  readonly body: string;
  /** The row runs base glass, gold glass, peacock glass (W5). */
  readonly tone: GlassCardTone;
}

export const PRINCIPLES: readonly Principle[] = [
  {
    title: "Dated, not guessed",
    body: "Every hotel rate carries the date AMPM last checked it. When a rate is old, we say so.",
    tone: "glass",
  },
  {
    title: "Nothing without your yes",
    body: "Designs, menus, proposals and invitations come to you as versions. You approve the exact version, and it doesn't change after.",
    tone: "gold",
  },
  {
    title: "Ready before it's live",
    body: "No function starts until its checklist is complete, or an authorised manager has signed off an exception.",
    tone: "peacock",
  },
];

export interface TeamRole {
  readonly role: string;
  readonly focus: string;
  /** The portrait placeholders alternate gold and peacock bands (W5). */
  readonly tone: "gold" | "peacock";
}

export const TEAM: readonly TeamRole[] = [
  { role: "Founder", focus: "Keeps the hotel database", tone: "gold" },
  { role: "Hotel team", focus: "Availability, visits, proposals", tone: "peacock" },
  { role: "Production", focus: "Décor, cues and the day", tone: "gold" },
  { role: "Guests and hospitality", focus: "RSVPs, rooms, transfers", tone: "peacock" },
];
