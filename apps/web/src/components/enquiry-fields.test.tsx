import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  ConsentFields,
  EMPTY,
  FormActions,
  IdentityFields,
  ThankYou,
  WeddingFields,
  type FieldGroupProps,
} from "./enquiry-fields.js";

/**
 * PUB-06 component states and accessibility (C14, E5). Rendered to static markup (no DOM dependency),
 * which is enough to prove the error/help wiring and the confirmation state; interaction flows (typing,
 * submit, focus) are a Playwright flow when the web e2e stack lands.
 */
function groupProps(errors: Record<string, string> = {}): FieldGroupProps {
  return { fields: EMPTY, errors, onText: () => () => undefined, onCheck: () => () => undefined };
}

describe("PUB-06 fields", () => {
  it("marks a field with an error invalid and points it at the error text (E5)", () => {
    const html = renderToStaticMarkup(<IdentityFields {...groupProps({ email: "Bad email" })} />);
    expect(html).toContain('id="email-error"');
    expect(html).toContain('role="alert"');
    expect(html).toContain("Bad email");
    // The email input is associated with its error and marked invalid.
    expect(html).toMatch(/<input[^>]*aria-invalid="true"[^>]*aria-describedby="email-error"/);
  });

  it("marks the required name field aria-required and links its help when valid (E5)", () => {
    const html = renderToStaticMarkup(<IdentityFields {...groupProps()} />);
    expect(html).toMatch(/<input[^>]*id="name"[^>]*aria-required="true"/);
    // The email field, with no error, is described by its help text, not an alert.
    expect(html).toContain('id="email-help"');
    expect(html).toMatch(/<input[^>]*aria-describedby="email-help"/);
  });

  it("renders the wedding and consent fields without an error state by default", () => {
    const wedding = renderToStaticMarkup(<WeddingFields {...groupProps()} />);
    expect(wedding).not.toContain('role="alert"');
    const consent = renderToStaticMarkup(<ConsentFields {...groupProps()} />);
    expect(consent).toContain('type="checkbox"');
  });

  it("shows the rate-limited message on the actions when rate limited", () => {
    const html = renderToStaticMarkup(
      <FormActions isPending={false} isError={true} isRateLimited={true} />,
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("wait a moment");
  });

  it("confirms with the visitor's first name and a status role (PUB-09)", () => {
    const html = renderToStaticMarkup(<ThankYou firstName="Rhea" />);
    expect(html).toContain('role="status"');
    expect(html).toContain("Rhea");
  });
});
