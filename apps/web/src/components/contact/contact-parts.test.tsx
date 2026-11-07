import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CheckboxField } from "./checkbox-field";
import { ChoiceSegments } from "./choice-segments";
import { ContactChannelList } from "./contact-channel-list";
import {
  CONTACT_CHANNELS,
  channelHref,
  reachableChannels,
  type ContactChannel,
} from "./contact-channels";
import { DateRangeField } from "./date-range-field";

/* The contact page's Peacock Night parts, rendered as the server sends them (W6). */

const noop = () => undefined;

/** The `<input …>` tags carrying `attribute`, whatever order React writes their attributes in. */
function inputsWith(html: string, attribute: string): string[] {
  return [...html.matchAll(/<input[^>]*>/g)]
    .map((match) => match[0])
    .filter((tag) => tag.includes(attribute));
}

describe("contact channels", () => {
  it("lists only the channels AMPM has given an address for", () => {
    expect(reachableChannels(CONTACT_CHANNELS).every((channel) => channel.href)).toBe(true);
    const channels = reachableChannels([
      { key: "phone", label: "Call us", href: "tel:+910000000000" },
      { key: "whatsapp", label: "WhatsApp", href: null },
    ]);
    expect(channels.map((channel) => channel.label)).toEqual(["Call us"]);
  });

  it("gives one channel's address only once AMPM has given it", () => {
    expect(channelHref("whatsapp")).toBeNull();
    const withNumber: readonly ContactChannel[] = [
      { key: "whatsapp", label: "WhatsApp", href: "https://wa.me/910000000000" },
    ];
    expect(channelHref("whatsapp", withNumber)).toBe("https://wa.me/910000000000");
    expect(channelHref("email", withNumber)).toBeNull();
  });

  it("draws each channel as a link with an arrow, where the chat link lands", () => {
    const html = renderToStaticMarkup(
      <ContactChannelList
        channels={[{ key: "email", label: "Email", href: "mailto:team@example.com" }]}
      />,
    );
    expect(html).toMatch(/<ul id="chat"/);
    expect(html).toMatch(/<a href="mailto:team@example.com"[^>]*><span[^>]*>Email<\/span>/);
    expect(html).toContain('<span aria-hidden="true"');
  });

  it("draws nothing without a channel", () => {
    expect(renderToStaticMarkup(<ContactChannelList channels={[]} />)).toBe("");
  });
});

describe("pill choices", () => {
  const options = [
    { value: "whatsapp", label: "WhatsApp" },
    { value: "phone", label: "Call" },
  ];

  it("are native radios in a fieldset named by its legend, the chosen one checked", () => {
    const html = renderToStaticMarkup(
      <ChoiceSegments
        name="reach"
        legend="Best way to reach you"
        options={options}
        value="phone"
        onChange={noop}
        look="soft"
      />,
    );
    expect(html).toMatch(/<fieldset[^>]*><legend[^>]*>Best way to reach you<\/legend>/);
    expect(inputsWith(html, 'name="reach"')).toHaveLength(2);
    expect(inputsWith(html, 'type="radio"')).toHaveLength(2);
    expect(inputsWith(html, 'value="phone"')[0]).toContain('checked=""');
    expect(inputsWith(html, 'value="whatsapp"')[0]).not.toContain('checked=""');
    // The soft look: peacock glass behind the chosen word, not the switch's solid peacock.
    expect(html).toContain("bg-highlight/30");
  });

  it("start with nothing chosen and keep the legend for screen readers when hidden", () => {
    const html = renderToStaticMarkup(
      <ChoiceSegments
        name="type"
        legend="Type of request"
        isLegendHidden
        options={options}
        value=""
        onChange={noop}
      />,
    );
    expect(html).not.toContain('checked=""');
    expect(html).toContain('<legend class="sr-only">Type of request</legend>');
  });

  it("show an error in gold and point the radios at it", () => {
    const html = renderToStaticMarkup(
      <ChoiceSegments
        name="reach"
        legend="Reach"
        options={options}
        value=""
        onChange={noop}
        error="Pick one"
      />,
    );
    expect(html).toContain('<p id="reach-error" role="alert"');
    expect(html).toContain('aria-describedby="reach-error"');
  });
});

describe("checkbox", () => {
  it("keeps a native checkbox and draws the peacock box with a midnight tick when checked", () => {
    const html = renderToStaticMarkup(
      <CheckboxField id="consent" label="Send me news" checked onChange={noop} />,
    );
    expect(inputsWith(html, 'type="checkbox"')[0]).toContain('checked=""');
    expect(html).toContain("bg-highlight");
    expect(html).toContain("✓");
  });

  it("draws an empty box when not checked", () => {
    const html = renderToStaticMarkup(
      <CheckboxField id="consent" label="Send me news" checked={false} onChange={noop} />,
    );
    expect(html).not.toContain("✓");
    expect(html).toContain("border-primary/34");
  });
});

describe("date range", () => {
  const bound = (id: string, label: string, error?: string) => ({
    id,
    label,
    value: "",
    onChange: noop,
    error,
  });

  it("names the group and each date for screen readers", () => {
    const html = renderToStaticMarkup(
      <DateRangeField
        legend="Tentative dates"
        from={bound("from", "From")}
        to={bound("to", "To")}
      />,
    );
    expect(html).toMatch(/<legend[^>]*>Tentative dates<\/legend>/);
    expect(html).toMatch(/<input id="from"[^>]*type="date" aria-label="From"/);
    expect(html).not.toContain('role="alert"');
  });

  it("shows the range error once, on the date it belongs to", () => {
    const html = renderToStaticMarkup(
      <DateRangeField
        legend="Tentative dates"
        from={bound("from", "From")}
        to={bound("to", "To", "The end date is before the start date")}
      />,
    );
    expect(html.match(/role="alert"/g)).toHaveLength(1);
    expect(html).toMatch(/<input id="to" aria-invalid="true" aria-describedby="to-error"/);
    expect(html).toMatch(/<input id="from" type="date"/);
  });
});
