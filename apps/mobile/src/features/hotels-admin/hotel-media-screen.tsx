import { useState, type ReactNode } from "react";
import { useRouter } from "expo-router";
import type { UseQueryResult } from "@tanstack/react-query";

import { useDeleteMedia, useHotelMedia, useStaffHotel } from "@ampm/api-client";
import { type MediaAssetPage, type MediaAssetView } from "@ampm/core";
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

import { AddMediaSheet } from "./add-media-sheet";
import { HotelProfileEditSheet } from "./hotel-profile-edit-sheet";
import { MediaEditSheet } from "./media-edit-sheet";
import { MediaRow } from "./media-row";

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
  onEdit,
  onAddMedia,
}: {
  readonly canEdit: boolean;
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
      <Button variant="primary" size="sm" icon="plus" onPress={onAddMedia} testID="media-add">
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
              onEdit={() => setEditingProfile(true)}
              onAddMedia={addSheet.openSheet}
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
      {addSheet.sheet}
      <MediaEditSheet hotelId={hotelId} media={manager.editing} onClose={manager.closeEdit} />
      <DeleteMediaConfirm manager={manager} />
    </Screen>
  );
}
