/** A file the staff picked to upload: its bytes (a Blob on web) and the metadata the register step needs. */
export interface PickedFile {
  readonly file: Blob;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly name: string;
}

/**
 * Pick one file to upload, constrained to `accept` (a file-input accept string such as "image/*" or
 * "video/*"). The web override (`pick-media-file.web.ts`) opens a file input; this default (native, and the
 * type-check target) returns null — the staff workspace is the web export, and a native picker via
 * expo-image-picker is a follow-up, so the screen tells the user to use the web workspace rather than fail.
 */
export function pickMediaFile(_accept: string): Promise<PickedFile | null> {
  return Promise.resolve(null);
}
