import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { BotCheck } from "./bot-check";
import { BotCheckField, botCheckStatusId, type BotCheckCopy } from "./bot-check-field";

/** The enquiry form's words, as the contact page passes them. */
const COPY: BotCheckCopy = {
  checking: "Running a quick security check before you send…",
  passed: "Security check passed. You can send your request.",
  failed: "The security check did not finish. Check your connection, then try again.",
  unsupported: "This browser cannot run our security check. Please try another browser.",
  retry: "Try the check again",
};

/** The bot check above Send in each of its states, as the server sends it (PUB-06). */
function render(check: BotCheck, copy: BotCheckCopy = COPY, id = "bot-check"): string {
  return renderToStaticMarkup(
    <BotCheckField
      id={id}
      copy={copy}
      check={check}
      containerRef={() => undefined}
      onRetry={() => undefined}
    />,
  );
}

describe("bot check field", () => {
  it("keeps the widget's room and describes Send, silently, while the check runs", () => {
    const html = render({ status: "checking" });
    expect(html).toContain('<div id="bot-check" class="min-h-16"></div>');
    // Visually hidden and not a live region: a token's routine refresh is never announced.
    expect(html).toContain(
      '<p id="bot-check-status" class="sr-only">Running a quick security check before you send…</p>',
    );
    expect(html).not.toContain("role=");
    expect(html).not.toContain("<button");
  });

  it("describes Send as ready once the check passes, without ever printing the token", () => {
    const html = render({ status: "passed", token: "token-1" });
    expect(html).toContain(
      '<p id="bot-check-status" class="sr-only">Security check passed. You can send your request.</p>',
    );
    expect(html).not.toContain("token-1");
  });

  it("announces a failed check as a notice, with a way to run it again", () => {
    const html = render({ status: "failed" });
    expect(html).toContain('<div id="bot-check"></div>');
    expect(html).toMatch(
      /<p id="bot-check-status" role="alert" class="[^"]+">The security check did not finish. Check your connection, then try again.<\/p>/,
    );
    expect(html).not.toContain('class="sr-only"');
    expect(html).toMatch(
      /<button type="button" class="[^"]*min-h-touch[^"]*"><span[^>]*>Try the check again<\/span><\/button>/,
    );
  });

  it("takes its words and its ids from the form it guards (the hotel form's code request)", () => {
    const html = render(
      { status: "failed" },
      { ...COPY, failed: "The check did not finish.", retry: "Run it again" },
      "hf-bot-check",
    );
    expect(html).toContain('<div id="hf-bot-check"></div>');
    expect(html).toMatch(
      /<p id="hf-bot-check-status" role="alert"[^>]*>The check did not finish.<\/p>/,
    );
    expect(html).toContain(">Run it again</span>");
    expect(botCheckStatusId("hf-bot-check")).toBe("hf-bot-check-status");
  });

  it("offers no retry to a browser that cannot run the check", () => {
    const html = render({ status: "unsupported" });
    expect(html).toMatch(
      /role="alert"[^>]*>This browser cannot run our security check. Please try another browser.<\/p>/,
    );
    expect(html).not.toContain("<button");
  });
});
