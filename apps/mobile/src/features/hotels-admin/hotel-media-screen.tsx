import { useState, type ReactNode } from "react";
import { useRouter } from "expo-router";
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
  QueryErrorState,
  Row,
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
  useToast,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { HotelProfileEditSheet } from "./hotel-profile-edit-sheet";
import { MediaEditSheet } from "./media-edit-sheet";
import { MediaRow } from "./media-row";
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
  return (
    <Card testID="media-list">
      <Stack gap={4}>
        {media.data.items.map((item) => (
          <MediaRow key={item.id} media={item} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </Stack>
    </Card>
  );
}

type MediaManager = ReturnType<typeof useMediaManager>;

/** The hotel screen's header actions: edit the profile (once it has loaded) and add a photo or video. */
function HotelScreenActions({
  canEdit,
  adding,
  onEdit,
  onAddMedia,
}: {
  readonly canEdit: boolean;
  readonly adding: boolean;
  readonly onEdit: () => void;
  readonly onAddMedia: () => void;
}) {
  return (
    <Row gap={2}>
      {canEdit ? (
        <Button variant="secondary" size="sm" onPress={onEdit} testID="hotel-edit-profile">
          Edit profile
        </Button>
      ) : null}
      <Button
        variant="primary"
        size="sm"
        icon="plus"
        loading={adding}
        onPress={onAddMedia}
        testID="media-add"
      >
        Add media
      </Button>
    </Row>
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

/** A link from the media manager to the hotel's rooms, venues and contacts workspace. */
function HotelDetailsLink({ hotelId }: { readonly hotelId: string }) {
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      icon="landmark"
      fullWidth
      onPress={() =>
        router.push({ pathname: "/hotels-admin/[hotelId]/details", params: { hotelId } })
      }
      testID="hotel-details-link"
    >
      Rooms, venues & contacts
    </Button>
  );
}

/** A link from the media manager to the hotel's rate cards workspace. */
function HotelRatesLink({ hotelId }: { readonly hotelId: string }) {
  const router = useRouter();
  return (
    <Button
      variant="secondary"
      icon="receipt"
      fullWidth
      onPress={() =>
        router.push({ pathname: "/hotels-admin/[hotelId]/rates", params: { hotelId } })
      }
      testID="hotel-rates-link"
    >
      Rate cards
    </Button>
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
  const [editingProfile, setEditingProfile] = useState(false);
  return (
    <Screen
      width="wide"
      tabBar={tabBar}
      header={
        <ScreenHeader
          eyebrow={hotel.data?.name ?? "Hotel"}
          title="Media"
          trailing={
            <HotelScreenActions
              canEdit={hotel.data !== undefined}
              adding={manager.adding}
              onEdit={() => setEditingProfile(true)}
              onAddMedia={() => void manager.addMedia()}
            />
          }
        />
      }
    >
      <Stack gap={4}>
        <HotelDetailsLink hotelId={hotelId} />
        <HotelRatesLink hotelId={hotelId} />
        <MediaBody media={media} onEdit={manager.startEdit} onDelete={manager.startDelete} />
      </Stack>
      <HotelProfileEditSheet
        open={editingProfile}
        hotel={hotel.data ?? null}
        onClose={() => setEditingProfile(false)}
      />
      <MediaEditSheet hotelId={hotelId} media={manager.editing} onClose={manager.closeEdit} />
      <DeleteMediaConfirm manager={manager} />
    </Screen>
  );
}
