import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { BotCheck } from "./bot-check";
import { BotCheckField } from "./bot-check-field";

/** The bot check above Send in each of its states, as the server sends it (PUB-06). */
function render(check: BotCheck): string {
  return renderToStaticMarkup(
    <BotCheckField check={check} containerRef={() => undefined} onRetry={() => undefined} />,
  );
}

describe("bot check field", () => {
  it("keeps the widget's room and tells a screen reader the check is running", () => {
    const html = render({ status: "checking" });
    expect(html).toContain('<div id="bot-check" class="min-h-16"></div>');
    expect(html).toContain(
      '<p id="bot-check-status" role="status" class="sr-only">Running a quick security check before you send…</p>',
    );
    expect(html).not.toContain("<button");
  });

  it("tells a screen reader that Send is ready, without ever printing the token", () => {
    const html = render({ status: "passed", token: "token-1" });
    expect(html).toMatch(
      /role="status" class="sr-only">Security check passed. You can send your request.<\/p>/,
    );
    expect(html).not.toContain("token-1");
  });

  it("shows a failed check as a notice, with a way to run it again", () => {
    const html = render({ status: "failed" });
    expect(html).toContain('<div id="bot-check"></div>');
    expect(html).toMatch(
      /<p id="bot-check-status" role="status" class="[^"]+">The security check did not finish. Check your connection, then try again.<\/p>/,
    );
    expect(html).not.toContain('class="sr-only"');
    expect(html).toMatch(
      /<button type="button" class="[^"]*min-h-touch[^"]*"><span[^>]*>Try the check again<\/span><\/button>/,
    );
  });

  it("offers no retry to a browser that cannot run the check", () => {
    const html = render({ status: "unsupported" });
    expect(html).toContain(
      "This browser cannot run our security check. Please try another browser.",
    );
    expect(html).not.toContain("<button");
  });
});
