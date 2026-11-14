import { useState, type ReactNode } from "react";
import { useRouter } from "expo-router";
import type { UseQueryResult } from "@tanstack/react-query";

import { useStaffUsers } from "@ampm/api-client";
import type { StaffUserPage } from "@ampm/core";
import {
  Button,
  EmptyState,
  QueryErrorState,
  Row,
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
  useLayoutAt,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { AdminSectionNav } from "./admin-section-nav";
import { InviteStaffSheet } from "./invite-staff-sheet";
import { StaffUsersList } from "./staff-users-list";
import { StaffUsersTable } from "./staff-users-table";

export interface StaffUsersScreenProps {
  /** The app's tab bar (the route supplies it); the screen keeps room for it at the end. */
  readonly tabBar?: ReactNode;
}

/** "Staff users · 12", with a "+" while more pages wait beyond the loaded one. */
function directoryEyebrow(page: StaffUserPage | undefined): string {
  if (!page) return "Admin console";
  return `Staff users · ${page.items.length}${page.nextCursor ? "+" : ""}`;
}

/** Skeleton rows in the shape the directory will take. */
function StaffUsersLoading() {
  return (
    <Stack gap={2} testID="staff-users-loading">
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </Stack>
  );
}

interface BodyProps {
  readonly users: UseQueryResult<StaffUserPage>;
  readonly onOpen: (userId: string) => void;
  /** From 768 the directory is a table; a phone keeps its rows. */
  readonly asTable: boolean;
}

function StaffUsersBody({ users, onOpen, asTable }: BodyProps) {
  const goToSignIn = useGoToSignIn();
  if (users.isPending) return <StaffUsersLoading />;
  if (users.isError) {
    return (
      <QueryErrorState
        error={users.error}
        onRetry={() => void users.refetch()}
        onSignIn={goToSignIn}
        signIn={{
          title: "Sign in to view staff users",
          description: "Your session has ended. Sign in again to continue.",
        }}
      />
    );
  }
  if (users.data.items.length === 0) {
    return (
      <EmptyState
        icon="users"
        title="No staff users yet"
        description="Invite your team to give them access to the workspace."
      />
    );
  }
  const Directory = asTable ? StaffUsersTable : StaffUsersList;
  return <Directory users={users.data.items} onOpen={onOpen} />;
}

/** The page's gold action: invite a staff member. */
function InviteButton({ onPress }: { readonly onPress: () => void }) {
  return (
    <Button
      variant="primary"
      size="sm"
      icon="user-plus"
      onPress={onPress}
      testID="invite-staff-open"
    >
      Invite
    </Button>
  );
}

/**
 * The staff directory (TW-90): everyone with a staff account, their roles, status and authenticator
 * state, newest first. Super Admin invites and manages them; every staff role may read the directory,
 * and the server refuses the rest. The section strip (T12) leads to the other settings. A phone lists
 * the people as rows with Invite beside the title; from 768 they are a table, and Invite sits above it
 * at the right, leaving the header's right to the strip. Invite is a fixed slot in each place (null in
 * the other), and the invite sheet lives above both, so a draft survives the switch.
 *
 *   <StaffUsersScreen tabBar={<AppTabBar />} />
 */
export function StaffUsersScreen({ tabBar }: StaffUsersScreenProps) {
  const router = useRouter();
  const users = useStaffUsers();
  const isTablet = useLayoutAt("md");
  const [inviteOpen, setInviteOpen] = useState(false);
  const openUser = (userId: string): void =>
    router.push({ pathname: "/admin/users/[userId]", params: { userId } });
  const invite = <InviteButton onPress={() => setInviteOpen(true)} />;
  const header = (
    <ScreenHeader
      eyebrow={directoryEyebrow(users.data)}
      title="Users and roles"
      testID="staff-users-header"
      trailing={isTablet ? undefined : invite}
      actions={<AdminSectionNav current="users" />}
    />
  );
  return (
    <Screen width="wide" tabBar={tabBar} header={header}>
      <Stack gap={4}>
        {isTablet ? <Row justify="end">{invite}</Row> : null}
        <StaffUsersBody users={users} onOpen={openUser} asTable={isTablet} />
      </Stack>
      <InviteStaffSheet open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </Screen>
  );
}
