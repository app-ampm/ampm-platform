import { useRouter } from "expo-router";

import { useSavedHotels } from "@ampm/api-client";
import { HOTEL_COMPARE_MIN, type SavedHotelView } from "@ampm/core";
import { Card, cn, Link, Skeleton, Stack } from "@ampm/ui";

import { EntryPanel } from "./entry-panel";
import { HOME_PANEL } from "./home-panel.styles";
import { PanelHeading } from "./panel-heading";
import { SavedCompactRow } from "./saved-compact-row";

/** Four at most — the home is a preview; the full shortlist is one tap away (CP-06). */
const PREVIEW_LIMIT = 4;

interface SavedPreviewProps {
  readonly className?: string | undefined;
}

/**
 * The most recent saved hotels on the home (CP-01, B16; "My selection" in P2 and D4): compact rows on one
 * glass panel, with links to the full shortlist (CP-06) and to compare the previewed hotels. While it loads
 * it shows a skeleton; empty or on an error it falls back to the "Saved hotels" prompt, so the home always
 * offers a way into the shortlist.
 */
export function SavedPreview({ className }: SavedPreviewProps) {
  const saved = useSavedHotels({ limit: PREVIEW_LIMIT });
  if (saved.isPending) return <SavedPreviewLoading className={className} />;
  if (saved.isError || saved.items.length === 0)
    return <SavedPreviewPrompt className={className} failed={saved.isError} />;
  return <SavedPreviewPanel items={saved.items} className={className} />;
}

function SavedPreviewPanel({
  items,
  className,
}: {
  readonly items: readonly SavedHotelView[];
  readonly className?: string | undefined;
}) {
  const router = useRouter();
  const ids = items.map((item) => item.hotel.id).join(",");
  // The rows are nested in the panel, so they are hairline rows, not glass (styling.md).
  return (
    <Card padding="sm" className={cn(HOME_PANEL, className)} testID="saved-preview">
      <PanelHeading title="My selection">
        <Link href="/hotels/saved" variant="standalone" tone="body" textVariant="label">
          See all
        </Link>
        {items.length >= HOTEL_COMPARE_MIN ? (
          <Link
            href={{ pathname: "/hotels/compare", params: { ids } }}
            variant="standalone"
            textVariant="label"
            accessibilityLabel="Compare these hotels"
          >
            Compare →
          </Link>
        ) : null}
      </PanelHeading>
      {items.map((item) => (
        <SavedCompactRow
          key={item.id}
          item={item}
          onOpen={() => router.push({ pathname: "/hotels/[id]", params: { id: item.hotel.id } })}
        />
      ))}
    </Card>
  );
}

/** Empty or failed: the shortlist link as the familiar "My selection" panel, so the home always has a way in. */
function SavedPreviewPrompt({
  className,
  failed,
}: {
  readonly className?: string | undefined;
  readonly failed: boolean;
}) {
  const router = useRouter();
  return (
    <EntryPanel
      heading="My selection"
      title="Saved hotels"
      subtitle={
        failed ? "Open your shortlist." : "Save a hotel from discovery to build your shortlist."
      }
      icon="heart"
      onPress={() => router.push("/hotels/saved")}
      className={className}
    />
  );
}

function SavedPreviewLoading({ className }: SavedPreviewProps) {
  // The Skeletons are hidden from assistive tech, so the Card announces the load itself (as the sibling
  // portal loaders do) — otherwise a screen reader meets an empty, silent region (WCAG 4.1.3).
  return (
    <Card
      padding="sm"
      accessible
      accessibilityLabel="Loading saved hotels"
      className={cn("gap-3 md:p-6", className)}
      testID="saved-preview-loading"
    >
      <Skeleton className="h-6 w-32" />
      <Stack gap={2}>
        <Skeleton className="h-10 w-full rounded" />
        <Skeleton className="h-10 w-full rounded" />
      </Stack>
    </Card>
  );
}
