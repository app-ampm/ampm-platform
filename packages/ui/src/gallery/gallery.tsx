import type { ReactNode } from "react";
import { View } from "react-native";

import { Card } from "../components/card";
import { Row } from "../components/layout";
import { Screen } from "../components/screen";
import { ScreenHeader } from "../components/screen-header";
import { StatusChip } from "../components/status-chip";
import { Text } from "../components/text";
import { useBreakpoint } from "../hooks/use-breakpoint";
import { useIsClient } from "../hooks/use-is-client";
import { allStories, type Story, type StoryModule } from "../stories";

function chunk<T>(items: readonly T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

/** One variant or state, on a flat tint inside its section: rows inside panels are flat. */
function StoryCell({ story }: { readonly story: Story }) {
  return (
    <Card tone="flat" padding="sm" className="flex-1 gap-3">
      <Text variant="label">{story.name}</Text>
      {story.description ? (
        <Text variant="bodySmall" tone="muted">
          {story.description}
        </Text>
      ) : null}
      {story.render()}
    </Card>
  );
}

/**
 * A component's stories in one section, one to three cells a row. The section is glass that does not
 * blur: the stories' own top-level panels (glass cards, tab bars, the rail, notices) are the only blur,
 * as they are on a screen, so the catalogue never draws blur on blur (§3: only top-level panels blur).
 */
function Section({ module, columns }: { readonly module: StoryModule; readonly columns: number }) {
  return (
    <Card blur={false} className="gap-4 md:p-7" testID={`gallery-section-${module.title}`}>
      <Text variant="heading">{module.title}</Text>
      {chunk(module.stories, columns).map((row, index) => (
        <Row key={index} gap={3} align="start">
          {row.map((story) => (
            <StoryCell key={story.name} story={story} />
          ))}
          {row.length < columns
            ? Array.from({ length: columns - row.length }, (_, i) => (
                <View key={`pad-${i}`} className="flex-1" />
              ))
            : null}
        </Row>
      ))}
    </Card>
  );
}

export interface GalleryProps {
  /**
   * A sticky glass bar under the catalogue (Screen's footer), for the app's own shortcuts; Screen
   * keeps it clear of the home indicator and keeps room for it at the end of the scroll.
   */
  readonly footer?: ReactNode;
}

/**
 * Every component in every variant and state, on phone, tablet and web (standards §2.7 step 4), on
 * the Peacock Night canvas: the Screen scaffold with its glow, a section per component and a flat cell
 * per story. One column on a phone, two on a tablet, three on a desktop window; the chip shows the
 * breakpoint. Dark only: there is no scheme to switch.
 *
 *   <Gallery footer={<Row gap={2} justify="end"><Link href="/account" variant="nav">Account</Link></Row>} />
 */
export function Gallery({ footer }: GalleryProps = {}) {
  const { breakpoint, width, isPhone, isTablet } = useBreakpoint();
  // The server knows no window: it renders the phone layout and the client takes over after hydration.
  const isClient = useIsClient();
  const columns = !isClient || isPhone ? 1 : isTablet ? 2 : 3;
  const sizeLabel = isClient ? `${breakpoint} · ${Math.round(width)} px` : "…";
  return (
    <Screen
      testID="gallery"
      contentClassName="gap-4.5"
      footer={footer}
      header={
        <ScreenHeader
          eyebrow="Peacock Night"
          title="AMPM UI"
          subtitle="Every component of the kit, in each variant and state."
          trailing={<StatusChip label={sizeLabel} tone="info" size="sm" />}
        />
      }
    >
      {allStories.map((module) => (
        <Section key={module.title} module={module} columns={columns} />
      ))}
    </Screen>
  );
}
