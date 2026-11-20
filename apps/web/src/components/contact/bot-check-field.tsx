import {
  buttonLabelStyles,
  buttonStyles,
  calloutStyles,
  cn,
  glassStyles,
  textStyles,
} from "@ampm/ui/styles";

import type { BotCheck } from "./bot-check";
import { BOT_CHECK_ID, BOT_CHECK_STATUS_ID } from "./contact-ids";
import { ENQUIRY_COPY as COPY } from "./enquiry-copy";

export interface BotCheckFieldProps {
  readonly check: BotCheck;
  /** The widget's container, from `useBotCheck`; Turnstile draws inside it, React leaves it empty. */
  readonly containerRef: (element: HTMLDivElement | null) => void;
  /** Runs the check again after it failed. */
  readonly onRetry: () => void;
}

const NOTICE_STYLES = cn(
  glassStyles({ recipe: "gold", blur: false }),
  calloutStyles,
  textStyles({ variant: "bodySmall", tone: "primary" }),
);

/**
 * The bot check above Send (PUB-06): Turnstile's widget, which `useBotCheck` draws in the container,
 * and one line saying where the check stands, which describes Send. While the check runs or has passed,
 * the line is visually hidden and silent: the widget shows its own progress, and a token's routine
 * refresh (after each send, and every 300 seconds) is not worth announcing. A failure replaces it with
 * a notice that is announced at once (a new `role="alert"`), with a way to run the check again unless
 * the browser cannot run it at all. Until then the container keeps the widget's height, so nothing jumps.
 */
export function BotCheckField({ check, containerRef, onRetry }: BotCheckFieldProps) {
  const hasFailed = check.status === "failed" || check.status === "unsupported";
  return (
    <div className="flex flex-col gap-3">
      <div ref={containerRef} id={BOT_CHECK_ID} className={hasFailed ? undefined : "min-h-16"} />
      {hasFailed ? (
        <p key="alert" id={BOT_CHECK_STATUS_ID} role="alert" className={NOTICE_STYLES}>
          {COPY.botCheck[check.status]}
        </p>
      ) : (
        <p key="status" id={BOT_CHECK_STATUS_ID} className="sr-only">
          {COPY.botCheck[check.status]}
        </p>
      )}
      {check.status === "failed" ? (
        <button
          type="button"
          onClick={onRetry}
          className={buttonStyles({ variant: "secondary", size: "sm" })}
        >
          <span className={buttonLabelStyles({ variant: "secondary", size: "sm" })}>
            {COPY.botCheckRetry}
          </span>
        </button>
      ) : null}
    </div>
  );
}
