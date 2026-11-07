import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ContactIntro } from "./contact/contact-intro";
import { ContactForm } from "./contact-form";
import { ThankYou } from "./enquiry-fields";

/*
 * The contact page as the server sends it (PUB-06, W6) and the confirmation that replaces it (PUB-09,
 * W7). Typing and submitting are a Playwright flow when the web e2e stack lands.
 */

/** The `<input …>` tag carrying every attribute given, whatever order React writes them in. */
function inputWith(html: string, ...attributes: string[]): string {
  return (
    [...html.matchAll(/<input[^>]*>/g)].find((match) =>
      attributes.every((attribute) => match[0].includes(attribute)),
    )?.[0] ?? ""
  );
}

function renderForm(initialRequestedDemo: boolean, isChatAnchor = true): string {
  return renderToStaticMarkup(
    <ContactForm
      intro={<ContactIntro channels={[]} />}
      initialRequestedDemo={initialRequestedDemo}
      isChatAnchor={isChatAnchor}
    />,
  );
}

describe("contact form", () => {
  it("lays the intro beside a form named by the page heading", () => {
    const html = renderForm(false);
    expect(html).toMatch(/<h1 [^>]*id="contact-heading"/);
    expect(html).toContain('Tell us about <span class="text-brand">the wedding.</span>');
    expect(html).toMatch(/<form id="chat" novalidate="" aria-labelledby="contact-heading"/i);
    expect(html).toContain("There is no sign-up form.");
  });

  it("opens on the enquiry, or on the demo request from ?type=demo", () => {
    const enquiry = renderForm(false);
    expect(inputWith(enquiry, 'value="enquiry"')).toContain('checked=""');
    expect(inputWith(enquiry, 'value="demo"')).not.toContain('checked=""');
    const demo = renderForm(true);
    expect(inputWith(demo, 'value="demo"')).toContain('checked=""');
    expect(inputWith(demo, 'id="requestedDemo"')).toContain('checked=""');
  });

  it("asks for the mock's fields, the mobile behind +91 and no reply way chosen yet (Any)", () => {
    const html = renderForm(false);
    for (const label of [
      "Full name",
      "Mobile number",
      "Best way to reach you",
      "Tentative dates",
      "Destination",
      "About how many guests?",
      "Anything else we should know?",
    ])
      expect(html).toContain(label);
    expect(html).toContain(">+91</span>");
    expect(html).toMatch(/>Email<span[^>]*> · optional<\/span>/);
    for (const value of ["whatsapp", "phone", "email"])
      expect(inputWith(html, `value="${value}"`)).not.toContain('checked=""');
    // "Any" sends no preference, and lets a visitor take a mis-tapped channel back.
    expect(inputWith(html, 'name="contactPreference"', 'value=""')).toContain('checked=""');
    expect(html).toMatch(/<button type="submit"[^>]*><span[^>]*>Send request<\/span>/);
  });

  it("opens the privacy notice in a new tab, so nothing typed is lost, and says so", () => {
    expect(renderForm(false)).toMatch(
      /href="\/privacy" target="_blank" rel="noreferrer"[^>]*>Privacy notice<span class="sr-only"> \(opens in a new tab\)<\/span><\/a>/,
    );
  });

  it("leaves the chat anchor to AMPM's channels when they are listed", () => {
    expect(renderForm(false, false)).not.toContain('id="chat"');
  });
});

describe("request received", () => {
  it("names the call to the mobile for a demo request, with the three next steps", () => {
    const html = renderToStaticMarkup(
      <ThankYou firstName="Ananya" request={{ phone: "+919876543210", requestedDemo: true }} />,
    );
    expect(html).toMatch(/<h1 [^>]*tabindex="-1"[^>]*>Thank you, Ananya.<\/h1>/);
    expect(html).toContain("We have your demo request. Someone from AMPM will call you on ");
    expect(html).toContain(">+91 98765 43210</span> to set it up.");
    expect(html.match(/<li /g)).toHaveLength(3);
    expect(html).toContain("A 15–20 minute Zoom walkthrough");
    expect(html).toMatch(/href="\/"[^>]*><span[^>]*>Back to home<\/span>/);
    // The gold "Chat with AMPM" waits for a WhatsApp number to open.
    expect(html).not.toContain("Chat with AMPM");
  });

  it("names the email for an enquiry that gave only an email", () => {
    const html = renderToStaticMarkup(
      <ThankYou
        firstName="Rhea"
        request={{ email: "rhea@example.com", contactPreference: "whatsapp" }}
      />,
    );
    expect(html).toContain("We have your enquiry. Someone from AMPM will email you at ");
    expect(html).toContain(">rhea@example.com</span> to fill in the rest.");
    expect(html.match(/<li /g)).toHaveLength(2);
  });

  it("names WhatsApp when that was the way chosen", () => {
    const html = renderToStaticMarkup(
      <ThankYou
        firstName="Rhea"
        request={{ phone: "+919876543210", contactPreference: "whatsapp", requestedDemo: false }}
      />,
    );
    expect(html).toContain("Someone from AMPM will message you on WhatsApp at ");
  });
});
