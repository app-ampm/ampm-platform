import {
  buttonLabelStyles,
  buttonStyles,
  calloutStyles,
  cn,
  glassStyles,
  textStyles,
} from "@ampm/ui/styles";

import type { BotCheck, BotCheckStatus } from "./bot-check";

/** The words of a bot check: one line for each state it can be in, and the retry. */
export type BotCheckCopy = Readonly<Record<BotCheckStatus, string>> & { readonly retry: string };

export interface BotCheckFieldProps {
  /** The widget container's id; the status line is `botCheckStatusId(id)`. */
  readonly id: string;
  /** The form's words for the check (the enquiry's mention sending, the hotel form's the code). */
  readonly copy: BotCheckCopy;
  readonly check: BotCheck;
  /** The widget's container, from `useBotCheck`; Turnstile draws inside it, React leaves it empty. */
  readonly containerRef: (element: HTMLDivElement | null) => void;
  /** Runs the check again after it failed. */
  readonly onRetry: () => void;
}

/**
 * The id of the line saying where a check stands, which describes the action it guards
 * (`aria-describedby`), so a screen reader hears why the button waits.
 *
 * @example
 * botCheckStatusId("bot-check"); // "bot-check-status"
 */
export function botCheckStatusId(id: string): string {
  return `${id}-status`;
}

const NOTICE_STYLES = cn(
  glassStyles({ recipe: "gold", blur: false }),
  calloutStyles,
  textStyles({ variant: "bodySmall", tone: "primary" }),
);

/**
 * The bot check above a form's action (PUB-06, HF-02): Turnstile's widget, which `useBotCheck` draws in
 * the container, and one line saying where the check stands, which describes the action. While the check
 * runs or has passed, the line is visually hidden and silent: the widget shows its own progress, and a
 * token's routine refresh (after each send, and every 300 seconds) is not worth announcing. A failure
 * replaces it with a notice that is announced at once (a new `role="alert"`), with a way to run the
 * check again unless the browser cannot run it at all. Until then the container keeps the widget's
 * height, so nothing jumps.
 *
 *   <BotCheckField id="bot-check" copy={ENQUIRY_COPY.botCheck} check={botCheck.check}
 *     containerRef={botCheck.ref} onRetry={botCheck.reset} />
 */
export function BotCheckField({ id, copy, check, containerRef, onRetry }: BotCheckFieldProps) {
  const hasFailed = check.status === "failed" || check.status === "unsupported";
  const statusId = botCheckStatusId(id);
  return (
    <div className="flex flex-col gap-3">
      <div ref={containerRef} id={id} className={hasFailed ? undefined : "min-h-16"} />
      {hasFailed ? (
        <p key="alert" id={statusId} role="alert" className={NOTICE_STYLES}>
          {copy[check.status]}
        </p>
      ) : (
        <p key="status" id={statusId} className="sr-only">
          {copy[check.status]}
        </p>
      )}
      {check.status === "failed" ? (
        <button
          type="button"
          onClick={onRetry}
          className={buttonStyles({ variant: "secondary", size: "sm" })}
        >
          <span className={buttonLabelStyles({ variant: "secondary", size: "sm" })}>
            {copy.retry}
          </span>
        </button>
      ) : null}
    </div>
  );
}
