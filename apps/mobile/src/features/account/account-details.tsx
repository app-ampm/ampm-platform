import { useRouter, type Href } from "expo-router";

import type { MeResponse, PrincipalType } from "@ampm/core";
import { STAFF_ROLES } from "@ampm/policy";
import { Card, ListItem, Row, Stack, StatusChip, Text } from "@ampm/ui";

import { SignOutButton } from "@/navigation/sign-out-button";
import { hasStaffArea } from "@/navigation/staff-areas";

import { moduleLabel } from "../portal/portal.format";

type Membership = MeResponse["memberships"][number];

/** "0192… · bride": the project, and the side a client representative speaks for. */
function membershipLine(membership: Membership): string {
  const side = membership.clientSide ? ` · ${membership.clientSide}` : "";
  return `${membership.projectId}${side}`;
}

/** The kind of account in words, never the API's code ("staff"). */
const PRINCIPAL_LABEL: Record<PrincipalType, string> = {
  staff: "Team",
  client: "Client",
  demo: "Demo account",
  guest: "Guest",
  system: "System",
};

/**
 * Who is signed in: name, contact details as data, then the kind of account and the roles as chips:
 * facts about the account, so peacock-glass highlights and pearl outlines, never a status treatment.
 * Roles carry the names the staff rail shows (STAFF_ROLES), not their codes; a demo account says so
 * once.
 */
function ProfileCard({ me }: { readonly me: MeResponse }) {
  const { principal } = me;
  return (
    <Card>
      <Stack gap={3}>
        <Stack gap={1}>
          <Text variant="heading">{principal.name}</Text>
          <Text variant="data" tone="muted">
            {principal.email ?? "No email"}
          </Text>
          {principal.phone ? (
            <Text variant="data" tone="muted">
              {principal.phone}
            </Text>
          ) : null}
        </Stack>
        <Row gap={2} wrap>
          <StatusChip label={PRINCIPAL_LABEL[principal.type]} tone="brand" />
          {me.roles.map((role) => (
            <StatusChip key={role} label={STAFF_ROLES[role].name} tone="info" />
          ))}
          {me.isDemo && principal.type !== "demo" ? (
            <StatusChip label={PRINCIPAL_LABEL.demo} tone="brand" />
          ) : null}
        </Row>
      </Stack>
    </Card>
  );
}

/** The weddings the person belongs to, one row each, or the fallback while there are none. */
function MembershipRows({ memberships }: { readonly memberships: readonly Membership[] }) {
  if (memberships.length === 0) {
    return (
      <Text tone="muted" className="py-3">
        None yet.
      </Text>
    );
  }
  return (
    <>
      {memberships.map((m) => (
        <ListItem
          key={m.projectId}
          tone="plain"
          title={m.projectRole}
          subtitle={membershipLine(m)}
        />
      ))}
    </>
  );
}

/** For a client, the modules their plan opens, named as the plan card names them; read-only says so. */
function EntitlementRows({ entitlements }: { readonly entitlements: MeResponse["entitlements"] }) {
  const { modules, readOnlyModules } = entitlements;
  if (modules.length === 0) return null;
  return (
    <>
      <Text variant="eyebrow" className="pt-3">
        Entitlements
      </Text>
      {modules.map((module) => (
        <ListItem
          key={module}
          tone="plain"
          title={moduleLabel(module)}
          trailing={
            readOnlyModules.includes(module) ? (
              <StatusChip label="Read only" tone="neutral" size="sm" />
            ) : null
          }
        />
      ))}
    </>
  );
}

/** The weddings the person belongs to and, for a client, the modules their plan opens. */
function AccessCard({ me }: { readonly me: MeResponse }) {
  return (
    <Card>
      <Stack gap={1}>
        <Text variant="eyebrow">Memberships</Text>
        <MembershipRows memberships={me.memberships} />
        <EntitlementRows entitlements={me.entitlements} />
      </Stack>
    </Card>
  );
}

interface AppLink {
  readonly title: string;
  readonly href: Href;
}

/** The app's other pages (P10's list): rows under hairlines, the first clear of the card's stroke. */
function AppLinks({ links }: { readonly links: readonly AppLink[] }) {
  const router = useRouter();
  return (
    <Card padding="sm" className="py-1">
      {links.map((link, index) => (
        <ListItem
          key={link.title}
          tone="plain"
          title={link.title}
          showChevron
          accessibilityRole="link"
          accessibilityLabel={link.title}
          onPress={() => router.push(link.href)}
          className={index === 0 ? "border-t-0" : undefined}
        />
      ))}
    </Card>
  );
}

const FIELD_NOTES: AppLink = { title: "Field notes", href: "/field-notes" };
const GALLERY: AppLink = { title: "Component gallery", href: "/gallery" };

/**
 * The More screen's content (P10, M10): the profile, memberships and entitlements, the field notes
 * (staff whose roles open the Tasks area) and the component gallery, and sign-out.
 */
export function AccountDetails({ me }: { readonly me: MeResponse }) {
  return (
    <>
      <ProfileCard me={me} />
      <AccessCard me={me} />
      <AppLinks links={hasStaffArea(me, "tasks") ? [FIELD_NOTES, GALLERY] : [GALLERY]} />
      <SignOutButton />
    </>
  );
}
