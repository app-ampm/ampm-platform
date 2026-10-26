/**
 * @ampm/core: pure TypeScript shared by the apps and the API; no React, no I/O (code.md).
 */
export const CORE_VERSION = "0.1.0";

export { clientAmount, formatAmount, internalAmount } from "./money";
export type { ClientAmount, Currency, InternalAmount } from "./money";
