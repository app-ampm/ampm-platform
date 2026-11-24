import { inspectCompoundFile } from "./cfb-office.js";
import type { ContentKind, InspectResult } from "./kinds.js";
import { inspectOoxml } from "./ooxml.js";
import { checkPdf } from "./pdf-check.js";
import { refusePolyglot } from "./polyglot.js";
import { ContentRefusal, refuse } from "./refusal.js";
import { ftypMedia, sniffFamily } from "./sniff.js";

/*
 * The one entry point of the content checks (D-187 §2): what a file is, decided by its bytes, and
 * whether it passes every rule for that kind. Pure: a Buffer in, a kind or a refusal out, no I/O. It is
 * async only because Office packages are inflated as a stream, so a zip bomb never sits in memory.
 * `accepted` is the slot's list (D-187 §3): a kind outside it is refused as a type the slot does not
 * take, before any expensive check runs.
 */

/** The largest file the checks read: the largest cap of any upload (25 MiB). */
export const MAX_INSPECTED_BYTES = 25 * 1024 * 1024;

const RASTER: Readonly<Record<string, ContentKind>> = {
  jpeg: "jpeg",
  png: "png",
  webp: "webp",
  gif: "gif",
};

function acceptedOrRefused(kind: ContentKind, accepted: ReadonlySet<ContentKind>): ContentKind {
  if (!accepted.has(kind)) refuse("type_not_accepted", `a ${kind}`);
  return kind;
}

/** An ISO media file: an MP4 video, or a HEIF or AVIF photo, which no slot takes. */
function inspectFtyp(bytes: Buffer, accepted: ReadonlySet<ContentKind>): ContentKind {
  if (ftypMedia(bytes) === "video") return acceptedOrRefused("mp4", accepted);
  const takesPhotos = accepted.has("jpeg") || accepted.has("png");
  return refuse(takesPhotos ? "heif_image" : "type_not_accepted", "a HEIF or AVIF image");
}

async function kindOf(bytes: Buffer, accepted: ReadonlySet<ContentKind>): Promise<ContentKind> {
  if (bytes.length > MAX_INSPECTED_BYTES) refuse("too_large", `${bytes.length} bytes`);
  const family = sniffFamily(bytes);
  if (family === null) return refuse("unknown_type", "no known signature");
  refusePolyglot(bytes, family);
  switch (family) {
    case "pdf":
      acceptedOrRefused("pdf", accepted);
      checkPdf(bytes);
      return "pdf";
    case "zip":
      return inspectOoxml(bytes, accepted);
    case "cfb":
      return inspectCompoundFile(bytes, accepted);
    case "ftyp":
      return inspectFtyp(bytes, accepted);
    default:
      return acceptedOrRefused(RASTER[family] ?? refuse("unknown_type", family), accepted);
  }
}

/**
 * What `bytes` are, after every content rule, for an upload that takes the `accepted` kinds. A refusal
 * names its reason (the message and status come from `@ampm/core`) and a `detail` for the logs only.
 * Any failure the rules did not foresee is a refusal too: the checks fail closed.
 *
 * @example
 * const result = await inspectContent(body, new Set(["pdf", "pptx", "ppsx", "potx", "ppt"]));
 * if (!result.ok) throw new AppError(uploadRefusalErrorCode(result.reason), UPLOAD_REFUSAL_MESSAGES[result.reason]);
 */
export async function inspectContent(
  bytes: Buffer,
  accepted: ReadonlySet<ContentKind>,
): Promise<InspectResult> {
  try {
    return { ok: true, kind: await kindOf(bytes, accepted) };
  } catch (error) {
    if (error instanceof ContentRefusal) {
      return { ok: false, reason: error.reason, detail: error.detail };
    }
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: "file_damaged", detail: `unexpected: ${message}` };
  }
}
