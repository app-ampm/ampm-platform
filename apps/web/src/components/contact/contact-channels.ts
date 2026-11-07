import { INSTAGRAM_URL } from "@/components/site/site-links";

/** Which of AMPM's channels a link opens. */
export type ContactChannelKey = "phone" | "whatsapp" | "email" | "instagram";

/** A way to reach AMPM on the contact page (W6): its name and its address, once AMPM has given it. */
export interface ContactChannel {
  readonly key: ContactChannelKey;
  readonly label: string;
  readonly href: string | null;
}

/** A channel with an address, ready to link. */
export interface ReachableChannel extends ContactChannel {
  readonly href: string;
}

/**
 * AMPM's channels in the mock's order (W6). The design package gives no phone number, WhatsApp
 * number or email address, and a guessed one would send visitors to someone else, so each stays null
 * until AMPM supplies it (`tel:+91…`, `https://wa.me/91…`, `mailto:…`); the page lists only the
 * channels that have one. Instagram follows the footer's INSTAGRAM_URL.
 */
export const CONTACT_CHANNELS: readonly ContactChannel[] = [
  { key: "phone", label: "Call us", href: null },
  { key: "whatsapp", label: "WhatsApp", href: null },
  { key: "email", label: "Email", href: null },
  { key: "instagram", label: "Instagram", href: INSTAGRAM_URL },
];

/** The channels the page can link to now. */
export function reachableChannels(
  channels: readonly ContactChannel[] = CONTACT_CHANNELS,
): readonly ReachableChannel[] {
  return channels.filter((channel): channel is ReachableChannel => channel.href !== null);
}

/**
 * One channel's address once AMPM has given it, else null. A line that promises a channel ("Or
 * message us on WhatsApp", W1; "Chat with AMPM", W7) shows only when there is an address to open.
 *
 *   channelHref("whatsapp") // "https://wa.me/91…", or null until AMPM supplies the number
 */
export function channelHref(
  key: ContactChannelKey,
  channels: readonly ContactChannel[] = CONTACT_CHANNELS,
): string | null {
  return channels.find((channel) => channel.key === key)?.href ?? null;
}
