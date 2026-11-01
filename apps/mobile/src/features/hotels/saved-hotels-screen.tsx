import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSavedHotels, useUnsaveHotel } from "@ampm/api-client";
import { isAppError, type SavedHotelView } from "@ampm/core";
import {
  Button,
  EmptyState,
  ErrorState,
  OfflineState,
  Row,
  Skeleton,
  Stack,
  Text,
  useToast,
} from "@ampm/ui";

import { HotelCard } from "./hotel-card";

/** The account's hotel shortlist (Module C): the hotels saved from discovery, each removable. */
export function SavedHotelsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const saved = useSavedHotels();
  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="gap-4 p-4 md:p-8"
      style={{ paddingTop: insets.top }}
    >
      <Row justify="start">
        <Button variant="ghost" size="sm" icon="arrow-left" onPress={() => router.back()}>
          Back
        </Button>
      </Row>
      <Text variant="title">Saved hotels</Text>
      <SavedList
        saved={saved}
        onOpen={(id) => router.push({ pathname: "/hotels/[id]", params: { id } })}
      />
    </ScrollView>
  );
}

function SavedList({
  saved,
  onOpen,
}: {
  readonly saved: ReturnType<typeof useSavedHotels>;
  readonly onOpen: (id: string) => void;
}) {
  const router = useRouter();
  if (saved.isPending) return <SavedLoading />;
  if (saved.isError) {
    if (isAppError(saved.error) && saved.error.code === "network_error")
      return <OfflineState onRetry={() => void saved.refetch()} />;
    if (isAppError(saved.error) && saved.error.code === "unauthenticated")
      return (
        <EmptyState
          icon="lock"
          title="Sign in to view your shortlist"
          action={{ label: "Sign in", onPress: () => router.replace("/sign-in") }}
        />
      );
    return <ErrorState onRetry={() => void saved.refetch()} />;
  }
  if (saved.data.items.length === 0)
    return (
      <EmptyState
        icon="inbox"
        title="No saved hotels yet"
        description="Save a hotel from discovery to build your shortlist."
      />
    );
  return (
    <Stack gap={3}>
      {saved.data.items.map((item) => (
        <SavedRow key={item.id} item={item} onOpen={() => onOpen(item.hotel.id)} />
      ))}
    </Stack>
  );
}

function SavedRow({
  item,
  onOpen,
}: {
  readonly item: SavedHotelView;
  readonly onOpen: () => void;
}) {
  const toast = useToast();
  const unsave = useUnsaveHotel(item.hotel.id);
  const onRemove = (): void => {
    unsave.mutate(undefined, {
      onError: () => toast.show({ title: "Could not remove the hotel", tone: "danger" }),
    });
  };
  return (
    <Stack gap={1}>
      <HotelCard hotel={item.hotel} onPress={onOpen} />
      <Row justify="end">
        <Button
          variant="ghost"
          size="sm"
          icon="star"
          loading={unsave.isPending}
          onPress={onRemove}
          accessibilityLabel={`Remove ${item.hotel.name} from your shortlist`}
        >
          Remove
        </Button>
      </Row>
    </Stack>
  );
}

function SavedLoading() {
  return (
    <Stack gap={3} testID="saved-hotels-loading">
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </Stack>
  );
}
