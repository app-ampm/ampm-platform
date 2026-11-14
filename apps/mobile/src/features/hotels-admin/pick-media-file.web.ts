import type { PickedFile } from "./pick-media-file";

export type { PickedFile } from "./pick-media-file";

/**
 * Pick one file on the web through a hidden file input (the staff workspace is the Expo web export),
 * constrained to `accept` (a file-input accept string such as "image/*" or "video/*"). Resolves with the
 * chosen file, or null if none was picked. The input is clicked inside the caller's press handler so the
 * browser treats it as a user gesture.
 */
export function pickMediaFile(accept: string): Promise<PickedFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0] ?? null;
      resolve(
        file
          ? {
              file,
              mimeType: file.type || "application/octet-stream",
              sizeBytes: file.size,
              name: file.name,
            }
          : null,
      );
    };
    input.click();
  });
}
