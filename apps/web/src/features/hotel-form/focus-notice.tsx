import { useEffect, useRef, type ReactNode } from "react";

import { formatCountdown } from "@ampm/core";
import { calloutStyles, cn, glassStyles, textStyles } from "@ampm/ui/styles";

import { useCountdown } from "./use-countdown";

/*
 * A notice that answers a press on the review and status pages (D-190 §5): why Submit or Send did not go
 * through, or that a message was sent, with the way on. It takes focus each time it is shown, so a
 * keyboard and a screen reader are where the answer is.
 */

export interface FocusNoticeProps {
  readonly id: string;
  /** Counts each showing: a new count, a repeat of the same words included, takes focus again. */
  readonly shown: number;
  readonly message: string;
  /** gold (needs the person: a refusal) or peacock (done: sent, withdrawn). */
  readonly tone?: "gold" | "peacock" | undefined;
  /** The way on: links, a reload, a countdown. */
  readonly children?: ReactNode;
}

/**
 * The notice in glass, its message announced as it appears (a refusal assertively, a confirmation
 * politely), then the way on.
 *
 *   <FocusNotice id="hf-submit-notice" shown={notice.shown} message={notice.message}>…</FocusNotice>
 */
export function FocusNotice({ id, shown, message, tone = "gold", children }: FocusNoticeProps) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => box.current?.focus(), [shown]);
  return (
    <div
      id={id}
      ref={box}
      tabIndex={-1}
      className={cn(
        glassStyles({ recipe: tone, blur: false }),
        calloutStyles,
        "flex-col gap-3 outline-none",
      )}
    >
      <p
        role={tone === "gold" ? "alert" : "status"}
        className={textStyles({ variant: "bodySmall", tone: "primary" })}
      >
        {message}
      </p>
      {children}
    </div>
  );
}

/** An hour: a longer wait (a day's cap) is said in the message, not counted down. */
const COUNTED_WAIT_SECONDS = 60 * 60;

/**
 * A wait the API asked for (Retry-After), counted down once a second outside the announced message,
 * while it is under an hour; nothing once it is over.
 *
 *   <WaitLeft retryAt={notice.retryAt} words={(time) => `You can submit again in ${time}.`} />
 */
export function WaitLeft({
  retryAt,
  words,
}: {
  readonly retryAt: number;
  readonly words: (time: string) => string;
}) {
  const left = useCountdown(retryAt);
  if (left <= 0 || left >= COUNTED_WAIT_SECONDS) return null;
  return (
    <p className={textStyles({ variant: "bodySmall", tone: "primary" })}>
      {words(formatCountdown(left))}
    </p>
  );
}
