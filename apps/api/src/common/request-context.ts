import { AsyncLocalStorage } from "node:async_hooks";

import type { Scope } from "@ampm/policy";

import type { Principal } from "../policy/principal.types.js";

/** What PermissionGuard allowed (step 4): the key and the scope its grant reaches, for step 5. */
export interface Access {
  readonly key: string;
  readonly scope: Scope;
}

/**
 * A hotel-form contributor acting through the form (D-189 §5 and §6), on a request no AMPM user signed:
 * their request and, once they entered a correct code, their person (`hotel_info_request_people`); before
 * that, the code challenge they claimed with (`hotel_info_request_challenges`). Ids only.
 */
export type HotelFormActor =
  | { readonly requestId: string; readonly personId: string }
  | { readonly requestId: string; readonly challengeId: string };

/** What every log line, audit event and error response can reach without being passed around. */
export interface RequestContext {
  readonly requestId: string;
  readonly ip: string | null;
  principal: Principal | null;
  access: Access | null;
  /** The `jti` of the access token AuthGuard verified: the session that sign-out ends (D-142). */
  tokenId?: string;
  /**
   * Who acts on a hotel form request: set by the form's session guard and code routes through
   * `requestContext.setHotelFormActor`, never by a header. AuditService then records guest_token.
   */
  hotelFormActor?: HotelFormActor;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The actor's ids, each checked to be one, so what someone typed can never become an actor_ref. */
function checkedActor(actor: HotelFormActor): HotelFormActor {
  const ids = Object.values(actor);
  if (!ids.every((id) => typeof id === "string" && UUID.test(id))) {
    throw new Error("A hotel-form actor is made of record ids only");
  }
  return actor;
}

/**
 * The audit's `actor_ref` of a hotel-form actor (D-189 §1): `hir:<requestId>/person:<personId>`, or
 * `hir:<requestId>/challenge:<challengeId>` before a person exists.
 *
 * @example
 * hotelFormActorRef({ requestId, personId }); // "hir:0196…/person:0196…"
 */
export function hotelFormActorRef(actor: HotelFormActor): string {
  return "personId" in actor
    ? `hir:${actor.requestId}/person:${actor.personId}`
    : `hir:${actor.requestId}/challenge:${actor.challengeId}`;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const requestContext = {
  run<T>(context: RequestContext, fn: () => T): T {
    return storage.run(context, fn);
  },
  get(): RequestContext | undefined {
    return storage.getStore();
  },
  requestId(): string | undefined {
    return storage.getStore()?.requestId;
  },
  principal(): Principal | null {
    return storage.getStore()?.principal ?? null;
  },
  access(): Access | null {
    return storage.getStore()?.access ?? null;
  },
  /** The hotel-form actor of this request, or null when no one acts through the form. */
  hotelFormActor(): HotelFormActor | null {
    return storage.getStore()?.hotelFormActor ?? null;
  },
  /**
   * Makes a hotel-form contributor this request's actor (D-189 §6): from then on its audits record
   * `guest_token`, no user and the actor's `actor_ref`. Throws outside a request, where no audit could
   * carry it, and for anything but record ids.
   *
   * @example
   * requestContext.setHotelFormActor({ requestId: request.id, challengeId: challenge.id });
   */
  setHotelFormActor(actor: HotelFormActor): void {
    const store = storage.getStore();
    if (!store) throw new Error("A hotel-form actor can be set only inside a request");
    store.hotelFormActor = checkedActor(actor);
  },
};
