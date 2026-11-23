import type {
  DestinationCreateRequest,
  DestinationUpdateRequest,
  DestinationView,
  HotelStatus,
} from "@ampm/core";

import { textOrNull } from "./hotel-form-fields";

/*
 * The destination editor's draft (TW-20): the text the form holds, its validation and the requests it
 * builds. The slug is set once, on create (blank lets the server make it from the name), and never sent
 * on an edit, since it cannot change. No rendering, no I/O.
 */

/** The field matrix's bounds (`destinations`), as the contract enforces them. */
const TEXT_MAX = 255;
const DESCRIPTION_MAX = 10_000;
/** Lowercase words joined by single hyphens: the contract's slug rule. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** A new destination's country until someone changes it, as the API defaults it. */
const DEFAULT_COUNTRY = "India";

export interface DestinationDraft {
  readonly name: string;
  readonly slug: string;
  readonly region: string;
  readonly state: string;
  readonly country: string;
  readonly description: string;
  readonly status: HotelStatus;
  readonly publicVisible: boolean;
}

/** One message per text field, undefined when it is fine. */
export type DestinationErrors = {
  readonly [K in "name" | "slug" | "region" | "state" | "country" | "description"]:
    string | undefined;
};

/** An edit starts from the destination's values; a new one starts as a draft in India, unpublished. */
export function draftFromDestination(destination: DestinationView | null): DestinationDraft {
  return {
    name: destination?.name ?? "",
    slug: destination?.slug ?? "",
    region: destination?.region ?? "",
    state: destination?.state ?? "",
    country: destination?.country ?? DEFAULT_COUNTRY,
    description: destination?.description ?? "",
    status: destination?.status ?? "draft",
    publicVisible: destination?.publicVisible ?? false,
  };
}

function tooLong(value: string, max: number, what: string): string | undefined {
  return value.trim().length > max
    ? `Keep the ${what} under ${max.toLocaleString("en-IN")} characters`
    : undefined;
}

function requiredText(value: string, missing: string, what: string): string | undefined {
  return value.trim() === "" ? missing : tooLong(value, TEXT_MAX, what);
}

/** A typed slug must follow the contract's rule; a blank one is fine (the server makes it). */
function slugError(value: string): string | undefined {
  const slug = value.trim();
  if (slug === "") return undefined;
  if (slug.length > TEXT_MAX) return tooLong(slug, TEXT_MAX, "web address");
  return SLUG_PATTERN.test(slug)
    ? undefined
    : "Use lowercase letters, numbers and single hyphens, e.g. north-goa";
}

/** `isNew` checks the slug too: an edit never sends it. */
export function validateDestination(draft: DestinationDraft, isNew: boolean): DestinationErrors {
  return {
    name: requiredText(draft.name, "Enter the destination's name", "name"),
    slug: isNew ? slugError(draft.slug) : undefined,
    region: tooLong(draft.region, TEXT_MAX, "region"),
    state: tooLong(draft.state, TEXT_MAX, "state"),
    country: requiredText(draft.country, "Enter the country", "country"),
    description: tooLong(draft.description, DESCRIPTION_MAX, "description"),
  };
}

/** Every field but the slug, trimmed, blanks as null: what create and edit both send. */
function sharedFields(draft: DestinationDraft): Omit<DestinationCreateRequest, "slug"> {
  return {
    name: draft.name.trim(),
    region: textOrNull(draft.region),
    state: textOrNull(draft.state),
    country: draft.country.trim(),
    description: textOrNull(draft.description),
    status: draft.status,
    publicVisible: draft.publicVisible,
  };
}

/**
 * The create body; the slug only when one was typed.
 *
 * @example
 * buildDestinationCreateBody({ ...draft, name: " Udaipur ", slug: "" }); // { name: "Udaipur", … } without a slug
 */
export function buildDestinationCreateBody(draft: DestinationDraft): DestinationCreateRequest {
  const slug = draft.slug.trim();
  return { ...sharedFields(draft), ...(slug === "" ? {} : { slug }) };
}

/** The edit body: every field the form shows except the slug, which never changes. */
export function buildDestinationUpdateBody(draft: DestinationDraft): DestinationUpdateRequest {
  return sharedFields(draft);
}
