import { useState, type ReactNode } from "react";
import { useRouter } from "expo-router";
import type { UseQueryResult } from "@tanstack/react-query";

import { useStaffUsers } from "@ampm/api-client";
import type { StaffUserPage } from "@ampm/core";
import {
  Button,
  EmptyState,
  QueryErrorState,
  Screen,
  ScreenHeader,
  Skeleton,
  Stack,
} from "@ampm/ui";

import { useGoToSignIn } from "@/navigation/sign-in";

import { InviteStaffSheet } from "./invite-staff-sheet";
import { StaffUsersList } from "./staff-users-list";

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
}

function StaffUsersBody({ users, onOpen }: BodyProps) {
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
  return <StaffUsersList users={users.data.items} onOpen={onOpen} />;
}

/**
 * The staff directory (TW-90): everyone with a staff account, their roles, status and authenticator
 * state, newest first. Super Admin invites and manages them (next slice); every staff role may read
 * the directory, and the server refuses the rest. Navigation and sign-out live in the rail and tab bar.
 *
 *   <StaffUsersScreen tabBar={<AppTabBar />} />
 */
export function StaffUsersScreen({ tabBar }: StaffUsersScreenProps) {
  const router = useRouter();
  const users = useStaffUsers();
  const [inviteOpen, setInviteOpen] = useState(false);
  const openUser = (userId: string): void =>
    router.push({ pathname: "/admin/users/[userId]", params: { userId } });
  return (
    <Screen
      tabBar={tabBar}
      header={
        <ScreenHeader
          eyebrow={directoryEyebrow(users.data)}
          title="Users and roles"
          trailing={
            <Button
              variant="primary"
              size="sm"
              icon="user-plus"
              onPress={() => setInviteOpen(true)}
              testID="invite-staff-open"
            >
              Invite
            </Button>
          }
        />
      }
    >
      <StaffUsersBody users={users} onOpen={openUser} />
      <InviteStaffSheet open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </Screen>
  );
}
