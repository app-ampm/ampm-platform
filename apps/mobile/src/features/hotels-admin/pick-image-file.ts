/** A file the staff picked to upload: its bytes (a Blob on web) and the metadata the register step needs. */
export interface PickedImage {
  readonly file: Blob;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly name: string;
}

/**
 * Pick one image file to upload. The web override (`pick-image-file.web.ts`) opens a file input; this
 * default (native, and the type-check target) returns null — the staff workspace is the web export, and
 * a native picker via expo-image-picker is a follow-up, so the screen tells the user to use the web
 * workspace rather than fail.
 */
export function pickImageFile(): Promise<PickedImage | null> {
  return Promise.resolve(null);
}
