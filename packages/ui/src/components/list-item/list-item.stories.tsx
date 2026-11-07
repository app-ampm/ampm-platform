import { View } from "react-native";

import { defineStories } from "../../stories/define";
import { Card } from "../card";
import { Icon } from "../icon";
import { Row, Stack } from "../layout";
import { PhotoPlaceholder } from "../photo-placeholder";
import { StatusChip } from "../status-chip";
import { Text } from "../text";
import { ListItem } from "./list-item";

const thumbnail = (label: string, tone: "gold" | "peacock") => (
  <PhotoPlaceholder label={label} tone={tone} showLabel={false} className="h-10 w-12 rounded-sm" />
);

const SAVED = [
  {
    name: "Raj Niwas Palace",
    place: "Udaipur · Lake Pichola",
    status: "Available",
    tone: "success",
  },
  {
    name: "Bagh Mahal Retreat",
    place: "Udaipur · Fateh Sagar",
    status: "Awaiting hotel",
    tone: "warning",
  },
  { name: "Aravalli Lake Resort", place: "Udaipur · Badi", status: "Submitted", tone: "info" },
] as const;

export const stories = defineStories({
  title: "ListItem",
  stories: [
    {
      name: "My selection: plain rows in a glass card (P2, D4)",
      render: () => (
        <Card padding="sm">
          <Row justify="between" className="pb-2">
            <Text variant="label">My selection</Text>
            <Text variant="label" tone="brand">
              Compare
            </Text>
          </Row>
          {SAVED.map((hotel, index) => (
            <ListItem
              key={hotel.name}
              tone="plain"
              title={hotel.name}
              subtitle={hotel.place}
              leading={thumbnail(hotel.name, index === 1 ? "peacock" : "gold")}
              trailing={<StatusChip label={hotel.status} tone={hotel.tone} size="sm" />}
              onPress={() => undefined}
            />
          ))}
        </Card>
      ),
    },
    {
      name: "Flat rows with chevrons",
      render: () => (
        <Stack gap={2}>
          <ListItem
            title="Programme"
            subtitle="5 functions over 3 days"
            showChevron
            onPress={() => undefined}
          />
          <ListItem
            title="Guests"
            meta="248 / 300 CONFIRMED"
            showChevron
            onPress={() => undefined}
          />
          <ListItem title="Documents" subtitle="Signed links last 15 minutes" />
        </Stack>
      ),
    },
    {
      name: "Enquiry rows with meta (T6)",
      render: () => (
        <Stack gap={2}>
          <ListItem
            title="Bagh Mahal Retreat"
            subtitle="Ananya Sharma · 300 guests"
            meta="ENQ-0418 · 12–14 FEB 2027"
            trailing={<StatusChip label="Awaiting hotel" tone="warning" size="sm" />}
            onPress={() => undefined}
          />
          <ListItem
            title="Raj Niwas Palace"
            subtitle="Rohan Mehta · 180 guests"
            meta="ENQ-0416 · 3–5 MAR 2027"
            trailing={<StatusChip label="Proposal shared" tone="success" size="sm" />}
            onPress={() => undefined}
          />
        </Stack>
      ),
    },
    {
      name: "Leading icon, static rows",
      render: () => (
        <Stack gap={2}>
          {(
            [
              { icon: "calendar-days", title: "Sangeet", meta: "13 FEB · 19:00" },
              { icon: "map-pin", title: "Lakeside lawn", meta: "OPEN AIR · 420 GUESTS" },
            ] as const
          ).map((row) => (
            <ListItem
              key={row.title}
              title={row.title}
              meta={row.meta}
              leading={
                <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/6">
                  <Icon name={row.icon} tone="muted" />
                </View>
              }
            />
          ))}
        </Stack>
      ),
    },
  ],
});
