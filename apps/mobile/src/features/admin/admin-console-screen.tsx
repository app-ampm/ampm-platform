import type { ReactNode } from "react";
import { useRouter, type Href } from "expo-router";

import { Card, Grid, ListItem, Screen, ScreenHeader, Stack, Text, useLayoutAt } from "@ampm/ui";

import { ADMIN_SECTIONS, type AdminSection } from "./admin-sections";

export interface AdminConsoleScreenProps {
  /** The app's tab bar (the route supplies it); the screen keeps room for it at the end. */
  readonly tabBar?: ReactNode;
}

interface SectionsProps {
  readonly onOpen: (href: Href) => void;
}

/** What a section reads as for a screen reader: its name, then its one line. */
function sectionLabel(section: AdminSection): string {
  return `${section.title}: ${section.subtitle.charAt(0).toLowerCase()}${section.subtitle.slice(1)}`;
}

/** A phone's settings menu: the sections as rows in one glass panel. */
function SectionList({ onOpen }: SectionsProps) {
  return (
    <Card padding="sm" testID="admin-sections">
      <Stack gap={2}>
        {ADMIN_SECTIONS.map((section) => (
          <ListItem
            key={section.key}
            title={section.title}
            subtitle={section.subtitle}
            onPress={() => onOpen(section.href)}
            accessibilityLabel={sectionLabel(section)}
            testID={`admin-section-${section.key}`}
          />
        ))}
      </Stack>
    </Card>
  );
}

/** From 768: each section on its own glass card, two across and three from 1024. */
function SectionGrid({ onOpen }: SectionsProps) {
  return (
    <Grid columns={{ md: 2, lg: 3 }} testID="admin-sections-grid">
      {ADMIN_SECTIONS.map((section) => (
        <Card
          key={section.key}
          padding="lg"
          className="flex-1 gap-1.5"
          onPress={() => onOpen(section.href)}
          accessibilityLabel={sectionLabel(section)}
          testID={`admin-section-${section.key}`}
        >
          <Text variant="subheading">{section.title}</Text>
          <Text variant="bodySmall" tone="muted">
            {section.subtitle}
          </Text>
        </Card>
      ))}
    </Grid>
  );
}

/**
 * The admin console landing — the Settings area (TW-90–96): the sections a Super Admin runs the
 * platform from, each opening its own screen, where the section strip (T12) moves between them. A
 * phone lists them; from 768 they are a grid of cards. Neither holds state, so the switch is free.
 *
 *   <AdminConsoleScreen tabBar={<AppTabBar />} />
 */
export function AdminConsoleScreen({ tabBar }: AdminConsoleScreenProps) {
  const router = useRouter();
  const isTablet = useLayoutAt("md");
  const open = (href: Href): void => router.push(href);
  return (
    <Screen
      width="wide"
      tabBar={tabBar}
      header={<ScreenHeader eyebrow="Admin console" title="Settings" />}
    >
      {isTablet ? <SectionGrid onOpen={open} /> : <SectionList onOpen={open} />}
    </Screen>
  );
}
