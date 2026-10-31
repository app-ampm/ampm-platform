import type { NotificationTemplate } from "../schemas/config.js";

/** The channels delivered through the provider adapter; in-app is delivered by the service itself. */
export type ExternalChannel = "email" | "sms" | "whatsapp" | "push";

/** Rendered, ready-to-send content for one external channel. */
export type RenderedContent =
  | {
      readonly kind: "email";
      readonly subject: string;
      readonly html: string;
      readonly text: string;
    }
  | { readonly kind: "sms"; readonly text: string }
  | {
      readonly kind: "whatsapp";
      readonly providerTemplateId: string;
      readonly params: readonly string[];
    }
  | { readonly kind: "push"; readonly title: string; readonly body: string };

/** The outcome of rendering one string: the result and any `{{var}}` the variables did not supply. */
export interface Rendered {
  readonly text: string;
  readonly missing: readonly string[];
}

/** The outcome of rendering a channel: `content` is null when the template has no block for it. */
export interface RenderResult {
  readonly content: RenderedContent | null;
  readonly missing: readonly string[];
}

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
const NONE: RenderResult = { content: null, missing: [] };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Fills `{{var}}` placeholders from `variables`. A placeholder with no variable is recorded in
 * `missing` and rendered empty, so the caller can refuse to send a half-filled message (fail closed).
 * With `escapeHtml`, substituted values are HTML-escaped — use it for an HTML body so an interpolated
 * value cannot inject markup.
 */
export function renderString(
  template: string,
  variables: Readonly<Record<string, string>>,
  options: { readonly escapeHtml?: boolean } = {},
): Rendered {
  const missing = new Set<string>();
  const text = template.replace(PLACEHOLDER, (_match, name: string) => {
    const value = variables[name];
    if (value === undefined) {
      missing.add(name);
      return "";
    }
    return options.escapeHtml ? escapeHtml(value) : value;
  });
  // A placeholder the regex does not accept (a stray char, a dotted name) would otherwise render
  // literally and slip past the fail-closed check; flag any residual `{{...}}` so the caller refuses it.
  for (const residual of text.match(/\{\{[^{}]*\}\}/g) ?? []) {
    missing.add(residual);
  }
  return { text, missing: [...missing] };
}

function dedupe(names: readonly string[]): string[] {
  return [...new Set(names)];
}

function renderEmail(
  block: NonNullable<NotificationTemplate["email"]>,
  variables: Readonly<Record<string, string>>,
): RenderResult {
  const subject = renderString(block.subject, variables);
  const html = renderString(block.html, variables, { escapeHtml: true });
  const text = renderString(block.text, variables);
  return {
    content: { kind: "email", subject: subject.text, html: html.text, text: text.text },
    missing: dedupe([...subject.missing, ...html.missing, ...text.missing]),
  };
}

function renderPush(
  block: NonNullable<NotificationTemplate["push"]>,
  variables: Readonly<Record<string, string>>,
): RenderResult {
  const title = renderString(block.title, variables);
  const body = renderString(block.body, variables);
  return {
    content: { kind: "push", title: title.text, body: body.text },
    missing: dedupe([...title.missing, ...body.missing]),
  };
}

function renderSms(
  block: NonNullable<NotificationTemplate["sms"]>,
  variables: Readonly<Record<string, string>>,
): RenderResult {
  const text = renderString(block.text, variables);
  return { content: { kind: "sms", text: text.text }, missing: text.missing };
}

function renderWhatsapp(
  block: NonNullable<NotificationTemplate["whatsapp"]>,
  variables: Readonly<Record<string, string>>,
): RenderResult {
  const params = block.params.map((param) => renderString(param, variables));
  return {
    content: {
      kind: "whatsapp",
      providerTemplateId: block.providerTemplateId,
      params: params.map((param) => param.text),
    },
    missing: dedupe(params.flatMap((param) => [...param.missing])),
  };
}

/**
 * Renders a template's content for one external channel from `variables`. Returns `content: null`
 * when the template has no block for the channel; otherwise the content plus any missing variables,
 * so the caller fails closed rather than dispatching a half-filled message.
 */
export function renderTemplate(
  template: NotificationTemplate,
  channel: ExternalChannel,
  variables: Readonly<Record<string, string>>,
): RenderResult {
  switch (channel) {
    case "email":
      return template.email ? renderEmail(template.email, variables) : NONE;
    case "sms":
      return template.sms ? renderSms(template.sms, variables) : NONE;
    case "whatsapp":
      return template.whatsapp ? renderWhatsapp(template.whatsapp, variables) : NONE;
    case "push":
      return template.push ? renderPush(template.push, variables) : NONE;
  }
}
