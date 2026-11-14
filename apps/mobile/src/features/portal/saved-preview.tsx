import { useRouter } from "expo-router";

import { useSavedHotels } from "@ampm/api-client";
import type { SavedHotelView } from "@ampm/core";
import { Button, Card, cn, Row, Skeleton, Stack, Text } from "@ampm/ui";

import { HotelCard } from "../hotels/hotel-card";
import { EntryPanel } from "./entry-panel";

/** Four at most — the home is a preview; the full shortlist is one tap away (CP-06). */
const PREVIEW_LIMIT = 4;

interface SavedPreviewProps {
  readonly className?: string | undefined;
}

/**
 * The most recent saved hotels as cards on the home (CP-01, B16), with a link to the full shortlist (CP-06).
 * While it loads it shows a skeleton; empty or on an error it falls back to the "Saved hotels" prompt, so the
 * home always offers a way into the shortlist. Reuses the discovery HotelCard, so each preview carries the
 * same photo, price range and freshness the search cards do (B11).
 */
export function SavedPreview({ className }: SavedPreviewProps) {
  const saved = useSavedHotels({ limit: PREVIEW_LIMIT });
  if (saved.isPending) return <SavedPreviewLoading className={className} />;
  if (saved.isError || saved.items.length === 0)
    return <SavedPreviewPrompt className={className} failed={saved.isError} />;
  return <SavedPreviewCards items={saved.items} className={className} />;
}

function SavedPreviewCards({
  items,
  className,
}: {
  readonly items: readonly SavedHotelView[];
  readonly className?: string | undefined;
}) {
  const router = useRouter();
  // No glass panel around the cards: HotelCard is itself a glass card, and Peacock Night blurs only the
  // top-level panel (styling.md). The previews are the panels, in a plain Stack, as on the search results.
  return (
    <Stack gap={3} className={className}>
      <Row justify="between" align="center">
        <Text variant="subheading">Saved hotels</Text>
        <Button variant="glass" size="sm" icon="heart" onPress={() => router.push("/hotels/saved")}>
          See all
        </Button>
      </Row>
      {items.map((item) => (
        <HotelCard
          key={item.id}
          hotel={item.hotel}
          onPress={() => router.push({ pathname: "/hotels/[id]", params: { id: item.hotel.id } })}
        />
      ))}
    </Stack>
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
      <Skeleton className="h-32 w-full rounded-lg" />
    </Card>
  );
}
