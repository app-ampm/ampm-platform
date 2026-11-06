import { defineStories } from "../../stories/define";
import { GlassPanel } from "../glass-panel";
import { Row } from "../layout";
import { Stat } from "./stat";

export const stories = defineStories({
  title: "Stat",
  stories: [
    {
      name: "KPI (md, 44)",
      render: () => (
        <GlassPanel className="p-5">
          <Stat label="Live weddings" value={18} caption="3 with functions this week" />
        </GlassPanel>
      ),
    },
    {
      name: "Countdown in gold (lg, 64)",
      render: () => (
        <GlassPanel className="p-5">
          <Stat label="Wedding" value={98} caption="days to go" tone="brand" size="lg" />
        </GlassPanel>
      ),
    },
    {
      name: "Days left meter",
      render: () => (
        <GlassPanel recipe="peacock" className="p-5">
          <Stat
            label="Hotel discovery"
            value={18}
            caption="days left · until 5 Dec"
            size="lg"
            detailTone="body"
          />
        </GlassPanel>
      ),
    },
    {
      name: "Needs you: on gold glass",
      render: () => (
        <GlassPanel recipe="gold" className="p-5">
          <Stat
            label="Availability requests"
            value={7}
            caption="2 past response time"
            detailTone="brand"
          />
        </GlassPanel>
      ),
    },
    {
      name: "Done total in peacock, centred",
      render: () => (
        <GlassPanel className="p-5">
          <Stat label="Readiness" value="10 / 10" caption="ready" tone="highlight" align="center" />
        </GlassPanel>
      ),
    },
    {
      name: "A row of KPIs, no caption",
      render: () => (
        <Row gap={4} wrap>
          <Stat label="Open leads" value={24} />
          <Stat label="Tasks due today" value={12} />
        </Row>
      ),
    },
  ],
});
