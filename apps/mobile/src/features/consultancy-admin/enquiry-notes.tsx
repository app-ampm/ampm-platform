import type { HotelEnquiryStaffDetailView } from "@ampm/core";
import { Card, InternalPanel, Stack, Text } from "@ampm/ui";

/** Which side of the thread is shown: T6's All · Client-visible · Internal switch. */
export type ThreadFilter = "all" | "client" | "internal";

/** Whether an item the client does (or does not) see passes the switch. */
export function passesFilter(internalOnly: boolean, filter: ThreadFilter): boolean {
  if (filter === "all") return true;
  return internalOnly === (filter === "internal");
}

type Notes = Pick<HotelEnquiryStaffDetailView, "notesClient" | "notesInternal">;

/** How many of the enquiry's two standing notes the switch lets through. */
export function countNotes(notes: Notes, filter: ThreadFilter): number {
  const client = notes.notesClient && passesFilter(false, filter) ? 1 : 0;
  const internal = notes.notesInternal && passesFilter(true, filter) ? 1 : 0;
  return client + internal;
}

/**
 * The enquiry's two standing notes at the head of its thread, kept apart as T6 keeps a client message
 * from an internal one: the client's own words on a flat row, the team's note inside an InternalPanel.
 * The switch filters them with the events. `notesInternal` is absent for a staff reader without the
 * notes grant (security.md), and then no panel is drawn.
 */
export function EnquiryNotes({
  notes,
  filter,
}: {
  readonly notes: Notes;
  readonly filter: ThreadFilter;
}) {
  return (
    <>
      {notes.notesClient && passesFilter(false, filter) ? (
        <ClientNote note={notes.notesClient} />
      ) : null}
      {notes.notesInternal && passesFilter(true, filter) ? (
        <InternalPanel className="rounded" testID="enquiry-internal-note">
          <Text variant="bodySmall" tone="body">
            {notes.notesInternal}
          </Text>
        </InternalPanel>
      ) : null}
    </>
  );
}

/** The client's note: client-visible, so a plain flat row, never the internal panel. */
function ClientNote({ note }: { readonly note: string }) {
  return (
    <Card tone="flat" padding="sm" testID="enquiry-client-note">
      <Stack gap={1}>
        <Text variant="eyebrow">Client note</Text>
        <Text variant="bodySmall" tone="body">
          {note}
        </Text>
      </Stack>
    </Card>
  );
}
