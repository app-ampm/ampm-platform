/*
 * The couple a client account is for (Module B CRM): the bride and the groom, each with their father's
 * name. Once both the bride's and the groom's names are given, the couple names the client, so staff read
 * "Priya & Arjun" wherever the client appears rather than the name the lead came in under. Pure, so the
 * API applies the rule on save and the hub shows the same name while it is typed.
 */

/** Each name is capped so "Bride & Groom" fits the 255 characters of the account's name. */
export const COUPLE_PERSON_NAME_MAX = 120;

export interface CoupleNames {
  readonly brideName: string | null;
  readonly groomName: string | null;
}

/**
 * The couple's name for the client ("Priya & Arjun"), or null until both names are given.
 *
 * @example
 * coupleTitle({ brideName: "Priya", groomName: "Arjun" }); // "Priya & Arjun"
 * coupleTitle({ brideName: "Priya", groomName: null }); // null
 */
export function coupleTitle({ brideName, groomName }: CoupleNames): string | null {
  const bride = brideName?.trim() ?? "";
  const groom = groomName?.trim() ?? "";
  return bride !== "" && groom !== "" ? `${bride} & ${groom}` : null;
}

/**
 * The couple line under a client's name: the couple's names when they add to the name, null when there
 * are none or when the name already is the couple's (it would only repeat the title).
 *
 * @example
 * coupleSubtitle({ name: "Sharma family", coupleNames: "Priya & Arjun" }); // "Priya & Arjun"
 * coupleSubtitle({ name: "Priya & Arjun", coupleNames: "Priya & Arjun" }); // null
 */
export function coupleSubtitle({
  name,
  coupleNames,
}: {
  readonly name: string;
  readonly coupleNames: string | null;
}): string | null {
  const couple = coupleNames?.trim() ?? "";
  if (couple === "") return null;
  return couple.toLowerCase() === name.trim().toLowerCase() ? null : couple;
}
