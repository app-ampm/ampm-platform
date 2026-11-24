/*
 * @ampm/core: pure TypeScript shared by the apps and the API; no React, no I/O (code.md).
 */

export { clientAmount, formatAmount, internalAmount } from "./money";
export type { ClientAmount, Currency, InternalAmount } from "./money";
export {
  isIsoDate,
  isoDateTimeFromDate,
  moneyFromRupees,
  rupeesFromMinor,
  rupeesToMinor,
} from "./forms";
export { RATE_ITEM_TYPES, rateItemTypeLabel, ratePercentLabel } from "./labels";
export { COUPLE_PERSON_NAME_MAX, coupleSubtitle, coupleTitle } from "./couple";
export type { CoupleNames } from "./couple";
export {
  INDIA_POSTAL_CODE,
  isGoogleMapsUrl,
  MAPS_URL_MAX_LENGTH,
  normalisePostalCode,
  postalCodeProblem,
} from "./hotel-location";
export {
  areaWrite,
  hasAtMostDecimals,
  SQM_PER_SQFT_DENOMINATOR,
  SQM_PER_SQFT_NUMERATOR,
  sqmFromSqft,
} from "./hotel-units";
export type { AreaWrite, HotelAreaPair } from "./hotel-units";
export { HOTEL_PHONE_REFUSAL, normaliseHotelPhone } from "./hotel-phone";
// HotelChangeSet (D-178, D-181): the normalisers, the field compare and the row matching the imports and
// the form's merge share.
export {
  canonicalFieldsJson,
  fieldChanges,
  normaliseEmail,
  normaliseRowName,
  normaliseUrl,
  normaliseWhitespace,
} from "./hotel-change-set";
export type {
  HotelFieldChangeOptions,
  HotelFieldKind,
  HotelFieldKinds,
  HotelFieldValues,
} from "./hotel-change-set";
// A hotel's web address as a key (D-188 §6): a new-hotel request's proposed-address key and the hints.
export { normaliseWebAddress, WEB_ADDRESS_KEY_MAX_LENGTH, webAddressHost } from "./web-address";
export { matchContact, matchRowsByName } from "./hotel-row-match";
export type {
  HotelContactMatch,
  HotelContactMatchKey,
  HotelContactProbe,
  HotelMatchableContact,
  HotelNamedRow,
  HotelRowMatch,
} from "./hotel-row-match";

export { formatDay, formatDayRange, formatMoment } from "./dates";
export type { DateFormatOptions, DateStyle, DayReading } from "./dates";

export { AppError, ERROR_CODES, errors, isApiFailure, isAppError } from "./errors";
export type { ApiEnvelope, ApiFailure, ApiSuccess, ErrorCode, ErrorDetail } from "./errors";

export { consoleSink, createLogger, createMemoryLogger, redact } from "./logger";
export type { LogEntry, LogFields, LogLevel, LogSink, Logger, LoggerOptions } from "./logger";

export { parseEnv } from "./env";

export * from "./schemas";
export * from "./schemas/upload-refusals"; // why an upload's content is refused, and its message (D-187)

export * from "./offline";

export { createI18n, en } from "./i18n";
export type { Locale } from "./i18n";

export { renderString, renderTemplate } from "./notification/render";
export type {
  ExternalChannel,
  Rendered,
  RenderedContent,
  RenderResult,
} from "./notification/render";
