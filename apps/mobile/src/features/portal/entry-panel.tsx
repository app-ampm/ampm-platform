import { View } from "react-native";

import { Card, Icon, ListItem, Text, cn, type IconName } from "@ampm/ui";

import { HOME_PANEL } from "./home-panel.styles";

export interface EntryPanelProps {
  /** The panel's heading ("My selection"). */
  readonly heading: string;
  /** The row that opens the area. */
  readonly title: string;
  readonly subtitle: string;
  readonly icon: IconName;
  readonly onPress: () => void;
  readonly className?: string | undefined;
}

/**
 * A glass panel with its heading and one row under a hairline that opens the area: D4's "My selection"
 * and "Enquiries" panels, without rows the home has no data for.
 */
export function EntryPanel({
  heading,
  title,
  subtitle,
  icon,
  onPress,
  className,
}: EntryPanelProps) {
  return (
    <Card padding="sm" className={cn(HOME_PANEL, "gap-2", className)}>
      <Text variant="subheading">{heading}</Text>
      <ListItem
        tone="plain"
        title={title}
        subtitle={subtitle}
        leading={
          <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/6">
            <Icon name={icon} tone="muted" />
          </View>
        }
        showChevron
        onPress={onPress}
      />
    </Card>
  );
}
