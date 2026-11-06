import { View } from "react-native";

import { GlassPanel, type GlassRecipeName } from "../components/glass-panel";
import { Row, Stack } from "../components/layout";
import { Text, type TextTone, type TextVariant } from "../components/text";
import { cn } from "../lib/cn";
import { defineStories } from "./define";

// Peacock Night's tokens as the classes that draw them (docs/design/peacock-night.md §1–5). No value
// is written here: every swatch is a class, every number a label.

interface SwatchSpec {
  /** The fill as a component writes it: a colour token, or a token at an opacity step. */
  readonly className: string;
  readonly name: string;
  readonly role: string;
}

const COLOURS: readonly SwatchSpec[] = [
  { className: "bg-surface", name: "Midnight", role: "surface · canvas, glass fill, ink on fills" },
  { className: "bg-highlight", name: "Peacock", role: "highlight · selected, verified, done" },
  { className: "bg-brand", name: "Gold", role: "brand · action, focus, needs-you" },
  { className: "bg-primary", name: "Pearl", role: "primary · all text and strokes" },
];

const TINTS: readonly SwatchSpec[] = [
  { className: "bg-primary/6", name: "Pearl 6", role: "wells, nested rows, skeletons" },
  { className: "bg-primary/8", name: "Pearl 8", role: "hover fill, stale chip" },
  { className: "bg-primary/12", name: "Pearl 12", role: "toggle and progress tracks, rim" },
  { className: "bg-primary/16", name: "Pearl 16", role: "panel strokes, dividers" },
  { className: "bg-primary/40", name: "Pearl 40", role: "outline buttons, info chips" },
  { className: "bg-brand/14", name: "Gold 14", role: "gold glass" },
  { className: "bg-brand/16", name: "Gold 16", role: "waiting chip" },
  { className: "bg-highlight/30", name: "Peacock 30", role: "peacock glass" },
  { className: "bg-surface/50", name: "Midnight 50", role: "glass fill" },
];

const STRENGTHS: readonly {
  readonly tone: TextTone;
  readonly name: string;
  readonly role: string;
}[] = [
  { tone: "primary", name: "Pearl 100", role: "text-primary · headings and values" },
  { tone: "body", name: "Pearl 80", role: "text-body · body text" },
  { tone: "muted", name: "Pearl 58", role: "text-muted · labels and metadata" },
  { tone: "disabled", name: "Pearl 45", role: "text-primary/45 · disabled" },
];

const RECIPES: readonly {
  readonly recipe: GlassRecipeName;
  readonly role: string;
  readonly values: string;
}[] = [
  {
    recipe: "base",
    role: "Cards, panels, nav, tab bars",
    values: "midnight 50 · pearl 16 stroke · pearl 12 rim",
  },
  {
    recipe: "peacock",
    role: "Selected, verified, offline",
    values: "peacock 30 · peacock 70 stroke · pearl 20 rim",
  },
  {
    recipe: "gold",
    role: "Live, needs-you, key callouts",
    values: "gold 14 · gold 50 stroke · gold 35 rim",
  },
];

const RADII: readonly { readonly className: string; readonly label: string }[] = [
  { className: "rounded-sm", label: "7 · checkboxes" },
  { className: "rounded", label: "16 · rows in panels" },
  { className: "rounded-lg", label: "22 · phone cards" },
  { className: "rounded-xl", label: "24 · desktop cards" },
  { className: "rounded-2xl", label: "28 · sheets, pages" },
  { className: "rounded-full", label: "pill · controls" },
];

const RAMP: readonly {
  readonly variant: TextVariant;
  readonly sample: string;
  readonly spec: string;
  readonly tone?: TextTone;
}[] = [
  { variant: "hero", sample: "Aa", spec: "hero · Gilda Display 88" },
  { variant: "display", sample: "Palace", spec: "display · Gilda Display 64" },
  { variant: "title", sample: "Find your venue", spec: "title · Gilda Display 36" },
  { variant: "heading", sample: "Raj Niwas Palace", spec: "heading · Gilda Display 24" },
  { variant: "eyebrow", sample: "Total discovery", spec: "eyebrow · Manrope 600 10, tracked" },
  {
    variant: "data",
    sample: "₹46,80,000 · 12–14 FEB 2027",
    spec: "data · Manrope 600 13, tabular",
  },
  {
    variant: "greeting",
    sample: "शुभ विवाह",
    spec: "greeting · Rozha One 24, gold",
    tone: "brand",
  },
];

