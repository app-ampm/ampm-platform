import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Fills missing variables from apps/api/.env for local runs; CI passes them explicitly. */
export function loadDotEnv(file = join(process.cwd(), ".env")): void {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    const [, key = "", raw = ""] = match;
    const value = raw.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
