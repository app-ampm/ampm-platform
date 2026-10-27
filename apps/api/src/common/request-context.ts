import { AsyncLocalStorage } from "node:async_hooks";

import type { Scope } from "@ampm/policy";

import type { Principal } from "../policy/principal.types.js";

/** What PermissionGuard allowed (step 4): the key and the scope its grant reaches, for step 5. */
export interface Access {
  readonly key: string;
  readonly scope: Scope;
}

/** What every log line, audit event and error response can reach without being passed around. */
export interface RequestContext {
  readonly requestId: string;
  readonly ip: string | null;
  principal: Principal | null;
  access: Access | null;
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
};
