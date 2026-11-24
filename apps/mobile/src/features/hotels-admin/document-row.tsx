import type { HotelDocumentView } from "@ampm/core";
import { Button, Row, Stack, Text } from "@ampm/ui";

import { DocumentVersions } from "./document-versions";
import { documentMeta, isMenuType } from "./hotel-documents.format";
import { OpenDocumentButton } from "./open-document-button";
import type { DocumentPermissions } from "./use-document-permissions";

export interface DocumentRowProps {
  readonly hotelId: string;
  readonly document: HotelDocumentView;
  readonly permissions: DocumentPermissions;
  readonly onReplace: (document: HotelDocumentView) => void;
  readonly onDelete: (document: HotelDocumentView) => void;
  readonly onStartCard: (document: HotelDocumentView) => void;
}

/** A ghost action of the row; its name for a screen reader also names the document. */
function RowAction({
  label,
  name,
  icon,
  onPress,
  testID,
}: {
  readonly label: string;
  /** "Replace Banquet menu": the label, then the document it acts on. */
  readonly name: string;
  readonly icon: "upload" | "receipt";
  readonly onPress: () => void;
  readonly testID: string;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      icon={icon}
      accessibilityLabel={name}
      onPress={onPress}
      testID={testID}
    >
      {label}
    </Button>
  );
}

/**
 * The document's actions: Open (or Download) for everyone who reads the library, Replace with the create
 * and update grants, and on a menu "Start draft F&B card" with the rate-card create grant.
 */
function DocumentActions(props: Omit<DocumentRowProps, "onDelete">) {
  const { hotelId, document, permissions } = props;
  const testID = `document-${document.id}`;
  return (
    <Row gap={2} wrap>
      <OpenDocumentButton
        hotelId={hotelId}
        versionId={document.id}
        mimeType={document.mimeType}
        name={document.title}
        testID={`${testID}-open`}
      />
      {permissions.canReplace ? (
        <RowAction
          label="Replace"
          name={`Replace ${document.title}`}
          icon="upload"
          onPress={() => props.onReplace(document)}
          testID={`${testID}-replace`}
        />
      ) : null}
      {permissions.canStartFbCard && isMenuType(document.documentType) ? (
        <RowAction
          label="Start draft F&B card"
          name={`Start draft F&B card from ${document.title}`}
          icon="receipt"
          onPress={() => props.onStartCard(document)}
          testID={`${testID}-start-card`}
        />
      ) : null}
    </Row>
  );
}

/**
 * One document of a hotel: its title, its latest version's number, kind, size and day, its actions, and
 * its earlier versions behind a toggle. Delete (every version goes, after a confirm) only for a role
 * that may.
 */
export function DocumentRow(props: DocumentRowProps) {
  const { hotelId, document, permissions, onDelete } = props;
  return (
    <Stack gap={2.5} testID={`document-${document.id}`}>
      <Row gap={3} align="start" justify="between">
        <Stack gap={1} className="flex-1">
          <Text variant="body">{document.title}</Text>
          <Text variant="data" tone="muted">
            {documentMeta(document)}
          </Text>
        </Stack>
        {permissions.canDelete ? (
          <Button
            variant="ghost"
            size="sm"
            icon="trash"
            accessibilityLabel={`Delete ${document.title}`}
            onPress={() => onDelete(document)}
            testID={`document-${document.id}-delete`}
          />
        ) : null}
      </Row>
      <DocumentActions {...props} />
      <DocumentVersions hotelId={hotelId} document={document} />
    </Stack>
  );
}
