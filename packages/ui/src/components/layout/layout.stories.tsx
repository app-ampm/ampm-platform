import { View } from "react-native";

import { defineStories } from "../../stories/define";
import { Text } from "../text";
import { Columns } from "./columns";
import { Divider } from "./divider";
import { Grid } from "./grid";
import { MasterDetail } from "./master-detail";
import { Row } from "./row";
import { Spacer } from "./spacer";
import { SplitPane } from "./split-pane";
import { Stack } from "./stack";

const Block = ({ label }: { label: string }) => (
  <View className="rounded border border-primary/12 bg-primary/6 px-3 py-2">
    <Text variant="label">{label}</Text>
  </View>
);

export const stories = defineStories({
  title: "Layout",
  stories: [
    {
      name: "Stack gap 2 and 4",
      render: () => (
        <Row gap={6} align="start">
          <Stack gap={2}>
            <Block label="one" />
            <Block label="two" />
          </Stack>
          <Stack gap={4}>
            <Block label="one" />
            <Block label="two" />
          </Stack>
        </Row>
      ),
    },
    {
      name: "Half steps 1.5, 2.5, 3.5, 4.5",
      render: () => (
        <Stack gap={3}>
          {([1.5, 2.5, 3.5, 4.5] as const).map((gap) => (
            <Row key={gap} gap={gap}>
              <Block label={`gap ${gap}`} />
              <Block label="b" />
              <Block label="c" />
            </Row>
          ))}
        </Stack>
      ),
    },
    {
      name: "Row with Spacer",
      render: () => (
        <Row>
          <Block label="start" />
          <Spacer />
          <Block label="end" />
        </Row>
      ),
    },
    {
      name: "Row wrap",
      render: () => (
        <Row wrap gap={2}>
          {["a", "b", "c", "d", "e", "f", "g", "h"].map((label) => (
            <Block key={label} label={label} />
          ))}
        </Row>
      ),
    },
    {
      name: "Divider: horizontal, inset and vertical",
      render: () => (
        <Stack gap={3}>
          <Text variant="label">Rooms</Text>
          <Divider />
          <Text variant="label">Venues</Text>
          <Divider inset />
          <Row gap={3}>
            <Text variant="data">UDAIPUR</Text>
            <Divider orientation="vertical" />
            <Text variant="data">12–14 FEB 2027</Text>
            <Divider orientation="vertical" />
            <Text variant="data">300 GUESTS</Text>
          </Row>
        </Stack>
      ),
    },
    {
      name: "Columns 1.5 : 1, stacked below 1024 (D4)",
      render: () => (
        <Columns ratios={[1.5, 1]}>
          <Block label="Where shall we look today?" />
          <Block label="Hotel discovery · 18 days left" />
        </Columns>
      ),
    },
    {
      name: "Columns 1 : 1 : 0.9 (D4's second row)",
      render: () => (
        <Columns ratios={[1, 1, 0.9]}>
          <Block label="My selection" />
          <Block label="Enquiries" />
          <Block label="My wedding" />
        </Columns>
      ),
    },
    {
      name: "SplitPane: main beside a 288 side panel (T5)",
      render: () => (
        <SplitPane side={<Block label="Verification" />}>
          <Block label="Rate card" />
        </SplitPane>
      ),
    },
    {
      name: "MasterDetail: a 432 list beside the selected item (T6)",
      render: () => (
        <MasterDetail
          list={<Block label="Enquiry queue" />}
          detail={<Block label="Bagh Mahal" />}
        />
      ),
    },
    {
      name: "Grid: 1, 2 from 768, 3 from 1024",
      render: () => (
        <Grid>
          {["Goa", "Jaipur", "Udaipur", "Kerala"].map((label) => (
            <Block key={label} label={label} />
          ))}
        </Grid>
      ),
    },
  ],
});
