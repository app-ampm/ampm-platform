import { useEnquiryAssignees, useMe, useUpdateStaffEnquiry } from "@ampm/api-client";
import type { HotelEnquiryAssignee, HotelEnquiryStaffView } from "@ampm/core";
import {
  Avatar,
  Button,
  Card,
  Row,
  Select,
  Stack,
  StatusChip,
  Text,
  useToast,
  type SelectOption,
} from "@ampm/ui";

import { errorMessage } from "./consultancy-admin.form";
import { holderName, ownerCaption, UNASSIGNED_BADGE } from "./consultancy-admin.format";
import { useSectionCard } from "./use-section-card";

type Enquiry = Pick<HotelEnquiryStaffView, "id" | "status" | "assignedUserId" | "assignedUserName">;

/** The picker's value for "nobody": back to unassigned. Never a user id (those are uuids). */
const NOBODY = "nobody";

/**
 * The picker's options: the hotel team by name ("You" under the reader), the current holder kept (not
 * choosable) when they are no longer on the team so the field still names them, and "Nobody" while
 * someone holds it.
 */
export function ownerOptions(
  team: readonly HotelEnquiryAssignee[],
  enquiry: Enquiry,
  myId: string | undefined,
): SelectOption<string>[] {
  const options: SelectOption<string>[] = team.map((member) => ({
    value: member.id,
    label: member.name,
    description: member.id === myId ? "You" : undefined,
  }));
  const held = enquiry.assignedUserId;
  if (held !== null && !team.some((member) => member.id === held)) {
    const label = holderName(enquiry) ?? "Former team member";
    options.push({
      value: held,
      label,
      description: "No longer on the hotel team",
      disabled: true,
    });
  }
  if (held !== null) {
    const description = "Back to unassigned, for anyone on the team to pick up";
    options.push({ value: NOBODY, label: "Nobody", description });
  }
  return options;
}

/** The owner change and its toasts: who holds it now, or why it could not change. */
function useOwnerChange(enquiry: Enquiry, team: readonly HotelEnquiryAssignee[], myId?: string) {
  const toast = useToast();
  const update = useUpdateStaffEnquiry(enquiry.id);
  const change = (value: string): void => {
    const assignedUserId = value === NOBODY ? null : value;
    if (update.isPending || assignedUserId === enquiry.assignedUserId) return;
    const name = team.find((member) => member.id === assignedUserId)?.name;
    const title =
      assignedUserId === null
        ? "Back to unassigned"
        : assignedUserId === myId
          ? "Assigned to you"
          : `Assigned to ${name ?? "the team"}`;
    update.mutate(
      { assignedUserId },
      {
        onSuccess: () => toast.show({ title, tone: "success" }),
        onError: (error) =>
          toast.show({ title: errorMessage(error, "Could not change the owner"), tone: "danger" }),
      },
    );
  };
  return { change, pending: update.isPending };
}

/** Who holds the enquiry: their initials and name with a line on what that means, or "Unassigned". */
function OwnerIdentity({
  enquiry,
  isMine,
}: {
  readonly enquiry: Enquiry;
  readonly isMine: boolean;
}) {
  const name = holderName(enquiry);
  const held = enquiry.assignedUserId !== null;
  return (
    <Row gap={3} align="center">
      {name ? <Avatar name={name} size="md" /> : null}
      <Stack gap={1} className="flex-1">
        <Text variant="eyebrow">Owner</Text>
        <Text variant="subheading" testID="enquiry-owner-name">
          {held ? (name ?? "Former team member") : UNASSIGNED_BADGE.label}
        </Text>
        <Text variant="bodySmall" tone="muted">
          {ownerCaption(held, isMine)}
        </Text>
      </Stack>
      {held ? null : (
        <StatusChip label={UNASSIGNED_BADGE.label} tone={UNASSIGNED_BADGE.tone} size="sm" />
      )}
    </Row>
  );
}

interface ControlsProps {
  readonly enquiry: Enquiry;
  readonly team: readonly HotelEnquiryAssignee[];
  readonly myId: string | undefined;
}

/** Hand the enquiry to anyone on the hotel team, or take it in one press when the reader is on it. */
function OwnerControls({ enquiry, team, myId }: ControlsProps) {
  const { change, pending } = useOwnerChange(enquiry, team, myId);
  const canTake =
    myId !== undefined &&
    enquiry.assignedUserId !== myId &&
    team.some((member) => member.id === myId);
  return (
    <Stack gap={3}>
      <Select
        label="Hand it to"
        value={enquiry.assignedUserId}
        options={ownerOptions(team, enquiry, myId)}
        onChange={change}
        placeholder="Choose someone on the hotel team"
        sheetTitle="Who holds this enquiry?"
        searchable={team.length > 6}
        searchLabel="Search the team"
        emptyLabel="Nobody on the team can hold an enquiry yet."
        disabled={pending}
        testID="enquiry-owner-select"
      />
      {canTake ? (
        <Row justify="start">
          <Button
            variant="secondary"
            size="sm"
            loading={pending}
            onPress={() => change(myId)}
            testID="enquiry-assign-me"
          >
            Assign to me
          </Button>
        </Row>
      ) : null}
    </Stack>
  );
}

/**
 * Who on the hotel team holds the enquiry, on its overview beside the client: their name, or the gold
 * "Unassigned" while it is the team's to pick up. A reader who may reassign it (the team list loads —
 * the server keys it on `consultancy.enquiries.update`, so custom roles count too) gets the picker and,
 * when they are on the team, "Assign to me"; anyone else reads the holder only. A closed enquiry's
 * holder is history, so it is not changed here. The server refuses an owner who cannot work it.
 *
 *   <EnquiryOwnerCard enquiry={enquiry} />
 */
export function EnquiryOwnerCard({ enquiry }: { readonly enquiry: Enquiry }) {
  const card = useSectionCard();
  const me = useMe();
  const myId = me.data?.principal.type === "staff" ? me.data.principal.userId : undefined;
  const team = useEnquiryAssignees({ enabled: myId !== undefined && enquiry.status !== "closed" });
  const isMine = myId !== undefined && enquiry.assignedUserId === myId;
  return (
    <Card tone={card.tone} className={card.className} testID="enquiry-owner-card">
      <Stack gap={4}>
        <OwnerIdentity enquiry={enquiry} isMine={isMine} />
        {team.isSuccess && enquiry.status !== "closed" ? (
          <OwnerControls enquiry={enquiry} team={team.data} myId={myId} />
        ) : null}
      </Stack>
    </Card>
  );
}
