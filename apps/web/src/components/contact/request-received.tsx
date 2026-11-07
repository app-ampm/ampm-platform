"use client";

import { useEffect, useRef } from "react";

import { cardStyles, cn, listItemStyles, textStyles } from "@ampm/ui/styles";

import { ButtonLink } from "@/components/site/button-link";

import type { Reach, ReachChannel } from "./contact-request";
import { RECEIVED_HEADING_ID } from "./contact-ids";

export interface RequestReceivedProps {
  /** "Thank you, Ananya." */
  readonly title: string;
  /** "We have your demo request." */
  readonly lead: string;
  /** The way AMPM will reach them and the address on it, from what they typed. */
  readonly reach: Reach | null;
  /** The words before the address on each channel ("Someone from AMPM will call you on"). */
  readonly reachVia: Readonly<Record<ReachChannel, string>>;
  /** The end of the line ("to set it up."). */
  readonly purpose: string;
  readonly steps: readonly string[];
  /** The gold "Chat with AMPM" and where it opens; absent while AMPM has no channel to open. */
  readonly chat?: { readonly label: string; readonly href: string } | undefined;
  readonly backLabel: string;
}

type ReachLineProps = Pick<RequestReceivedProps, "lead" | "reach" | "reachVia" | "purpose">;

/** The line naming how AMPM will reach them; the address in pearl with tabular figures (W7). */
function ReachLine({ lead, reach, reachVia, purpose }: ReachLineProps) {
  return (
    <p className={cn(textStyles({ variant: "body", tone: "body" }), "text-lg md:text-xl")}>
      {lead}
      {reach ? (
        <>
          {` ${reachVia[reach.channel]} `}
          <span className="whitespace-nowrap tabular-nums text-primary">{reach.address}</span>
          {` ${purpose}`}
        </>
      ) : null}
    </p>
  );
}

/** What happens next, numbered 01, 02… in gold between pearl hairlines (W7). */
function NextSteps({ steps }: { readonly steps: readonly string[] }) {
  return (
    <ol className="flex flex-col">
      {steps.map((step, index) => (
        <li
          key={step}
          className={cn(
            listItemStyles({ tone: "plain" }),
            "items-baseline gap-4.5 py-4 last:border-b",
          )}
        >
          <span aria-hidden className={textStyles({ variant: "data", tone: "brand" })}>
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className={cn(textStyles({ variant: "body", tone: "primary" }), "md:text-lg")}>
            {step}
          </span>
        </li>
      ))}
    </ol>
  );
}

type ActionsProps = Pick<RequestReceivedProps, "chat" | "backLabel">;

/** W7's actions in one row from a tablet: the gold chat first when there is one, then the way home. */
function ReceivedActions({ chat, backLabel }: ActionsProps) {
  return (
    <div className="flex flex-col gap-2.5 md:flex-row md:gap-3">
      {chat ? (
        <ButtonLink href={chat.href} size="lg">
          {chat.label}
        </ButtonLink>
      ) : null}
      <ButtonLink href="/" variant="secondary" size="lg">
        {backLabel}
      </ButtonLink>
    </div>
  );
}

/**
 * PUB-09, the request received (W7): a glass card centred on the page with the peacock tick, the
 * thanks in Gilda, the line naming how AMPM will reach them, the next steps, and the gold chat beside
 * the way home. It replaces the form in place, so it takes focus: screen readers read it, and it
 * scrolls into view.
 */
export function RequestReceived({ title, steps, chat, backLabel, ...line }: RequestReceivedProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  return (
    <section
      role="status"
      aria-labelledby={RECEIVED_HEADING_ID}
      className={cn(
        cardStyles({ padding: "none" }),
        "mx-auto w-full max-w-3xl gap-6 rounded-lg p-6 md:gap-6.5 md:rounded-2xl md:p-14",
      )}
    >
      <span
        aria-hidden
        className="flex h-16 w-16 items-center justify-center rounded-full bg-highlight text-3xl font-bold text-highlight-ink"
      >
        ✓
      </span>
      <h1
        ref={headingRef}
        id={RECEIVED_HEADING_ID}
        tabIndex={-1}
        className={cn(textStyles({ variant: "title" }), "text-5xl outline-none md:text-6xl")}
      >
        {title}
      </h1>
      <ReachLine {...line} />
      <NextSteps steps={steps} />
      <ReceivedActions chat={chat} backLabel={backLabel} />
    </section>
  );
}
