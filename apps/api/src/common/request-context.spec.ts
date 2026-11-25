import { describe, expect, it } from "vitest";

import {
  hotelFormActorRef,
  requestContext,
  type HotelFormActor,
  type RequestContext,
} from "./request-context.js";

/*
 * The hotel-form actor (D-189 §5 and §6): who acts on a hotel form request when no AMPM user does, set by
 * the form's guard and code routes on the request's context, so its audits record guest_token.
 */

const REQUEST_ID = "0196a0b0-0000-7000-8000-00000000a001";
const PERSON_ID = "0196a0b0-0000-7000-8000-00000000a002";
const CHALLENGE_ID = "0196a0b0-0000-7000-8000-00000000a003";

function inRequest<T>(fn: () => T): T {
  const context: RequestContext = { requestId: "req-1", ip: null, principal: null, access: null };
  return requestContext.run(context, fn);
}

describe("the hotel-form actor", () => {
  it("is none until the form sets it, then the request's own", () => {
    inRequest(() => {
      expect(requestContext.hotelFormActor()).toBeNull();
      requestContext.setHotelFormActor({ requestId: REQUEST_ID, challengeId: CHALLENGE_ID });
      expect(requestContext.hotelFormActor()).toEqual({
        requestId: REQUEST_ID,
        challengeId: CHALLENGE_ID,
      });
      // A correct code makes the person the actor from then on.
      requestContext.setHotelFormActor({ requestId: REQUEST_ID, personId: PERSON_ID });
      expect(requestContext.get()?.hotelFormActor).toEqual({
        requestId: REQUEST_ID,
        personId: PERSON_ID,
      });
    });
    inRequest(() => expect(requestContext.hotelFormActor()).toBeNull());
  });

  it("cannot be set outside a request, where no audit could carry it", () => {
    expect(() =>
      requestContext.setHotelFormActor({ requestId: REQUEST_ID, personId: PERSON_ID }),
    ).toThrow(/request/);
  });

  it("holds ids only, so the audit's actor_ref never carries what someone typed", () => {
    inRequest(() => {
      for (const actor of [
        { requestId: "HIR-2026-0001", personId: PERSON_ID },
        { requestId: REQUEST_ID, personId: "+919000000001" },
        { requestId: REQUEST_ID, challengeId: "Synthetic Person" },
      ]) {
        expect(() => requestContext.setHotelFormActor(actor), JSON.stringify(actor)).toThrow(/id/);
      }
      expect(requestContext.hotelFormActor()).toBeNull();
    });
  });

  it("is a request and exactly one of a person and a challenge, whatever the caller's types say", () => {
    inRequest(() => {
      for (const actor of [
        { requestId: REQUEST_ID, personId: PERSON_ID, challengeId: CHALLENGE_ID },
        { requestId: REQUEST_ID },
        { personId: PERSON_ID },
        { requestId: REQUEST_ID, personId: PERSON_ID, note: "Synthetic Person" },
        { requestId: REQUEST_ID, challengeId: 42 },
      ]) {
        const shaped = actor as unknown as HotelFormActor;
        expect(() => requestContext.setHotelFormActor(shaped), JSON.stringify(actor)).toThrow(/id/);
      }
      expect(requestContext.hotelFormActor()).toBeNull();
    });
  });

  it("is written as hir:<request>/person:<person>, or /challenge:<challenge> before a person exists", () => {
    expect(hotelFormActorRef({ requestId: REQUEST_ID, personId: PERSON_ID })).toBe(
      `hir:${REQUEST_ID}/person:${PERSON_ID}`,
    );
    expect(hotelFormActorRef({ requestId: REQUEST_ID, challengeId: CHALLENGE_ID })).toBe(
      `hir:${REQUEST_ID}/challenge:${CHALLENGE_ID}`,
    );
  });
});
