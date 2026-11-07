import { cn, focusRingStyles, glassStyles, textStyles } from "@ampm/ui/styles";

import type { ReachableChannel } from "./contact-channels";
import { CHAT_ANCHOR_ID } from "./contact-ids";

/**
 * AMPM's channels as glass rows with an arrow (W6), radius 22, the stroke rising under the pointer.
 * The list is where "Chat with AMPM" lands; with no channel to show it renders nothing.
 */
export function ContactChannelList({
  channels,
}: {
  readonly channels: readonly ReachableChannel[];
}) {
  if (channels.length === 0) return null;
  return (
    <ul id={CHAT_ANCHOR_ID} className="flex flex-col gap-2.5 pt-2.5">
      {channels.map((channel) => (
        <li key={channel.key}>
          <a
            href={channel.href}
            className={cn(
              glassStyles({ recipe: "base" }),
              "flex min-h-touch items-center justify-between gap-4 rounded-lg px-5.5 py-4.5",
              "transition-colors duration-base hover:border-primary/24 motion-reduce:transition-none",
              focusRingStyles,
            )}
          >
            <span className={textStyles({ variant: "subheading" })}>{channel.label}</span>
            <span aria-hidden className={textStyles({ variant: "body", tone: "primary" })}>
              →
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
