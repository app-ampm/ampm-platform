import { Injectable } from "@nestjs/common";
import {
  CONFIG_REGISTRY,
  errors,
  isConfigKey,
  type ConfigKey,
  type ConfigView,
  type FeatureFlags,
  type HotelVerificationPolicy,
  type NotificationChannelDefaults,
  type NotificationTemplates,
  type SessionIdleTimeouts,
  type SubscriptionPolicy,
} from "@ampm/core";

import { PrismaService } from "../../../db/prisma.service.js";
import { AuditService } from "../../../policy/audit.service.js";
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

  constructor(
    private readonly repository: ConfigRepository,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  get(key: "session.idle_timeouts"): Promise<SessionIdleTimeouts>;
  get(key: "notification.default_channels"): Promise<NotificationChannelDefaults>;
  get(key: "notification.templates"): Promise<NotificationTemplates>;
  get(key: "feature.flags"): Promise<FeatureFlags>;
  get(key: "subscription.policy"): Promise<SubscriptionPolicy>;
  get(key: "hotel.verification_policy"): Promise<HotelVerificationPolicy>;
  async get(key: ConfigKey): Promise<unknown> {
    const cached = this.cache.get(key);
    const raw = cached !== undefined ? cached : await this.load(key);
    const parsed = CONFIG_REGISTRY[key].schema.safeParse(raw);
    if (!parsed.success) {
      throw errors.internal(`Configuration "${key}" is malformed`);
    }
    return parsed.data;
  }

  /**
   * Writes a configuration value (the audit-on-mutation worked example, D-033/brief §5.5): the value
   * must match the key's registry schema, the row is upserted, the cache is dropped, and the change
   * is audited with its before/after images. A Super Admin only reaches this through the controller.
   */
  async set(key: string, value: unknown): Promise<ConfigView> {
    if (!isConfigKey(key)) throw errors.notFound("Unknown configuration key");
    const parsed = CONFIG_REGISTRY[key].schema.safeParse(value);
    if (!parsed.success) {
      throw errors.validation(
        parsed.error.issues.map((issue) => ({
          path: ["value", ...issue.path].map(String).join("."),
          message: issue.message,
        })),
      );
    }
    // The write and its audit commit together; the cache is dropped only after the transaction commits.
    const result = await this.prisma.$transaction(async (tx) => {
      const before = await this.repository.findByKey(key, tx);
      const row = await this.repository.upsert(key, parsed.data, tx);
      await this.audit.record(
        {
          action: before ? "update" : "create",
          entityType: "configuration",
          entityId: row.id,
          // No prior value means no before image (a create); config values are not PII, so do not mask.
          before: before ? before.valueJson : undefined,
          after: parsed.data,
          maskImages: false,
        },
        tx,
      );
      return { key, value: parsed.data };
    });
    this.cache.invalidate(key);
    return result;
  }

  /** Drops a key from the cache; the write path calls this after a change. */
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
