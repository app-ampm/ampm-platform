import type { GlassCardTone } from "@/components/site";

/*
 * The Services page's words (PUB-03), copied from the approved mock (`Peacock Night 1 - Website.dc.html`,
 * W3), in one place until the public site's i18n arrives. Every photo is a placeholder until the media
 * library supplies AMPM's own pictures.
 */

export interface Service {
  /** "01": the eyebrow reads "Service 01". */
  readonly number: string;
  readonly title: string;
  readonly description: string;
  /** What the service covers, as the mock's outlined pills. */
  readonly tags: readonly string[];
  /** The gold link to the enquiry form; the arrow is added where it is drawn. */
  readonly enquiry: string;
  /** What the photo will show, as the placeholder's caption and its name for screen readers. */
  readonly photo: string;
  readonly photoTone: "gold" | "peacock";
  /** Base glass, and peacock glass for complete management (the whole service). */
  readonly tone: GlassCardTone;
}

export const SERVICES: readonly Service[] = [
  {
    number: "01",
    title: "Hotel assistance",
    description:
      "You pick the hotels you like; we talk to them. We confirm dates, negotiate, take you round on a site visit and track the booking until it's paid.",
    tags: [
      "Availability checks",
      "Negotiation",
      "Site visits",
      "Contract review",
      "Booking milestones",
    ],
    enquiry: "Enquire about hotel assistance",
    photo: "Site visit photo",
    photoTone: "gold",
    tone: "glass",
  },
  {
    number: "02",
    title: "Design and décor",
    description:
      "Concepts for every function, shared as versions. Pin a comment to the exact spot you want changed, then approve the version you love.",
    tags: ["Concept and mood", "Décor versions", "Invitations", "Pinned comments"],
    enquiry: "Enquire about design",
    photo: "Décor render",
    photoTone: "peacock",
    tone: "glass",
  },
  {
    number: "03",
    title: "Vendor coordination",
    description:
      "Five to ten options for each category, chosen by us. You shortlist and select; we handle the quotes, contracts and deliverables.",
    tags: ["Curated options", "Shortlist and select", "Contracts", "Deliverables"],
    enquiry: "Enquire about vendors",
    photo: "Vendor at work",
    photoTone: "gold",
    tone: "glass",
  },
  {
    number: "04",
    title: "Complete management",
    description:
      "Everything above, plus the guest list, RSVPs, room blocks, transfers and a team on the ground who can work without signal.",
    tags: ["Guests and RSVP", "Rooms and transport", "Run of show", "Closure and archive"],
    enquiry: "Enquire about full management",
    photo: "Wedding day",
    photoTone: "gold",
    tone: "peacock",
  },
];
