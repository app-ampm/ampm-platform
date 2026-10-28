import { Injectable } from "@nestjs/common";
import {
  CONFIG_REGISTRY,
  errors,
  type ConfigKey,
  type FeatureFlags,
  type NotificationChannelDefaults,
  type SessionIdleTimeouts,
} from "@ampm/core";

import { ConfigCache } from "./config.cache.js";
import { ConfigRepository } from "./config.repository.js";

/**
 * The one typed accessor for configuration (api.md "configuration, not code"). A `configurations`
 * row overrides the registry's baseline; a row that does not match the key's schema is refused as a
 * server misconfiguration (500). Values are cached five minutes and dropped when a write invalidates
 * the key. Add a key by adding a registry entry in `@ampm/core` and an overload here.
 *
 * @example
 * const { staffMinutes } = await this.config.get("session.idle_timeouts");
 */
@Injectable()
export class ConfigService {
  private readonly cache = new ConfigCache();

  constructor(private readonly repository: ConfigRepository) {}

  get(key: "session.idle_timeouts"): Promise<SessionIdleTimeouts>;
  get(key: "notification.default_channels"): Promise<NotificationChannelDefaults>;
  get(key: "feature.flags"): Promise<FeatureFlags>;
  async get(key: ConfigKey): Promise<unknown> {
    const cached = this.cache.get(key);
    const raw = cached !== undefined ? cached : await this.load(key);
    const parsed = CONFIG_REGISTRY[key].schema.safeParse(raw);
    if (!parsed.success) {
      throw errors.internal(`Configuration "${key}" is malformed`);
    }
    return parsed.data;
  }

  /** Drops a key from the cache; the configuration write path (sprint 5) calls this after a change. */
  invalidate(key: ConfigKey): void {
    this.cache.invalidate(key);
  }

  private async load(key: ConfigKey): Promise<unknown> {
    const row = await this.repository.findByKey(key);
    const raw = row ? row.valueJson : CONFIG_REGISTRY[key].default;
    this.cache.set(key, raw);
    return raw;
  }
}
