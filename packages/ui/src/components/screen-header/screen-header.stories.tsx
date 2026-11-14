import { defineStories } from "../../stories/define";
import { Avatar } from "../avatar";
import { Button } from "../button";
import { StatusChip } from "../status-chip";
import { ScreenHeader } from "./screen-header";

const noop = () => undefined;

export const stories = defineStories({
  title: "ScreenHeader",
  stories: [
    {
      name: "One gold word (P1 sign in)",
      render: () => (
        <ScreenHeader
          title="Welcome"
          emphasis="back."
          subtitle="We sent a code to the number AMPM has for you."
        />
      ),
    },
    {
      name: "Eyebrow and trailing avatar (P2)",
      render: () => (
        <ScreenHeader
          eyebrow="Hello, Ananya"
          title="Find your venue"
          trailing={<Avatar name="Ananya Sharma" tone="highlight" />}
        />
      ),
    },
    {
      name: "Back button (P4)",
      render: () => (
        <ScreenHeader
          onBack={noop}
          eyebrow="Udaipur · Lake Pichola"
          title="Raj Niwas Palace"
          trailing={<Button variant="primary" icon="heart" accessibilityLabel="Save hotel" />}
        />
      ),
    },
    {
      name: "Admin greeting with an action (T1)",
      render: () => (
        <ScreenHeader
          eyebrow="Friday · 6 Nov 2026"
          title="Good morning, Eva."
          trailing={
            <Button variant="glass" size="sm" icon="bell">
              Alerts
            </Button>
          }
        />
      ),
    },
    {
      name: "Page actions at the right (T2)",
      render: () => (
        <ScreenHeader
          eyebrow="Leads and clients · 24 open"
          title="Pipeline"
          actions={
            <>
              <Button variant="glass" size="sm">
                Funnel
              </Button>
              <Button variant="primary" size="sm">
                New lead
              </Button>
            </>
          }
        />
      ),
    },
    {
      name: "A record's header panel with a status (T3)",
      render: () => (
        <ScreenHeader
          variant="panel"
          title="Rohit Malhotra"
          badge={<StatusChip tone="warning" label="Demo granted" />}
          subtitle="Delhi · Udaipur or Goa · Dec 2027 · About 250 guests · Source: Instagram"
          actions={
            <>
              <Button variant="glass" size="sm">
                Log activity
              </Button>
              <Button variant="primary" size="sm">
                Create account and invite
              </Button>
            </>
          }
        />
      ),
    },
    {
      name: "Display size for wide pages",
      render: () => (
        <ScreenHeader
          size="display"
          eyebrow="Hello, Ananya"
          title="Where shall we look"
          emphasis="today?"
          subtitle="Udaipur, 12–14 Feb 2027, about 300 guests."
        />
      ),
    },
    {
      name: "Hero size for a split sign-in (D1)",
      render: () => (
        <ScreenHeader
          size="hero"
          title="Welcome"
          emphasis="back."
          subtitle="Sign in with the mobile number AMPM has on file. We'll send a six-digit code by SMS."
        />
      ),
    },
  ],
});
