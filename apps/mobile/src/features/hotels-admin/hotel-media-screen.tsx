import { useState, type ReactNode } from "react";
import { useRouter } from "expo-router";
import type { UseQueryResult } from "@tanstack/react-query";

import { useAddHotelPhoto, useDeleteMedia, useHotelMedia, useStaffHotel } from "@ampm/api-client";
import { isAppError, type MediaAssetPage, type MediaAssetView } from "@ampm/core";
import {
  Button,
  Card,
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

import { ConfirmSheet } from "../admin/confirm-sheet";
import { HotelProfileEditSheet } from "./hotel-profile-edit-sheet";
import { MediaEditSheet } from "./media-edit-sheet";
import { MediaRow } from "./media-row";
import { pickImageFile } from "./pick-image-file";

/** The add / edit / delete orchestration for the photo manager, kept out of the view. */
function useMediaManager(hotelId: string) {
  const toast = useToast();
  const add = useAddHotelPhoto(hotelId);
  const remove = useDeleteMedia(hotelId);
  const [editing, setEditing] = useState<MediaAssetView | null>(null);
  const [deleting, setDeleting] = useState<MediaAssetView | null>(null);
  const addPhoto = async (): Promise<void> => {
    if (add.isPending) return;
    const picked = await pickImageFile();
    if (!picked) {
      toast.show({ title: "Add photos from the web workspace", tone: "info" });
      return;
    }
    add.mutate(
      { file: picked.file, mimeType: picked.mimeType, sizeBytes: picked.sizeBytes },
      {
        onSuccess: () => toast.show({ title: "Photo added", tone: "success" }),
        onError: (error) =>
          toast.show({
            title: isAppError(error) ? error.message : "Could not add the photo",
            tone: "danger",
          }),
      },
    );
  };
  const confirmDelete = (): void => {
    if (!deleting || remove.isPending) return;
    const name = deleting.caption ?? "Photo";
    remove.mutate(deleting.id, {
      onSuccess: () => {
        toast.show({ title: `${name} removed`, tone: "success" });
        setDeleting(null);
      },
      onError: () => toast.show({ title: "Could not remove the photo", tone: "danger" }),
    });
  };
  return {
    addPhoto,
    adding: add.isPending,
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
          title: "Sign in to manage photos",
          description: "Your session has ended. Sign in again to continue.",
        }}
      />
    );
  }
  if (media.data.items.length === 0) {
    return (
      <EmptyState
        icon="image"
        title="No photos yet"
        description="Add photos to show this hotel in client discovery."
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

/** The hotel screen's header actions: edit the profile (once it has loaded) and add a photo. */
function HotelScreenActions({
  canEdit,
  adding,
  onEdit,
  onAddPhoto,
}: {
  readonly canEdit: boolean;
  readonly adding: boolean;
  readonly onEdit: () => void;
  readonly onAddPhoto: () => void;
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
        onPress={onAddPhoto}
        testID="media-add"
      >
        Add photo
      </Button>
    </Row>
  );
}

/** The confirm shown before a photo is removed from the hotel. */
function DeletePhotoConfirm({ manager }: { readonly manager: MediaManager }) {
  return (
    <ConfirmSheet
      open={manager.deleting !== null}
      onClose={manager.cancelDelete}
      title={
        manager.deleting ? `Remove ${manager.deleting.caption ?? "this photo"}?` : "Remove photo?"
      }
      description="This removes the photo from the hotel. It will no longer appear to clients."
      confirmLabel="Remove photo"
      destructive
      loading={manager.deletePending}
      onConfirm={manager.confirmDelete}
      testID="media-remove"
    />
  );
}

/** A link from the photo manager to the hotel's rooms, venues and contacts workspace. */
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

export interface HotelMediaScreenProps {
  readonly hotelId: string;
  readonly tabBar?: ReactNode;
}

/**
 * The hotel photo manager (H1.1): add photos (register → upload → fail-closed scan), caption them and
 * set who sees them and their rights. A scan-clean, client-visible, rights-cleared photo shows in the
 * client's hotel gallery automatically. Hotel team and Super Admin only, gated server-side.
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
      tabBar={tabBar}
      header={
        <ScreenHeader
          eyebrow={hotel.data?.name ?? "Hotel"}
          title="Photos"
          trailing={
            <HotelScreenActions
              canEdit={hotel.data !== undefined}
              adding={manager.adding}
              onEdit={() => setEditingProfile(true)}
              onAddPhoto={() => void manager.addPhoto()}
            />
          }
        />
      }
    >
      <Stack gap={4}>
        <HotelDetailsLink hotelId={hotelId} />
        <MediaBody media={media} onEdit={manager.startEdit} onDelete={manager.startDelete} />
      </Stack>
      <HotelProfileEditSheet
        open={editingProfile}
        hotel={hotel.data ?? null}
        onClose={() => setEditingProfile(false)}
      />
      <MediaEditSheet hotelId={hotelId} media={manager.editing} onClose={manager.closeEdit} />
      <DeletePhotoConfirm manager={manager} />
    </Screen>
  );
}
