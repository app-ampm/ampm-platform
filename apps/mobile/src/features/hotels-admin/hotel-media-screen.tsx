import { useState, type ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import { useDeleteMedia, useHotelMedia, useStaffHotel } from "@ampm/api-client";
import { type MediaAssetPage, type MediaAssetView } from "@ampm/core";
import {
  Button,
  Card,
  ConfirmSheet,
  EmptyState,
  Grid,
  QueryErrorState,
  Screen,
  Skeleton,
  Stack,
  useLayoutAt,
  useToast,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { AddMediaSheet } from "./add-media-sheet";
import { HotelRecordHeader } from "./hotel-record-header";
import { MediaEditSheet } from "./media-edit-sheet";
import { MediaRow } from "./media-row";
import { MediaTile } from "./media-tile";

/** The edit / delete orchestration for the media manager, kept out of the view. */
function useMediaManager(hotelId: string) {
  const toast = useToast();
  const remove = useDeleteMedia(hotelId);
  const [editing, setEditing] = useState<MediaAssetView | null>(null);
  const [deleting, setDeleting] = useState<MediaAssetView | null>(null);
  const confirmDelete = (): void => {
    if (!deleting || remove.isPending) return;
    const noun = deleting.kind === "video" ? "video" : "photo";
    const name = deleting.caption ?? (deleting.kind === "video" ? "Video" : "Photo");
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.show({ title: `${name} removed`, tone: "success" });
        setDeleting(null);
      },
      onError: () => toast.show({ title: `Could not remove the ${noun}`, tone: "danger" }),
    });
  };
  return {
    editing,
    startEdit: (media: MediaAssetView): void => setEditing(media),
    closeEdit: (): void => setEditing(null),
    deleting,
    startDelete: (media: MediaAssetView): void => setDeleting(media),
    cancelDelete: (): void => setDeleting(null),
    confirmDelete,
    deletePending: remove.isPending,
  };
}

function MediaLoading() {
  return (
    <Stack gap={2} testID="media-loading">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </Stack>
  );
}

interface BodyProps {
  readonly media: UseQueryResult<MediaAssetPage>;
  readonly onEdit: (media: MediaAssetView) => void;
  readonly onDelete: (media: MediaAssetView) => void;
}

function MediaBody({ media, onEdit, onDelete }: BodyProps) {
  const goToSignIn = useGoToSignIn();
  if (media.isPending) return <MediaLoading />;
  if (media.isError) {
    return (
      <QueryErrorState
        error={media.error}
        onRetry={() => void media.refetch()}
        onSignIn={goToSignIn}
        signIn={{
          title: "Sign in to manage media",
          description: "Your session has ended. Sign in again to continue.",
        }}
      />
    );
  }
  if (media.data.items.length === 0) {
    return (
      <EmptyState
        icon="image"
        title="No media yet"
        description="Add photos and videos to show this hotel in client discovery."
      />
    );
  }
  return <MediaList items={media.data.items} onEdit={onEdit} onDelete={onDelete} />;
}

/**
 * The hotel's photos and videos: rows on a phone, a grid of tiles from 768 (three across, four from
 * 1024). Rows and tiles hold no state of their own (the editor and the confirm live on the screen), so
 * swapping them when the window crosses 768 loses nothing.
 */
function MediaList({
  items,
  onEdit,
  onDelete,
}: Omit<BodyProps, "media"> & { readonly items: readonly MediaAssetView[] }) {
  const isWide = useLayoutAt("md");
  return (
    <Card testID="media-list">
      {isWide ? (
        <Grid columns={{ md: 3, lg: 4 }} gap={4} testID="media-grid">
          {items.map((item) => (
            <MediaTile key={item.id} media={item} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </Grid>
      ) : (
        <Stack gap={4}>
          {items.map((item) => (
            <MediaRow key={item.id} media={item} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </Stack>
      )}
    </Card>
  );
}

type MediaManager = ReturnType<typeof useMediaManager>;

/**
 * The media manager's gold action: open the add-media modal, where staff choose the file and fill in its
 * caption, visibility and rights before anything is saved (#127).
 */
function AddMediaButton({ onPress }: { readonly onPress: () => void }) {
  return (
    <Button variant="primary" size="sm" icon="plus" onPress={onPress} testID="media-add">
      Add media
    </Button>
  );
}

/** The confirm shown before a photo or video is removed from the hotel. */
function DeleteMediaConfirm({ manager }: { readonly manager: MediaManager }) {
  const noun = manager.deleting?.kind === "video" ? "video" : "photo";
  return (
    <ConfirmSheet
      open={manager.deleting !== null}
      onClose={manager.cancelDelete}
      title={
        manager.deleting ? `Remove ${manager.deleting.caption ?? `this ${noun}`}?` : "Remove media?"
      }
      description="This removes it from the hotel. It will no longer appear to clients."
      confirmLabel={`Remove ${noun}`}
      destructive
      loading={manager.deletePending}
      onConfirm={manager.confirmDelete}
      testID="media-remove"
    />
  );
}

export interface HotelMediaScreenProps {
  readonly hotelId: string;
  readonly tabBar?: ReactNode;
}

/**
 * The add-media sheet with a per-open session key, so each open mounts a fresh sheet — a slow upload still in
 * flight from a previous open can never reset or close the reopened one. Returns the opener + the element.
 */
function useAddSheet(hotelId: string) {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState(0);
  const openSheet = (): void => {
    setSession((value) => value + 1);
    setOpen(true);
  };
  const sheet = (
    <AddMediaSheet key={session} hotelId={hotelId} open={open} onClose={() => setOpen(false)} />
  );
  return { openSheet, sheet };
}

/**
 * The hotel media manager (H1.1): add photos and videos (register → upload → fail-closed scan), caption
 * them and set who sees them and their rights. A scan-clean, client-visible, rights-cleared photo shows in
 * the client's hotel gallery and a video in its Video tab automatically. Hotel team and Super Admin only,
 * gated server-side.
 *
 *   <HotelMediaScreen hotelId={id} tabBar={<AppTabBar />} />
 */
export function HotelMediaScreen({ hotelId, tabBar }: HotelMediaScreenProps) {
  const hotel = useStaffHotel(hotelId);
  const media = useHotelMedia(hotelId);
  const manager = useMediaManager(hotelId);
  const addSheet = useAddSheet(hotelId);
  return (
    <Screen
      width="wide"
      tabBar={tabBar}
      header={
        <HotelRecordHeader
          hotelId={hotelId}
          section="media"
          hotel={hotel.data}
          actions={<AddMediaButton onPress={addSheet.openSheet} />}
        />
      }
    >
      <MediaBody media={media} onEdit={manager.startEdit} onDelete={manager.startDelete} />
      {/* At screen level, outside the rows-or-tiles switch, so an open modal survives a resize. */}
      {addSheet.sheet}
      <MediaEditSheet hotelId={hotelId} media={manager.editing} onClose={manager.closeEdit} />
      <DeleteMediaConfirm manager={manager} />
    </Screen>
  );
}
