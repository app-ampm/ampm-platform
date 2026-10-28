import { z } from "zod";

/**
 * Configuration, not code (api.md): plans, prices, demo limits, labels, templates, thresholds and
 * feature switches are `configurations` rows read through one typed accessor. This registry is the
 * single source of each key's shape and the code's baseline value; a `configurations` row of the
 * same key overrides the baseline, and a row that does not match the shape is refused. Keys are
 * enumerated here (data.md: statuses and keys are code, their values are configuration).
 *
 * @example
 * const { staffMinutes } = await config.get("session.idle_timeouts");
 */

/** Server-side session idle timeouts (security.md: staff 12 h, client 30 d). */
export const sessionIdleTimeouts = z.object({
  staffMinutes: z.number().int().positive(),
  clientMinutes: z.number().int().positive(),
  demoMinutes: z.number().int().positive(),
});
export type SessionIdleTimeouts = z.infer<typeof sessionIdleTimeouts>;

/** Which notification channels are on by default before a person sets a preference. */
export const notificationChannelDefaults = z.object({
  inApp: z.boolean(),
  email: z.boolean(),
  sms: z.boolean(),
  whatsapp: z.boolean(),
  push: z.boolean(),
});
export type NotificationChannelDefaults = z.infer<typeof notificationChannelDefaults>;

/** Feature switches by name; an absent name is off. */
export const featureFlags = z.record(z.string(), z.boolean());
export type FeatureFlags = z.infer<typeof featureFlags>;

/** One registry entry; the helper makes the compiler check the baseline against its own schema. */
function entry<S extends z.ZodType>(
  schema: S,
  baseline: z.infer<S>,
): { schema: S; default: z.infer<S> } {
  return { schema, default: baseline };
}

export const CONFIG_REGISTRY = {
  "session.idle_timeouts": entry(sessionIdleTimeouts, {
    staffMinutes: 12 * 60,
    clientMinutes: 30 * 24 * 60,
    // The demo follows the client window until Q3 decides otherwise.
    demoMinutes: 30 * 24 * 60,
  }),
  "notification.default_channels": entry(notificationChannelDefaults, {
    inApp: true,
    email: true,
    sms: false,
    whatsapp: false,
    push: false,
  }),
  "feature.flags": entry(featureFlags, {}),
};

/** A known configuration key. */
export type ConfigKey = keyof typeof CONFIG_REGISTRY;

/** The typed value behind a configuration key. */
export type ConfigValue<K extends ConfigKey> = z.infer<(typeof CONFIG_REGISTRY)[K]["schema"]>;

/** Whether a string names a configuration key in the registry (so an unknown key is refused). */
export function isConfigKey(key: string): key is ConfigKey {
  return Object.hasOwn(CONFIG_REGISTRY, key);
}

/** The body of a configuration write; `value` is validated against the key's own schema in the service. */
export const configWriteRequest = z.object({ value: z.unknown() });
export type ConfigWriteRequest = z.infer<typeof configWriteRequest>;

/** A configuration key and its current value, returned by a read or a write. */
export const configView = z.object({ key: z.string(), value: z.unknown() });
export type ConfigView = z.infer<typeof configView>;
