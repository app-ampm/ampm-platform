import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ContactChannelList } from "./contact-channel-list";
import {
  CONTACT_CHANNELS,
  channelHref,
  reachableChannels,
  type ContactChannel,
} from "./contact-channels";
import { DateRangeField } from "./date-range-field";

/*
 * The contact page's own Peacock Night parts, rendered as the server sends them (W6). The fields it
 * shares with the hotel form (pill choices, checkbox, text fields) are tested in @ampm/web-forms.
 */

const noop = () => undefined;

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
