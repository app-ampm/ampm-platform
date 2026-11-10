import type { PickedImage } from "./pick-image-file";

export type { PickedImage } from "./pick-image-file";

/**
 * Pick one image on the web through a hidden file input (the staff workspace is the Expo web export).
 * Resolves with the chosen file, or null if none was picked. The input is clicked inside the caller's
 * press handler so the browser treats it as a user gesture.
 */
export function pickImageFile(): Promise<PickedImage | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
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
