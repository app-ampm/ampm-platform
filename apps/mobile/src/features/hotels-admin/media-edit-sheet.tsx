import { useEffect, useState } from "react";

import { useUpdateMedia } from "@ampm/api-client";
import { isAppError, type MediaAssetView } from "@ampm/core";
import { Button, Sheet, useToast } from "@ampm/ui";

import { MediaDetailsFields, type MediaDraft } from "./media-details-fields";

function draftFrom(media: MediaAssetView | null): MediaDraft {
  return {
    caption: media?.caption ?? "",
    visibility: media?.visibility ?? "internal",
    rights: media?.rightsStatus ?? "consent_required",
  };
}

/** The edit form's state and submission; kept out of the view so each stays small. */
function useMediaEditForm(hotelId: string, media: MediaAssetView | null, onClose: () => void) {
  const toast = useToast();
  const update = useUpdateMedia(hotelId);
  const [draft, setDraft] = useState<MediaDraft>(() => draftFrom(media));
  useEffect(() => {
    if (media) setDraft(draftFrom(media));
  }, [media]);
  const submit = (): void => {
    if (!media || update.isPending) return;
    const label = media.kind === "video" ? "Video" : "Photo";
    update.mutate(
      {
        mediaId: media.id,
        body: {
          caption: draft.caption.trim() || null,
          visibility: draft.visibility,
          rightsStatus: draft.rights,
        },
      },
      {
        onSuccess: () => {
          toast.show({ title: `${label} updated`, tone: "success" });
          onClose();
        },
        // The server enforces GP-20 (client visibility needs cleared rights); surface its message.
        onError: (error) =>
          toast.show({
            title: isAppError(error) ? error.message : `Could not save the ${label.toLowerCase()}`,
            tone: "danger",
          }),
      },
    );
  };
  return {
    draft,
    set: (patch: Partial<MediaDraft>): void => setDraft((prev) => ({ ...prev, ...patch })),
    pending: update.isPending,
    submit,
  };
}

export interface MediaEditSheetProps {
  readonly hotelId: string;
  readonly media: MediaAssetView | null;
  readonly onClose: () => void;
}

/**
 * Edit one photo or video (H1.1): its caption, who can see it and its rights. An asset only reaches clients
 * when its rights are cleared (GP-20, server-enforced); the form warns before a save the server would refuse.
 */
export function MediaEditSheet({ hotelId, media, onClose }: MediaEditSheetProps) {
  const { draft, set, pending, submit } = useMediaEditForm(hotelId, media, onClose);
  return (
    <Sheet
      open={media !== null}
      onClose={onClose}
      title={media?.kind === "video" ? "Edit video" : "Edit photo"}
      size="full"
      testID="media-edit"
      footer={
        <Button fullWidth loading={pending} onPress={submit} testID="media-edit-submit">
          {media?.kind === "video" ? "Save video" : "Save photo"}
        </Button>
      }
    >
      {/* Render the fields only while open, so the option labels don't sit in the tree behind the row. */}
      {media ? <MediaDetailsFields draft={draft} onChange={set} /> : null}
    </Sheet>
  );
}
