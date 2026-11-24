import {
  documentTypeLabel,
  HOTEL_DOCUMENT_TYPES,
  type HotelDocumentType,
  type HotelDocumentView,
} from "@ampm/core";
import { Button, Input, Row, Sheet, Stack, Text, type PickedFile } from "@ampm/ui";

import { FieldAlert } from "./field-alert";
import { titleHint } from "./document-upload.form";
import { documentSizeText, documentTypeTakes } from "./hotel-documents.format";
import { MediaOptionPicker } from "./media-option-picker";
import { useDocumentUploadForm } from "./use-document-upload-form";

/** What a new document is, and under it what that type takes. */
function TypeField({
  value,
  onChange,
  errorText,
}: {
  readonly value: HotelDocumentType | null;
  readonly onChange: (type: HotelDocumentType) => void;
  readonly errorText: string | undefined;
}) {
  return (
    <Stack gap={2}>
      <MediaOptionPicker
        label="What it is"
        required
        value={value}
        options={HOTEL_DOCUMENT_TYPES}
        optionLabel={documentTypeLabel}
        onChange={onChange}
        errorText={errorText}
        testID="document-upload-type"
      />
      {value ? (
        <Text variant="bodySmall" tone="muted" testID="document-upload-takes">
          {`Takes ${documentTypeTakes(value)}.`}
        </Text>
      ) : null}
    </Stack>
  );
}

/** A new version keeps its document's type: said, not offered. */
function KeptTypeNote({ type }: { readonly type: HotelDocumentType }) {
  return (
    <Stack gap={1} testID="document-upload-kept-type">
      <Text variant="eyebrow" tone="muted">
        Type
      </Text>
      <Text variant="body">{documentTypeLabel(type)}</Text>
      <Text variant="bodySmall" tone="muted">
        {`A new version keeps its type. Takes ${documentTypeTakes(type)}.`}
      </Text>
    </Stack>
  );
}

/** The picked file's name and size with a button to pick or change it, then what is wrong with it. */
function FileField({
  file,
  errorText,
  onChoose,
}: {
  readonly file: PickedFile | null;
  readonly errorText: string | null | undefined;
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
          tone={file ? "primary" : "muted"}
          numberOfLines={1}
          className="flex-1"
          testID="document-upload-filename"
        >
          {file ? `${file.name} · ${documentSizeText(file.sizeBytes)}` : "No file chosen"}
        </Text>
        <Button
          variant="secondary"
          size="sm"
          icon="paperclip"
          accessibilityLabel={file ? "Change the chosen file" : "Select a file to upload"}
          onPress={onChoose}
          testID="document-upload-choose"
        >
          {file ? "Change" : "Select file"}
        </Button>
      </Row>
      {errorText ? <FieldAlert text={errorText} testID="document-upload-error" /> : null}
    </Stack>
  );
}

export interface DocumentUploadSheetProps {
  readonly hotelId: string;
  readonly open: boolean;
  /** The document a new version replaces, or null for a new document. */
  readonly replacing: HotelDocumentView | null;
  readonly onClose: () => void;
}

/**
 * Upload a document to a hotel's library, or a new version of one (D-187 §6): what it is (a new version
 * keeps its type), an optional title (at most 120 characters; a new version starts from the current
 * title and keeps it when left blank, a new document takes its type's name), and the file, picked
 * from the kinds the type takes and checked against its limit before anything is sent. The API types
 * the bytes again and its refusal,
 * a busy server or a 409 shows under the file, the sheet kept open. Mount a fresh one for each opening
 * (a `key`), so an upload still in flight never touches the next.
 */
export function DocumentUploadSheet({
  hotelId,
  open,
  replacing,
  onClose,
}: DocumentUploadSheetProps) {
  const form = useDocumentUploadForm(hotelId, replacing, onClose);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={replacing ? `Replace ${replacing.title}` : "Upload document"}
      size="full"
      testID="document-upload"
      footer={
        <Button
          fullWidth
          loading={form.pending}
          onPress={form.submit}
          testID="document-upload-submit"
        >
          {replacing ? "Upload new version" : "Upload document"}
        </Button>
      }
    >
      <UploadFields form={form} replacing={replacing} />
    </Sheet>
  );
}

/** What a blank title field shows: the title a blank one becomes. */
function titlePlaceholder(
  type: HotelDocumentType | null,
  replacing: HotelDocumentView | null,
): string {
  if (replacing) return replacing.title;
  return type ? documentTypeLabel(type) : "e.g. Banquet menu 2027";
}

/** The sheet's fields: the type (or the kept one), the title, then the file and what is wrong with it. */
function UploadFields({
  form,
  replacing,
}: {
  readonly form: ReturnType<typeof useDocumentUploadForm>;
  readonly replacing: HotelDocumentView | null;
}) {
  const { draft, errors, patch } = form;
  return (
    <Stack gap={4}>
      {replacing ? (
        <KeptTypeNote type={replacing.documentType} />
      ) : (
        <TypeField
          value={draft.type}
          onChange={(type) => patch({ type })}
          errorText={errors.type}
        />
      )}
      <Input
        label="Title"
        value={draft.title}
        onChangeText={(title) => patch({ title })}
        placeholder={titlePlaceholder(draft.type, replacing)}
        helpText={titleHint(draft.type, replacing)}
        errorText={errors.title}
        testID="document-upload-title"
      />
      <FileField
        file={draft.file}
        errorText={form.refusal ?? errors.file}
        onChoose={() => void form.choose()}
      />
    </Stack>
  );
}
