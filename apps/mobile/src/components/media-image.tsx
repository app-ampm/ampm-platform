import { useMediaUrl } from "@ampm/api-client";
import { Image, type ImageProps } from "@ampm/ui";

export interface MediaImageProps extends Omit<ImageProps, "source"> {
  /** The signed media URL from the API (a root-relative `/media/blob?…`), or null/undefined for no image. */
  readonly uri: string | null | undefined;
}

/**
 * An `<Image>` for API-served media (hotel photos, AC-20). The API signs media downloads as a root-relative
 * `/media/blob?…`, and on the test box the API is reached under `/_api`; this resolves the URL against the
 * API base (useMediaUrl) before loading it, so the browser fetches the picture from the API rather than the
 * app's own origin, where the SPA shell would answer instead. Render it only where there is a uri — the
 * caller still shows its own placeholder when there is none.
 */
export function MediaImage({ uri, ...rest }: MediaImageProps) {
  const resolveMediaUrl = useMediaUrl();
  return <Image source={{ uri: resolveMediaUrl(uri) ?? undefined }} {...rest} />;
}
