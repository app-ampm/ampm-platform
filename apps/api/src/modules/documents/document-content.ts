import { CONTENT_KINDS, contentKindOfMimeType } from "@ampm/core";

/*
 * How a stored document is named when it is served (D-187 §5). Its kind was decided from its bytes by
 * the content checks (content/inspect-content.ts) and its `mime_type` is that kind's, so the download's
 * extension is the kind's too, never one the uploader chose. Pure, so the service and its tests share it.
 */

/**
 * A download's file name: a fixed, PII-free stem plus the version and the detected kind's extension.
 *
 * @example
 * downloadFileName("fact_sheet", 2, CONTENT_KINDS.pptx.mimeType); // "fact_sheet-v2.pptx"
 */
export function downloadFileName(stem: string, versionNumber: number, mimeType: string): string {
  const kind = contentKindOfMimeType(mimeType);
  const extension = kind ? CONTENT_KINDS[kind].extension : "bin";
  const version = versionNumber > 1 ? `-v${versionNumber}` : "";
  return `${stem}${version}.${extension}`;
}
