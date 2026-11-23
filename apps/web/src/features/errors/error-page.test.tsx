import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ErrorPage } from "./error-page";

const SECRET_DETAIL = new Error("connect ECONNREFUSED 10.0.0.3:5432");

function renderErrorPage(): string {
  return renderToStaticMarkup(
    <ErrorPage error={SECRET_DETAIL} retry={() => undefined} scope="page" />,
  );
}

describe("ErrorPage", () => {
  it("titles the tab and says what happened as the page's h1, never the raw error", () => {
    const html = renderErrorPage();
    expect(html).toContain("<title>Something went wrong · AMPM</title>");
    expect(html).toMatch(
      /<h1 [^>]*>We couldn&#x27;t load <span class="text-brand">this page\.<\/span><\/h1>/,
    );
    expect(html).not.toContain("ECONNREFUSED");
  });

  it("offers Try again as a real button first, then the way back to the home page", () => {
    const html = renderErrorPage();
    expect(html).toMatch(/<button type="button"[^>]*><span[^>]*>Try again<\/span><\/button>/);
    expect(html).toMatch(/<a [^>]*href="\/"[^>]*><span[^>]*>Back to home<\/span><\/a>/);
    expect(html.indexOf("Try again")).toBeLessThan(html.indexOf("Back to home"));
  });
});
