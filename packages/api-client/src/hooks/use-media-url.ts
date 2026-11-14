import { useApiClient } from "../provider";

/**
 * The resolver that turns a signed media URL (`/media/blob?…`) into one an `<Image>` can load — absolute,
 * against the API base, so it reaches the API (served under `/_api` on the test box) rather than the app's
 * own origin, where the SPA shell would answer instead of the picture. See {@link ApiClient.mediaUrl}. The
 * returned function is stable (the client is memoised), so call it for a single url or map it over a list.
 */
export function useMediaUrl(): (url: string | null | undefined) => string | null {
  return useApiClient().mediaUrl;
}
