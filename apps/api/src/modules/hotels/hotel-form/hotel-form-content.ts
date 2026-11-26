import { createHash } from "node:crypto";

import { canonicalJson, utf8ByteLength } from "@ampm/core";

import type { Prisma } from "../../../generated/prisma/client.js";

/*
 * How a section's answers and a revision's answers are hashed and measured (D-190 §1 and §3): by their
 * canonical JSON (core `canonicalJson`: keys in order, no whitespace, a member that is null or undefined,
 * or an empty list or object, left out). So a null-valued key and a missing key are one content with one
 * SHA-256, an unchanged save is noticed whatever the page sent, and the site, measuring the same text,
 * agrees with the API on a section's size. A section is stored as that canonical JSON; a revision is
 * stored whole, in the shape core's revision schema reads, and hashes the same.
 */

/** Answers as they are kept: the stored JSON, its SHA-256 and its size. */
export interface CanonicalContent {
  /** The answers as stored (`answers_json`): a section's canonical text read back, or a revision whole. */
  readonly json: Prisma.InputJsonObject;
  /** The SHA-256 of the canonical text's UTF-8, in lower-case hex (`content_hash`, `answers_hash`). */
  readonly hash: string;
  /** The canonical text's UTF-8 bytes, which a section's cap counts. */
  readonly bytes: number;
}

/** The SHA-256 of a text's UTF-8, in lower-case hex. */
export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Answers (an object, as a section's draft or a revision reads them) as they are kept.
 *
 * @example
 * const { json, hash, bytes } = canonicalContentOf(parsedAnswers);
 */
export function canonicalContentOf(answers: object): CanonicalContent {
  const text = canonicalJson(answers);
  const json: Prisma.InputJsonObject = JSON.parse(text);
  return { json, hash: sha256Hex(text), bytes: utf8ByteLength(text) };
}

/**
 * Answers kept whole, every member as read (an empty section's `{}` included), and hashed by their
 * canonical JSON: a revision (D-190 §1), which core's `hotelFormRevisionAnswers` reads back as stored,
 * while its hash is the one the declarations bind to, whichever form it is read in.
 *
 * @example
 * const { json, hash } = wholeContentOf(hotelFormRevisionAnswersOf(sections));
 */
export function wholeContentOf(answers: object): CanonicalContent {
  const text = canonicalJson(answers);
  const json: Prisma.InputJsonObject = JSON.parse(JSON.stringify(answers));
  return { json, hash: sha256Hex(text), bytes: utf8ByteLength(text) };
}
