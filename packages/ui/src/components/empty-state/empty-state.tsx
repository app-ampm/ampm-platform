import { StateView, type StateViewProps } from "../state-view";

export interface EmptyStateProps extends Omit<StateViewProps, "icon" | "iconTone"> {
  readonly icon?: StateViewProps["icon"] | undefined;
}

/** Nothing here yet: `<EmptyState title="No requests" description="..." action={{ label: "New request", onPress }} />` */
export function EmptyState({ icon = "inbox", ...rest }: EmptyStateProps) {
  return <StateView icon={icon} iconTone="muted" {...rest} />;
}
