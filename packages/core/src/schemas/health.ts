import { z } from "zod";

/** `GET /health`: liveness for the load balancer and the uptime check (vps-setup part 5). */
export const healthResponse = z.object({
  status: z.enum(["ok", "degraded"]),
  version: z.string(),
  uptimeSeconds: z.number().int().nonnegative(),
  checks: z.object({
    database: z.enum(["ok", "down", "skipped"]),
  }),
});
export type HealthResponse = z.infer<typeof healthResponse>;
