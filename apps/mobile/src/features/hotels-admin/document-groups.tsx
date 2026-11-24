import type { HotelDocumentView } from "@ampm/core";
import { Divider, Stack } from "@ampm/ui";

import { DocumentRow, type DocumentRowProps } from "./document-row";
import { documentGroups } from "./hotel-documents.format";
import { SubresourceSection } from "./subresource-section";

export interface DocumentGroupsProps extends Omit<DocumentRowProps, "document"> {
  readonly documents: readonly HotelDocumentView[];
}

/**
 * A hotel's documents grouped by type, in the library's order (fact sheets, food menus, beverage menus,
 * floor plans, other documents): each group a titled section of rows, newest first, a divider between
 * each. Only the types that have a document; the screen shows the empty state when none has.
 */
export function DocumentGroups({ documents, ...rowProps }: DocumentGroupsProps) {
  return (
    <Stack gap={6} testID="documents-groups">
      {documentGroups(documents).map((group) => (
        <SubresourceSection
          key={group.type}
          title={group.heading}
          isEmpty={false}
          emptyText=""
          testID={`documents-${group.type}`}
        >
          {group.documents.map((document, index) => (
            <Stack key={document.id} gap={3}>
              {index > 0 ? <Divider /> : null}
              <DocumentRow document={document} {...rowProps} />
            </Stack>
          ))}
        </SubresourceSection>
      ))}
    </Stack>
  );
}
