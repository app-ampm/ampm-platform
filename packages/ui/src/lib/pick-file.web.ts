import type { PickedFile } from "./pick-file";

export type { PickedFile } from "./pick-file";

/**
 * Pick one file on the web through a hidden file input (the staff workspace is the Expo web export),
 * constrained to `accept`. Resolves with the chosen file, or null if none was picked. The input is
 * clicked inside the caller's press handler so the browser treats it as a user gesture.
 *
 * @example
 * const picked = await pickFile("application/pdf,image/jpeg,image/png");
 */
export function pickFile(accept: string): Promise<PickedFile | null> {
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
