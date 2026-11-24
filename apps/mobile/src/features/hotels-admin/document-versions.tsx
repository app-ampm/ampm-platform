import { useState } from "react";

import type { HotelDocumentVersionView, HotelDocumentView } from "@ampm/core";
import { Button, ListItem, Row, Stack } from "@ampm/ui";

import { versionFacts } from "./hotel-documents.format";
import { OpenDocumentButton } from "./open-document-button";

/** One earlier version: its number, the title it was filed under, its facts, and its own Open. */
function VersionRow({
  hotelId,
  version,
  documentTitle,
}: {
  readonly hotelId: string;
  readonly version: HotelDocumentVersionView;
  readonly documentTitle: string;
}) {
  return (
    <ListItem
      title={`Version ${version.versionNumber}`}
      subtitle={version.title}
      meta={versionFacts(version)}
      trailing={
        <OpenDocumentButton
          hotelId={hotelId}
          versionId={version.id}
          mimeType={version.mimeType}
          name={`version ${version.versionNumber} of ${documentTitle}`}
          variant="ghost"
          testID={`document-version-${version.id}-open`}
        />
      }
      testID={`document-version-${version.id}`}
    />
  );
}

export interface DocumentVersionsProps {
  readonly hotelId: string;
  readonly document: HotelDocumentView;
}

/**
 * A document's earlier versions, newest first, behind a "Show 2 earlier versions" toggle (its state is
 * read out: `aria-expanded`); each opens on its own through a fresh 15-minute link. Nothing for a
 * document with one version.
 */
export function DocumentVersions({ hotelId, document }: DocumentVersionsProps) {
  const [open, setOpen] = useState(false);
  const count = document.versions.length;
  if (count === 0) return null;
  return (
    <Stack gap={2}>
      <Row justify="start">
        <Button
          variant="ghost"
          size="sm"
          icon={open ? "chevron-up" : "chevron-down"}
          aria-expanded={open}
          onPress={() => setOpen((shown) => !shown)}
          testID={`document-${document.id}-versions`}
        >
          {`${open ? "Hide" : "Show"} ${count} earlier ${count === 1 ? "version" : "versions"}`}
        </Button>
      </Row>
      {open
        ? document.versions.map((version) => (
            <VersionRow
              key={version.id}
              hotelId={hotelId}
              version={version}
              documentTitle={document.title}
            />
          ))
        : null}
    </Stack>
  );
}
