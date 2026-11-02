import { useState } from "react";
import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useHotels } from "@ampm/api-client";
import { isAppError } from "@ampm/core";
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  OfflineState,
  Row,
  Skeleton,
  Stack,
  Text,
} from "@ampm/ui";

import { HotelCard } from "./hotel-card";

/** Hotel discovery (Module C): search the hotels the subscription unlocks; each card opens the detail. */
export function HotelsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [q, setQ] = useState("");
  const hotels = useHotels({ q: q.trim() || undefined });
  return (
    <ScrollView
      className="flex-1 bg-surface"
      contentContainerClassName="gap-4 p-4 md:p-8"
      style={{ paddingTop: insets.top }}
    >
      <Row gap={2} justify="between" align="center">
        <Button variant="ghost" size="sm" icon="arrow-left" onPress={() => router.back()}>
          Back
        </Button>
        <Button variant="ghost" size="sm" icon="star" onPress={() => router.push("/hotels/saved")}>
          Saved
        </Button>
      </Row>
      <Text variant="title">Hotels</Text>
      <Input
        label="Search hotels"
        leadingIcon="search"
        value={q}
        onChangeText={setQ}
        returnKeyType="search"
      />
      <HotelsList
        hotels={hotels}
        onOpen={(id) => router.push({ pathname: "/hotels/[id]", params: { id } })}
      />
    </ScrollView>
  );
}

function HotelsList({
  hotels,
  onOpen,
}: {
  readonly hotels: ReturnType<typeof useHotels>;
  readonly onOpen: (id: string) => void;
}) {
  const router = useRouter();
  if (hotels.isPending) return <HotelsLoading />;
  if (hotels.isError) {
    if (isAppError(hotels.error) && hotels.error.code === "network_error")
      return <OfflineState onRetry={() => void hotels.refetch()} />;
    if (isAppError(hotels.error) && hotels.error.code === "unauthenticated")
      return (
        <EmptyState
          icon="lock"
          title="Sign in to browse hotels"
          action={{ label: "Sign in", onPress: () => router.replace("/sign-in") }}
        />
      );
    return <ErrorState onRetry={() => void hotels.refetch()} />;
  }
  if (hotels.data.items.length === 0)
    return (
      <EmptyState icon="inbox" title="No hotels found" description="Try a different search." />
    );
  return (
    <Stack gap={3}>
      {hotels.data.items.map((hotel) => (
        <HotelCard key={hotel.id} hotel={hotel} onPress={() => onOpen(hotel.id)} />
      ))}
    </Stack>
  );
}

function HotelsLoading() {
  return (
    <Stack gap={3} testID="hotels-loading">
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </Stack>
  );
}