const RIMS: readonly { readonly recipe: GlassRecipeName; readonly label: string }[] = [
  { recipe: "base", label: "shadow-rim · pearl 12" },
  { recipe: "peacock", label: "shadow-rim-peacock · pearl 20" },
  { recipe: "gold", label: "shadow-rim-gold · gold 35" },
];

/** A colour by its class (never a hex), with its name and what it is for. */
function Swatch({ className, name, role }: SwatchSpec) {
  return (
    <Stack gap={1} className="w-28">
      <View className={cn("h-12 rounded border border-primary/16", className)} />
      <Text variant="label">{name}</Text>
      <Text variant="caption">{role}</Text>
    </Stack>
  );
}

function SwatchRow({ swatches }: { readonly swatches: readonly SwatchSpec[] }) {
  return (
    <Row gap={3} wrap align="start">
      {swatches.map((swatch) => (
        <Swatch key={swatch.name} {...swatch} />
      ))}
    </Row>
  );
}

function Strengths() {
  return (
    <Stack gap={3}>
      {STRENGTHS.map(({ tone, name, role }) => (
        <Stack key={name} gap={0}>
          <Text variant="subheading" tone={tone}>
            {name}
          </Text>
          <Text variant="caption">{role}</Text>
        </Stack>
      ))}
    </Stack>
  );
}

function Recipes() {
  return (
    <Row gap={3} wrap align="start">
      {RECIPES.map(({ recipe, role, values }) => (
        <GlassPanel key={recipe} recipe={recipe} className="w-48 gap-1 p-4">
          <Text variant="label">{recipe}</Text>
          <Text variant="bodySmall">{role}</Text>
          {/* Pearl 80%: pearl 58% is under 4.5:1 on peacock and gold glass (tokens contrastPairs). */}
          <Text variant="caption" tone="body">
            {values}
          </Text>
        </GlassPanel>
      ))}
    </Row>
  );
}

function Radii() {
  return (
    <Row gap={3} wrap align="start">
      {RADII.map(({ className, label }) => (
        <Stack key={label} gap={1} className="w-24">
          <View className={cn("h-14 w-20 border border-primary/40 bg-primary/6", className)} />
          <Text variant="caption">{label}</Text>
        </Stack>
      ))}
    </Row>
  );
}

function Ramp() {
  return (
    <Stack gap={3}>
      {RAMP.map(({ variant, sample, spec, tone }) => (
        <Stack key={variant} gap={1}>
          <Text variant={variant} tone={tone}>
            {sample}
          </Text>
          <Text variant="caption">{spec}</Text>
        </Stack>
      ))}
    </Stack>
  );
}

function RimsAndHalo() {
  return (
    <Row gap={3} wrap align="start">
      {RIMS.map(({ recipe, label }) => (
        <Stack key={recipe} gap={1} className="w-28">
          {/* GlassPanel draws the rim: an inset rim on the web, a hairline on native. */}
          <GlassPanel recipe={recipe} blur={false} className="h-14 w-28" />
          <Text variant="caption">{label}</Text>
        </Stack>
      ))}
      <Stack gap={1} className="w-28">
        <View className="h-touch w-28 rounded-full border border-brand bg-surface/50 web:shadow-halo" />
        <Text variant="caption">shadow-halo · gold 18%, focus (web; native shows the border)</Text>
      </Stack>
    </Row>
  );
}

export const stories = defineStories({
  title: "Tokens",
  stories: [
    { name: "Four colours", render: () => <SwatchRow swatches={COLOURS} /> },
    { name: "Pearl strengths", render: () => <Strengths /> },
    { name: "Tints: a colour at an opacity step", render: () => <SwatchRow swatches={TINTS} /> },
    { name: "Glass recipes", render: () => <Recipes /> },
    { name: "Radii", render: () => <Radii /> },
    { name: "Type ramp", render: () => <Ramp /> },
    { name: "Rims and the focus halo", render: () => <RimsAndHalo /> },
  ],
});
