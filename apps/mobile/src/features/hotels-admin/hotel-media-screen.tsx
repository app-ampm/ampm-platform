import { useState, type ReactNode } from "react";
import type { UseQueryResult } from "@tanstack/react-query";

import { useAddHotelMedia, useDeleteMedia, useHotelMedia, useStaffHotel } from "@ampm/api-client";
import {
  isAppError,
  MAX_MEDIA_UPLOAD_BYTES,
  type MediaAssetPage,
  type MediaAssetView,
  type MediaKind,
} from "@ampm/core";
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

import { HotelRecordHeader } from "./hotel-record-header";
import { MediaEditSheet } from "./media-edit-sheet";
import { MediaRow } from "./media-row";
import { MediaTile } from "./media-tile";
import { pickMediaFile } from "./pick-media-file";

/** Filenames a blank browser MIME still identifies as a video the server can sniff (ISO-BMFF ftyp). */
const VIDEO_FILE = /\.(mp4|m4v|mov)$/i;

/** Pick a photo or video, register it with the kind its content declares, and upload the bytes. */
function useMediaAdder(hotelId: string) {
  const toast = useToast();
  const add = useAddHotelMedia(hotelId);
  const addMedia = async (): Promise<void> => {
    if (add.isPending) return;
    const picked = await pickMediaFile("image/*,video/*");
    if (!picked) {
      toast.show({ title: "Add media from the web workspace", tone: "info" });
      return;
    }
    // Declare the kind from the MIME type or the extension, so a video whose browser type is blank is not
    // sent as an image (which the content sniff would then reject). The server's sniff is the final word.
    const isVideo = picked.mimeType.startsWith("video/") || VIDEO_FILE.test(picked.name);
    const noun = isVideo ? "video" : "photo";
    if (picked.sizeBytes > MAX_MEDIA_UPLOAD_BYTES) {
      const limitMb = MAX_MEDIA_UPLOAD_BYTES / (1024 * 1024);
      toast.show({ title: `This ${noun} is over the ${limitMb} MB limit`, tone: "danger" });
      return;
    }
    const kind: MediaKind = isVideo ? "video" : "image";
    add.mutate(
      { file: picked.file, mimeType: picked.mimeType, sizeBytes: picked.sizeBytes, kind },
      {
        onSuccess: () =>
          toast.show({ title: isVideo ? "Video added" : "Photo added", tone: "success" }),
        onError: (error) =>
          toast.show({
            title: isAppError(error) ? error.message : `Could not add the ${noun}`,
            tone: "danger",
          }),
      },
    );
  };
  return { addMedia, adding: add.isPending };
}

/** The add / edit / delete orchestration for the media manager, kept out of the view. */
function useMediaManager(hotelId: string) {
  const toast = useToast();
  const adder = useMediaAdder(hotelId);
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
    ...adder,
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

/** The media manager's gold action: pick a photo or video and add it to the hotel. */
function AddMediaButton({ manager }: { readonly manager: MediaManager }) {
  return (
    <Button
      variant="primary"
      size="sm"
      icon="plus"
      loading={manager.adding}
      onPress={() => void manager.addMedia()}
      testID="media-add"
    >
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
  return (
    <Screen
      width="wide"
      tabBar={tabBar}
      header={
        <HotelRecordHeader
          hotelId={hotelId}
          section="media"
          hotel={hotel.data}
          actions={<AddMediaButton manager={manager} />}
        />
      }
    >
      <MediaBody media={media} onEdit={manager.startEdit} onDelete={manager.startDelete} />
      <MediaEditSheet hotelId={hotelId} media={manager.editing} onClose={manager.closeEdit} />
      <DeleteMediaConfirm manager={manager} />
    </Screen>
  );
}
