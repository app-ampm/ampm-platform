"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { ApiProvider, useSubmitEnquiry } from "@ampm/api-client";
import { cardStyles, cn } from "@ampm/ui/styles";

import { env } from "@/env";

import { BotCheckField } from "./contact/bot-check-field";
import { CHAT_ANCHOR_ID, CONTACT_HEADING_ID } from "./contact/contact-ids";
import type { ReceivedRequest } from "./contact/contact-request";
import { formGridStyles } from "./contact/contact.styles";
import { useBotCheck } from "./contact/use-bot-check";
import {
  ConsentFields,
  EMPTY,
  FormActions,
  IdentityFields,
  RequestTypeField,
  ThankYou,
  WeddingFields,
  type FieldGroupProps,
  type FormFields,
} from "./enquiry-fields";
import { sendFailureOf, submitStep } from "./enquiry-payload";

/*
 * PUB-06 — the public enquiry and demo-request form (Module B CRM, feature 8.1). No account is created
 * here (WHY §4); the form posts through the typed client to the public /crm/enquiries endpoint, which
 * checks the Cloudflare Turnstile token, captures consent, flags a duplicate for Sales and notifies
 * them. Validation reuses the one Zod schema from @ampm/core (contract-first).
 */

export interface ContactFormProps {
  /** The page's left column (heading, channels), rendered on the server; the form lays the page out. */
  readonly intro: ReactNode;
  /** Opens on the demo request: the page was reached through `/contact?type=demo`. */
  readonly initialRequestedDemo: boolean;
  /** The form is where "Chat with AMPM" lands while AMPM's channels have no addresses. */
  readonly isChatAnchor: boolean;
}

/** The contact page's enquiry form and its confirmation, wired to the API through a scoped provider. */
export function ContactForm(props: ContactFormProps) {
  return (
    <ApiProvider baseUrl={env.NEXT_PUBLIC_API_URL}>
      <EnquiryForm {...props} />
    </ApiProvider>
  );
}

/** The request AMPM accepted: the first name it sent back and what the form sent. */
interface Received {
  readonly firstName: string;
  readonly request: ReceivedRequest;
}

/**
 * The form's state. A demo link followed while the page is open (the bar's "Request a demo" on
 * /contact) turns the switch to the demo request and brings the form back, keeping what was typed:
 * React's pattern for state that follows a prop.
 */
function useEnquiryState(initialRequestedDemo: boolean) {
  const [fields, setFields] = useState<FormFields>({
    ...EMPTY,
    requestedDemo: initialRequestedDemo,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [received, setReceived] = useState<Received | null>(null);
  const [linkedDemo, setLinkedDemo] = useState(initialRequestedDemo);
  if (linkedDemo !== initialRequestedDemo) {
    setLinkedDemo(initialRequestedDemo);
    setFields((prev) => ({ ...prev, requestedDemo: initialRequestedDemo }));
    setReceived(null);
  }
  return { fields, setFields, errors, setErrors, received, setReceived };
}

/**
 * The handlers: fields change as typed; submit validates with the shared schema, then posts with the
 * bot check's token.
 */
function useEnquiryForm(initialRequestedDemo: boolean) {
  const { fields, setFields, errors, setErrors, received, setReceived } =
    useEnquiryState(initialRequestedDemo);
  const submit = useSubmitEnquiry();
  const botCheck = useBotCheck(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  const onText: FieldGroupProps["onText"] = (key) => (event) =>
    setFields((prev) => ({ ...prev, [key]: event.target.value }));
  const onCheck: FieldGroupProps["onCheck"] = (key) => (event) =>
    setFields((prev) => ({ ...prev, [key]: event.target.checked }));

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const step = submitStep(fields, botCheck.token);
    setErrors(step.kind === "invalid" ? step.errors : {});
    if (step.kind !== "send") return;
    const { request } = step;
    // A token is good for one request: spend it now, so the widget is already checking again (and
    // Send waits for the new token) if this send fails.
    botCheck.reset();
    submit.mutate(request, {
      onSuccess: (result) => setReceived({ firstName: result.firstName, request }),
    });
  }

  const groupProps: FieldGroupProps = { fields, errors, onText, onCheck };
  return { groupProps, onSubmit, submit, received, botCheck };
}

/** The intro beside the form from 1024 (the mock's 1fr / 1.12fr), above it on a phone and tablet. */
function ContactLayout({
  intro,
  children,
}: {
  readonly intro: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-10 md:gap-14 lg:flex-row lg:items-start lg:gap-16">
      <div className="flex flex-col lg:min-w-0 lg:flex-1 lg:pt-5">{intro}</div>
      {children}
    </div>
  );
}

/**
 * The page body (W6): the intro and the glass form card; once AMPM has the request, the confirmation
 * (W7) takes the page's place.
 */
function EnquiryForm({ intro, initialRequestedDemo, isChatAnchor }: ContactFormProps) {
  const form = useEnquiryForm(initialRequestedDemo);
  const chatId = isChatAnchor ? CHAT_ANCHOR_ID : undefined;
  if (form.received)
    return (
      <div id={chatId}>
        <ThankYou firstName={form.received.firstName} request={form.received.request} />
      </div>
    );
  return (
    <ContactLayout intro={intro}>
      <EnquiryCard form={form} chatId={chatId} />
    </ContactLayout>
  );
}

interface EnquiryCardProps {
  readonly form: ReturnType<typeof useEnquiryForm>;
  readonly chatId: string | undefined;
}

/** The glass form card: the request switch at its top, the fields, and the bot check above Send. */
function EnquiryCard({
  form: { groupProps, onSubmit, submit, botCheck },
  chatId,
}: EnquiryCardProps) {
  return (
    <form
      id={chatId}
      noValidate
      onSubmit={onSubmit}
      aria-labelledby={CONTACT_HEADING_ID}
      className={cn(
        cardStyles({ padding: "none" }),
        "gap-5.5 rounded-lg p-5 md:rounded-2xl md:p-8 lg:w-1/2 lg:shrink-0 xl:p-10",
      )}
    >
      <RequestTypeField {...groupProps} />
      <div className={formGridStyles}>
        <IdentityFields {...groupProps} />
        <WeddingFields {...groupProps} />
      </div>
      <ConsentFields {...groupProps} />
      <BotCheckField check={botCheck.check} containerRef={botCheck.ref} onRetry={botCheck.reset} />
      <FormActions
        isPending={submit.isPending}
        canSend={botCheck.token !== null}
        failure={sendFailureOf(submit.error)}
      />
    </form>
  );
}
