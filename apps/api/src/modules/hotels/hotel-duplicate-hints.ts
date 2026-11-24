import {
  HOTEL_DUPLICATE_HINTS_MAX,
  hotelDuplicateHintReason,
  normaliseWebAddress,
  webAddressHost,
  type HotelDuplicateHint,
  type HotelDuplicateHintReason,
  type HotelDuplicateHintsQuery,
  type HotelStatus,
} from "@ampm/core";

import type { Prisma } from "../../generated/prisma/client.js";
import { toStringList } from "./hotel-string-lists.js";

/*
 * The duplicate hints of the Invite a new hotel sheet (D-188 §3; plan §4.1): which catalogue hotels a
 * proposed new hotel may already be. A hotel is a hint when its name or one of its name variants matches
 * the name typed, its website is the address typed (core `normaliseWebAddress`: no scheme, `www.`, query
 * or trailing slash), or its website is on the same host. Deleted hotels are hints too: their slug and web
 * address stay taken. Names are compared here rather than in core, as `String.normalize` is not available
 * everywhere core runs (Hermes).
 */

/** A catalogue hotel as the hints read it, deleted ones included. */
export interface HintCandidate {
  readonly id: string;
  readonly name: string;
  readonly status: HotelStatus;
  /** The INTERNAL name variants, a JSON list of strings. */
  readonly nameAliases: Prisma.JsonValue | null;
  readonly website: string | null;
  readonly deletedAt: Date | null;
  readonly destination: { readonly name: string };
}

/** Words any hotel's name may carry, which say nothing about which hotel it is. */
const GENERIC_WORDS: ReadonlySet<string> = new Set([
  "the",
  "and",
  "hotel",
  "hotels",
  "resort",
  "resorts",
  "spa",
  "by",
  "at",
  "of",
  "a",
  "an",
]);

/** The shortest name, its telling words joined, that is compared at all. */
const NAME_MIN_LENGTH = 3;

/** How much each kind of evidence weighs when hints are ordered. */
const WEIGHT = { web_address: 100, name: 50, name_variant: 40, website_host: 10 } as const;
/** A name or variant that only holds, or is held by, the name typed weighs less than an exact one. */
const PARTIAL = 0.4;

/**
 * A name's telling words: canonical decomposition with the accents dropped, lower-case, split on anything
 * that is not a letter or a digit, and the generic words left out.
 *
 * @example
 * nameTokens("The Hôtel Le Café-Bleu & Spa"); // ["le", "cafe", "bleu"]
 */
export function nameTokens(text: string): readonly string[] {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word !== "" && !GENERIC_WORDS.has(word));
}

/** 1 for the same words, PARTIAL when one name's words are all in the other's, else 0. */
function nameScore(typed: readonly string[], candidate: readonly string[]): number {
  if (typed.length === 0 || candidate.length === 0) return 0;
  const typedSet = new Set(typed);
  const candidateSet = new Set(candidate);
  const typedHeld = [...typedSet].every((word) => candidateSet.has(word));
  const candidateHeld = [...candidateSet].every((word) => typedSet.has(word));
  if (typedHeld && candidateHeld) return 1;
  return typedHeld || candidateHeld ? PARTIAL : 0;
}

/** What the hints compare a hotel against: the name's words, the address's key and its host. */
interface Typed {
  readonly words: readonly string[];
  readonly addressKey: string | null;
  readonly host: string | null;
}

function typedOf(query: HotelDuplicateHintsQuery): Typed {
  const words = nameTokens(query.name ?? "");
  const address = query.webAddress ?? "";
  return {
    words: words.join("").length >= NAME_MIN_LENGTH ? words : [],
    addressKey: normaliseWebAddress(address),
    host: webAddressHost(address),
  };
}

/** One hotel's evidence: each reason with its weight. */
function evidenceOf(candidate: HintCandidate, typed: Typed): Map<HotelDuplicateHintReason, number> {
  const evidence = new Map<HotelDuplicateHintReason, number>();
  const name = nameScore(typed.words, nameTokens(candidate.name));
  if (name > 0) evidence.set("name", WEIGHT.name * name);
  const variants = (toStringList(candidate.nameAliases) ?? []).map((variant) =>
    nameScore(typed.words, nameTokens(variant)),
  );
  const variant = Math.max(0, ...variants);
  if (variant > 0) evidence.set("name_variant", WEIGHT.name_variant * variant);
  const website = candidate.website ?? "";
  if (typed.addressKey !== null && normaliseWebAddress(website) === typed.addressKey) {
    evidence.set("web_address", WEIGHT.web_address);
  } else if (typed.host !== null && webAddressHost(website) === typed.host) {
    evidence.set("website_host", WEIGHT.website_host);
  }
  return evidence;
}

/** Whether two or more live hotels have websites on the host: a brand's shared domain. */
function isSharedHost(candidates: readonly HintCandidate[], host: string | null): boolean {
  if (host === null) return false;
  const live = candidates.filter(
    (candidate) => candidate.deletedAt === null && webAddressHost(candidate.website ?? "") === host,
  );
  return live.length >= 2;
}

/**
 * The hints for what staff typed, strongest first (a matching web address, then an exact name, then a
 * name variant, then a host), twenty at most. A hotel on a shared host weighs half as much on that host.
 *
 * @example
 * duplicateHints(candidates, { name: "Lake Palace", webAddress: "lakepalace.example" });
 */
export function duplicateHints(
  candidates: readonly HintCandidate[],
  query: HotelDuplicateHintsQuery,
): HotelDuplicateHint[] {
  const typed = typedOf(query);
  const shared = isSharedHost(candidates, typed.host);
  const scored = candidates.flatMap((candidate) => {
    const evidence = evidenceOf(candidate, typed);
    if (evidence.size === 0) return [];
    const onHost = typed.host !== null && webAddressHost(candidate.website ?? "") === typed.host;
    let score = [...evidence.values()].reduce((sum, weight) => sum + weight, 0);
    if (shared && evidence.has("website_host")) score -= WEIGHT.website_host / 2;
    const hint: HotelDuplicateHint = {
      hotelId: candidate.id,
      name: candidate.name,
      status: candidate.status,
      destinationName: candidate.destination.name,
      website: candidate.website,
      deletedAt: candidate.deletedAt?.toISOString() ?? null,
      reasons: hotelDuplicateHintReason.options.filter((reason) => evidence.has(reason)),
      sharedHost: shared && onHost,
    };
    return [{ hint, score }];
  });
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      a.hint.name.localeCompare(b.hint.name) ||
      a.hint.hotelId.localeCompare(b.hint.hotelId),
  );
  return scored.slice(0, HOTEL_DUPLICATE_HINTS_MAX).map(({ hint }) => hint);
}
