import { ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useHotel, useMe, useSaveHotel, useSavedHotels, useUnsaveHotel } from "@ampm/api-client";
import { isAppError, type HotelView } from "@ampm/core";
import {
  Button,
  EmptyState,
  ErrorState,
  OfflineState,
  Row,
  Skeleton,
  Stack,
  StatusChip,
  Text,
  useToast,
} from "@ampm/ui";

import { destinationLabel } from "./hotel-card";

/** A single hotel the client unlocked (Module C): its details and a shortlist toggle. */
export function HotelDetailScreen({ hotelId }: { readonly hotelId: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const hotel = useHotel(hotelId);
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
      <HotelDetail hotel={hotel} />
    </ScrollView>
  );
}

function HotelDetail({ hotel }: { readonly hotel: ReturnType<typeof useHotel> }) {
  const router = useRouter();
  if (hotel.isPending) return <DetailLoading />;
  if (hotel.isError) {
    if (isAppError(hotel.error) && hotel.error.code === "network_error")
      return <OfflineState onRetry={() => void hotel.refetch()} />;
    if (isAppError(hotel.error) && hotel.error.code === "unauthenticated")
      return (
        <EmptyState
          icon="lock"
          title="Sign in to view this hotel"
          action={{ label: "Sign in", onPress: () => router.replace("/sign-in") }}
        />
      );
    if (isAppError(hotel.error) && hotel.error.code === "not_found")
      return (
        <EmptyState
          icon="inbox"
          title="Hotel not found"
          description="This hotel is not available to you."
        />
      );
    return <ErrorState onRetry={() => void hotel.refetch()} />;
  }
  return <HotelBody hotel={hotel.data} />;
}

function HotelBody({ hotel }: { readonly hotel: HotelView }) {
  const facts = [
    hotel.starCategory ? `${hotel.starCategory}-star` : null,
    hotel.totalRooms !== null ? `${hotel.totalRooms} rooms` : null,
  ].filter((fact): fact is string => fact !== null);
  return (
    <Stack gap={3}>
      <Stack gap={1}>
        <Text variant="title">{hotel.name}</Text>
        <Text tone="muted">{destinationLabel(hotel.destination)}</Text>
      </Stack>
      {facts.length > 0 ? (
        <Row gap={2} wrap>
          {facts.map((fact) => (
            <StatusChip key={fact} label={fact} tone="info" size="sm" />
          ))}
        </Row>
      ) : null}
      {hotel.description ? <Text>{hotel.description}</Text> : null}
      {hotel.address ? <Text tone="muted">{hotel.address}</Text> : null}
      <SaveButton hotel={hotel} />
      <RequestAssistanceButton hotel={hotel} />
    </Stack>
  );
}

/** CP-07 entry: an entitled client opens a hotel-assistance enquiry for this hotel (the consultancy flow). */
function RequestAssistanceButton({ hotel }: { readonly hotel: HotelView }) {
  const router = useRouter();
  const me = useMe();
  const canRequest = me.data?.entitlements.modules.includes("hotel_assistance") ?? false;
  if (!canRequest) return null;
  return (
    <Button
      variant="secondary"
      onPress={() => router.push(`/portal/requests/new?hotelId=${hotel.id}`)}
    >
      Request hotel assistance
    </Button>
  );
}

function SaveButton({ hotel }: { readonly hotel: HotelView }) {
  const toast = useToast();
  const me = useMe();
  const saved = useSavedHotels();
  const save = useSaveHotel(hotel.id);
  const unsave = useUnsaveHotel(hotel.id);
  const canSave =
    (me.data?.entitlements.modules.includes("saved_hotels") ?? false) &&
    !(me.data?.entitlements.readOnlyModules.includes("saved_hotels") ?? false);
  if (!canSave) return null;
  const isSaved = saved.data?.items.some((item) => item.hotel.id === hotel.id) ?? false;
  const onToggle = (): void => {
    const mutation = isSaved ? unsave : save;
    mutation.mutate(undefined, {
      onError: () => toast.show({ title: "Could not update your shortlist", tone: "danger" }),
    });
  };
  return (
    <Button
      variant={isSaved ? "secondary" : "primary"}
      icon="star"
      loading={save.isPending || unsave.isPending}
      onPress={onToggle}
    >
      {isSaved ? "Saved to shortlist" : "Save hotel"}
    </Button>
  );
}

function DetailLoading() {
  return (
    <Stack gap={3} testID="hotel-detail-loading">
      <Skeleton className="h-8 w-full" />
      <Skeleton className="h-40 w-full" />
    </Stack>
  );
}
