/*
 * The Invite a new hotel sheet's words for the proposed hotel (D-188 §7, D-192), in one place: the
 * website field, optional since D-192 and called the hotel website so it is never mistaken for AMPM's own
 * page address (a destination's "Web address"), and the warning of a live invite of the same name.
 */

export const inviteHotelCopy = {
  websiteLabel: "Hotel website",
  websiteHelp:
    "Optional. If you know it, AMPM can tell whether this hotel is already invited or in the catalogue.",
  websitePlaceholder: "https://www.hotel.example",
  /** Under the warning: a name is not proof, so the warning never blocks. */
  liveRequestsNote: "Two hotels can share a name: check it, then send this one if it is another.",
  testRequest: "Test request",
} as const;

/**
 * The warning's heading: how many live invites have the name typed in the destination chosen.
 *
 * @example
 * liveRequestsHeading(1, "Jaisalmer"); // "1 live invite already has this name in Jaisalmer"
 */
export function liveRequestsHeading(count: number, destinationName: string): string {
  const invites = count === 1 ? "1 live invite already has" : `${count} live invites already have`;
  return `${invites} this name in ${destinationName}`;
}
