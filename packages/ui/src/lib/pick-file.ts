/**
 * A file someone picked to upload: its bytes (a Blob on web) and what an upload step needs to know.
 *
 * @example
 * const picked: PickedFile | null = await pickFile("application/pdf");
 */
export interface PickedFile {
  readonly file: Blob;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly name: string;
}

/**
 * Pick one file to upload, constrained to `accept` (a file-input accept string such as "image/*",
 * "video/*" or "application/pdf,image/jpeg"). The web override (`pick-file.web.ts`) opens a file input;
 * this default (native, and the type-check target) returns null — the staff workspace is the web export,
 * and a native picker is a follow-up, so a caller tells the user to use the web workspace rather than fail.
 * Call it inside the press handler, so the browser treats the file dialog as a user gesture. The server
 * still types the bytes by content; `accept` only narrows the dialog.
 *
 * @example
 * const picked = await pickFile("image/*,video/*");
 * if (!picked) toast.show({ title: "Add media from the web workspace", tone: "info" });
 */
export function pickFile(_accept: string): Promise<PickedFile | null> {
  return Promise.resolve(null);
}
