import { timingSafeEqual } from "node:crypto";

import { Injectable } from "@nestjs/common";
import {
  errors,
  HOTEL_FORM_ERRORS,
  type HotelFormLinkState,
  type HotelFormOpenAnswer,
  type HotelFormPolicy,
} from "@ampm/core";

import { ConfigService } from "../../admin/config/config.service.js";
import { hashLinkSecret } from "../hotel-info-request-link.js";
import { HotelFormRequestsRepository } from "./hotel-form-requests.repository.js";
import { linkClosesAt, linkStateOf, type FormRequest } from "./hotel-form-state.js";

/** A link a code route may act on: the policy as read, the request, and the state it opens to. */
export interface OpenLink {
  readonly policy: HotelFormPolicy;
  readonly request: FormRequest;
  readonly state: Exclude<HotelFormLinkState, "not_active">;
}

/** Whether two hex SHA-256 digests are equal, compared in constant time. */
export function sameDigest(stored: string, computed: string): boolean {
  const a = Buffer.from(stored, "hex");
  const b = Buffer.from(computed, "hex");
  return a.length === 32 && a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The gate of every public hotel form route (D-189 §4): the policy read past the configuration cache, so
 * a mode switched off answers 404 on every route at once; the request found only by the SHA-256 of its
 * link's secret and compared in constant time (D-188 §4); and the state its link opens to.
 */
@Injectable()
export class HotelFormGate {
  constructor(
    private readonly config: ConfigService,
    private readonly requests: HotelFormRequestsRepository,
  ) {}

  /** The form's policy as it stands; 404 while the mode is off. */
  async policy(): Promise<HotelFormPolicy> {
    const policy = await this.config.getFresh("hotel_form.policy");
    if (policy.mode === "off") throw errors.notFound();
    return policy;
  }

  /**
   * `open`'s answer: the state, the link's closing time and AMPM's help contact; nothing about the hotel.
   *
   * @example
   * await gate.open(body.token, new Date()); // { state: "ready", expiresAt, helpContact }
   */
  async open(token: string, now: Date): Promise<HotelFormOpenAnswer> {
    const policy = await this.policy();
    const request = await this.requestFor(token);
    const state = linkStateOf(request, policy.mode, now);
    const expiresAt =
      request !== null && state !== "not_active" ? linkClosesAt(request).toISOString() : null;
    return { state, expiresAt, helpContact: policy.helpContact };
  }

  /** The link a code route acts on; 404 ("not active") unless it opens to the form. */
  async openLink(token: string, now: Date): Promise<OpenLink> {
    const policy = await this.policy();
    const request = await this.requestFor(token);
    const state = linkStateOf(request, policy.mode, now);
    if (request === null || state === "not_active")
      throw errors.notFound(HOTEL_FORM_ERRORS.notActive);
    return { policy, request, state };
  }

  private async requestFor(token: string): Promise<FormRequest | null> {
    const hash = hashLinkSecret(token);
    const row = await this.requests.findByLinkHash(hash);
    if (row === null || !sameDigest(row.tokenHash, hash)) return null;
    const { tokenHash: _stored, ...request } = row;
    return request;
  }
}
