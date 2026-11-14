import { useRouter } from "expo-router";
import type { UseQueryResult } from "@tanstack/react-query";

import { useStaffUser } from "@ampm/api-client";
import { formatDay, type StaffUserView } from "@ampm/core";
import {
  Card,
  Columns,
  Divider,
  QueryErrorState,
  Row,
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
  StatusChip,
  Text,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import {
  authenticatorLabel,
  lastSignInLabel,
  roleSummary,
  userStatusLabel,
  userStatusTone,
} from "./admin.format";
import { StaffUserActions } from "./staff-user-actions";
import { StaffUserRoles } from "./staff-user-roles";

/** One fact on the record: the label in pearl 58%, the value in pearl, read aloud as one line. */
function Fact({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <Row gap={4.5} align="start" accessible accessibilityLabel={`${label}: ${value}`}>
      <Text variant="bodySmall" tone="muted" className="w-32">
        {label}
      </Text>
      <Text variant="body" tone="primary" className="flex-1">
        {value}
      </Text>
    </Row>
  );
}

/** The staff user's record on glass: who they are, the access they hold, and their activity. */
function StaffUserCard({ user }: { readonly user: StaffUserView }) {
  return (
    <Card className="md:p-6" testID="staff-user-card">
      <Stack gap={3}>
        <Text variant="subheading">Account</Text>
        <Fact label="Email" value={user.email} />
        <Fact label="Phone" value={user.phone ?? "—"} />
        <Divider />
        <Fact label="Roles" value={roleSummary(user.roles)} />
        <Fact label="Status" value={userStatusLabel(user.status)} />
        <Fact label="Authenticator" value={authenticatorLabel(user.mfaEnabled)} />
        <Divider />
        <Fact label="Last sign-in" value={lastSignInLabel(user.lastLoginAt)} />
        <Fact label="Added" value={formatDay(user.createdAt, { style: "data" })} />
      </Stack>
    </Card>
  );
}

function DetailLoading() {
  return (
    <Stack gap={4} testID="staff-user-loading">
      <Skeleton className="h-72 w-full" />
    </Stack>
  );
}

function DetailBody({ user }: { readonly user: UseQueryResult<StaffUserView> }) {
  const goToSignIn = useGoToSignIn();
  if (user.isPending) return <DetailLoading />;
  if (user.isError) {
    return (
      <QueryErrorState
        error={user.error}
        onRetry={() => void user.refetch()}
        onSignIn={goToSignIn}
        signIn={{ title: "Sign in to view this staff user" }}
        notFound={{ title: "Staff user not found", description: "They may have been removed." }}
      />
    );
  }
  // T3's record arrangement: the account facts in the main column, the roles and the actions in the
  // side one. Columns keeps the same tree at every width, so a role change still in flight (its
  // checkboxes held) carries on when the window crosses 1024.
  return (
    <Columns ratios={[1.3, 1]} align="start" testID="staff-user-columns">
      <StaffUserCard user={user.data} />
      <Stack gap={4.5}>
        <StaffUserRoles user={user.data} />
        <StaffUserActions user={user.data} />
      </Stack>
    </Columns>
  );
}

/** "eva@example.com · Super Admin, Finance / Accounts": the record's facts line under the name. */
function recordFacts(user: StaffUserView): string {
  return `${user.email} · ${roleSummary(user.roles)}`;
}

/**
 * One staff user's record (TW-90 detail, T3's pattern): a record header on its own glass (the name
 * with the account status after it, the email and roles under it), then the account facts beside the
 * roles checklist and the management actions from 1024, stacked below it.
 *
 *   <StaffUserDetailScreen userId={id} />
 */
export function StaffUserDetailScreen({ userId }: { readonly userId: string }) {
  const router = useRouter();
  const user = useStaffUser(userId);
  const data = user.data;
  const header = (
    <ScreenHeader
      variant="panel"
      testID="staff-user-header"
      onBack={() => router.back()}
      eyebrow="Users and roles"
      title={data?.name ?? "Staff user"}
      badge={
        data ? (
          <StatusChip label={userStatusLabel(data.status)} tone={userStatusTone(data.status)} />
        ) : undefined
      }
      subtitle={data ? recordFacts(data) : undefined}
    />
  );
  return (
    <Screen width="wide" header={header}>
      <DetailBody user={user} />
    </Screen>
  );
}
