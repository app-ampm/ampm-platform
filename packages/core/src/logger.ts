/**
 * Structured logging (api.md): one JSON line per event with a level, an event name and fields.
 * Pure: the sink is injected, the default writes to the console so it runs in the browser, on
 * native and on the server. Secrets, tokens and personal data never reach a log: known keys are
 * redacted here, and callers log identifiers, never records.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Readonly<Record<string, unknown>>;

export interface LogEntry {
  readonly level: LogLevel;
  readonly event: string;
  readonly time: string;
  readonly fields: LogFields;
}

export interface Logger {
  debug(event: string, fields?: LogFields): void;
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
  /** A logger that adds these fields to every entry (request id, principal id). */
  child(fields: LogFields): Logger;
}

export type LogSink = (entry: LogEntry) => void;

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

// Compared after normalisation, so the column name (token_hash), the Prisma field (tokenHash) and the
// header (Set-Cookie) of the same value are all caught.
const REDACTED_KEYS: ReadonlySet<string> = new Set([
  "authorization",
  "cookie",
  "setcookie",
  "password",
  "passwordhash",
  "token",
  "accesstoken",
  "refreshtoken",
  "idtoken",
  "secret",
  "apikey",
  "mfasecretref",
  "tokenhash",
  "otp",
  "email",
  "phone",
  "phonenumber",
  "ipaddress",
  "identitysubject",
]);

const normaliseKey = (key: string): string => key.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Replaces the values of keys that must never be logged or audited, at any depth, whatever their
 * case or separator.
 *
 * @example
 * redact({ tokenHash: "abc", nested: { email: "a@b.c", ok: 1 } });
 * // { tokenHash: "[redacted]", nested: { email: "[redacted]", ok: 1 } }
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth]";
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = REDACTED_KEYS.has(normaliseKey(key)) ? "[redacted]" : redact(item, depth + 1);
    }
    return out;
  }
  return value;
}

// Core has no DOM or Node types; the console exists in every runtime the package runs in.
declare const console: {
  log(message: string): void;
  warn(message: string): void;
  error(message: string): void;
};

export const consoleSink: LogSink = (entry) => {
  const line = JSON.stringify(entry);
  if (entry.level === "error") console.error(line);
  else if (entry.level === "warn") console.warn(line);
  else console.log(line);
};

export interface LoggerOptions {
  readonly level?: LogLevel | undefined;
  readonly sink?: LogSink | undefined;
  readonly now?: (() => Date) | undefined;
}

export function createLogger(base: LogFields = {}, options: LoggerOptions = {}): Logger {
  const level = options.level ?? "info";
  const sink = options.sink ?? consoleSink;
  const now = options.now ?? (() => new Date());
  const emit = (entryLevel: LogLevel, event: string, fields: LogFields = {}) => {
    if (LEVEL_ORDER[entryLevel] < LEVEL_ORDER[level]) return;
    sink({
      level: entryLevel,
      event,
      time: now().toISOString(),
      fields: redact({ ...base, ...fields }) as LogFields,
    });
  };
  return {
    debug: (event, fields) => emit("debug", event, fields),
    info: (event, fields) => emit("info", event, fields),
    warn: (event, fields) => emit("warn", event, fields),
    error: (event, fields) => emit("error", event, fields),
    child: (fields) => createLogger({ ...base, ...fields }, { level, sink, now }),
  };
}

/** A logger that records entries for tests. */
export function createMemoryLogger(level: LogLevel = "debug"): {
  logger: Logger;
  entries: LogEntry[];
} {
  const entries: LogEntry[] = [];
  return { logger: createLogger({}, { level, sink: (entry) => entries.push(entry) }), entries };
}
