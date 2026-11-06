import { StateView, type StateViewProps } from "../state-view";

export interface EmptyStateProps extends Omit<StateViewProps, "icon" | "iconTone"> {
  readonly icon?: StateViewProps["icon"] | undefined;
}

/**
 * Nothing here yet: say what creates the first row and offer that action if the person may take it.
 * A pearl icon on base glass; the action is secondary unless it is the screen's one gold action.
 *
 *   <EmptyState title="No requests yet" description="..." action={{ label: "New request", onPress }} />
 */
export function EmptyState({ icon = "inbox", ...rest }: EmptyStateProps) {
  return <StateView icon={icon} iconTone="primary" {...rest} />;
}
