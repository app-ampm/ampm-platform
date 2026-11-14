import { useState } from "react";

import { useAddHotelMedia, type AddHotelMediaInput } from "@ampm/api-client";
import { isAppError, MAX_MEDIA_UPLOAD_BYTES, type MediaKind } from "@ampm/core";
import { Button, Row, Sheet, Stack, Text, useToast } from "@ampm/ui";

import { MediaDetailsFields, type MediaDraft } from "./media-details-fields";
import { pickMediaFile, type PickedFile } from "./pick-media-file";

/** Filenames a blank browser MIME still identifies as a video the server can sniff (ISO-BMFF ftyp). */
const VIDEO_FILE = /\.(mp4|m4v|mov)$/i;
const EMPTY_DRAFT: MediaDraft = { caption: "", visibility: "internal", rights: "consent_required" };

function kindOf(file: PickedFile): MediaKind {
  return file.mimeType.startsWith("video/") || VIDEO_FILE.test(file.name) ? "video" : "image";
}

/** The chosen file's name and kind, or a placeholder when nothing is picked yet. */
function fileLabel(picked: PickedFile | null, kind: MediaKind | null): string {
  return picked ? `${picked.name} · ${kind === "video" ? "Video" : "Photo"}` : "No file chosen";
}

/** The register+upload input from the chosen file and the drafted detail (caption/visibility/rights). */
function inputFrom(picked: PickedFile, kind: MediaKind, draft: MediaDraft): AddHotelMediaInput {
  return {
    file: picked.file,
    mimeType: picked.mimeType,
    sizeBytes: picked.sizeBytes,
    kind,
    caption: draft.caption.trim() || null,
    visibility: draft.visibility,
    rightsStatus: draft.rights,
  };
}

/** Pick a file, enforce the shared size cap, and surface a toast when nothing usable was chosen. */
async function chooseFile(toast: ReturnType<typeof useToast>): Promise<PickedFile | null> {
  const file = await pickMediaFile("image/*,video/*");
  if (!file) {
    toast.show({ title: "Add media from the web workspace", tone: "info" });
    return null;
  }
  if (file.sizeBytes > MAX_MEDIA_UPLOAD_BYTES) {
    const limitMb = MAX_MEDIA_UPLOAD_BYTES / (1024 * 1024);
    toast.show({ title: `This file is over the ${limitMb} MB limit`, tone: "danger" });
    return null;
  }
  return file;
}

/** The add form's state and its register+upload on save; kept out of the view so each stays small. */
function useAddMediaForm(hotelId: string, onClose: () => void) {
  const toast = useToast();
  const add = useAddHotelMedia(hotelId);
  const [picked, setPicked] = useState<PickedFile | null>(null);
  const [draft, setDraft] = useState<MediaDraft>(EMPTY_DRAFT);
  const kind: MediaKind | null = picked ? kindOf(picked) : null;
  const dismiss = (): void => {
    setPicked(null);
    setDraft(EMPTY_DRAFT);
    onClose();
  };
  const submit = (): void => {
    if (!picked || !kind || add.isPending) return;
    const noun = kind === "video" ? "video" : "photo";
    add.mutate(inputFrom(picked, kind, draft), {
      onSuccess: () => {
        toast.show({ title: kind === "video" ? "Video added" : "Photo added", tone: "success" });
        dismiss();
      },
      // The server enforces GP-20 (client visibility needs cleared rights); surface its message.
      onError: (error) =>
        toast.show({
          title: isAppError(error) ? error.message : `Could not add the ${noun}`,
          tone: "danger",
        }),
    });
  };
  return {
    toast,
    picked,
    setPicked,
    kind,
    draft,
    setDraft,
    submit,
    dismiss,
    pending: add.isPending,
  };
}

/** The chosen file's name + kind, with a button to pick or change it. */
function FilePickerRow({
  picked,
  kind,
  onChoose,
}: {
  readonly picked: PickedFile | null;
  readonly kind: MediaKind | null;
  readonly onChoose: () => void;
}) {
  return (
    <Stack gap={2}>
      <Text variant="eyebrow" tone="muted">
        File
      </Text>
      <Row gap={3} align="center" justify="between">
        <Text
          variant="body"
          tone={picked ? "primary" : "muted"}
          numberOfLines={1}
          className="flex-1"
          testID="media-add-filename"
        >
          {fileLabel(picked, kind)}
        </Text>
        <Button
          variant="secondary"
          size="sm"
          icon="upload"
          accessibilityLabel={picked ? "Change the chosen file" : "Select a file to upload"}
          onPress={onChoose}
          testID="media-add-choose"
        >
          {picked ? "Change" : "Select file"}
        </Button>
      </Row>
    </Stack>
  );
}

export interface AddMediaSheetProps {
  readonly hotelId: string;
  readonly open: boolean;
  readonly onClose: () => void;
}

/**
 * Add one photo or video (H1.1): choose a file, then caption it and set who sees it and its rights — all
 * before it is created, so an asset is never registered half-described. On save it is registered with the
 * chosen detail and its bytes uploaded in one go; the GP-20 rights gate is server-enforced.
 */
export function AddMediaSheet({ hotelId, open, onClose }: AddMediaSheetProps) {
  const form = useAddMediaForm(hotelId, onClose);
  const choose = async (): Promise<void> => {
    const file = await chooseFile(form.toast);
    if (file) form.setPicked(file);
  };
  const noun = form.kind === "video" ? "video" : "photo";
  return (
    <Sheet
      open={open}
      onClose={form.dismiss}
      title="Add media"
      size="full"
      testID="media-add-sheet"
      footer={
        <Button
          fullWidth
          disabled={!form.picked}
          loading={form.pending}
          onPress={form.submit}
          testID="media-add-submit"
        >
          {form.picked ? `Add ${noun}` : "Add media"}
        </Button>
      }
    >
      {open ? (
        <Stack gap={4}>
          <FilePickerRow picked={form.picked} kind={form.kind} onChoose={() => void choose()} />
          <MediaDetailsFields
            draft={form.draft}
            onChange={(patch) => form.setDraft((prev) => ({ ...prev, ...patch }))}
          />
        </Stack>
      ) : null}
    </Sheet>
  );
}
