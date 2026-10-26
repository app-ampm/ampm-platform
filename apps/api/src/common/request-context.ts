import { AsyncLocalStorage } from "node:async_hooks";

import type { Principal } from "../policy/principal.types.js";

/** What every log line, audit event and error response can reach without being passed around. */
export interface RequestContext {
  readonly requestId: string;
  readonly ip: string | null;
  principal: Principal | null;
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
};
