import { isValidElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { RetryButton } from "./retry-button";

describe("RetryButton", () => {
  it("is the kit's gold pill on a real button", () => {
    const html = renderToStaticMarkup(
      <RetryButton onRetry={() => undefined}>Try again</RetryButton>,
    );
    expect(html).toMatch(
      /^<button type="button" class="[^"]*bg-brand[^"]*"><span [^>]*>Try again<\/span><\/button>$/,
    );
  });

  it("asks Next to try the page again when pressed, passing it nothing of the click", () => {
    const onRetry = vi.fn();
    const button = RetryButton({ onRetry, children: "Try again" });
    expect(isValidElement<{ readonly onClick: () => void }>(button)).toBe(true);
    if (isValidElement<{ readonly onClick: () => void }>(button)) button.props.onClick();
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith();
  });
});
