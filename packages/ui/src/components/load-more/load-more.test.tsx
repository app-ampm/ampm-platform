import { fireEvent, renderWithProviders, screen } from "../../test/render";
import { LoadMore } from "./load-more";

describe("LoadMore", () => {
  it("renders a button that reports presses while more pages remain", async () => {
    const onLoadMore = jest.fn();
    await renderWithProviders(<LoadMore hasMore loading={false} onLoadMore={onLoadMore} />);
    expect(screen.getByText("Load more")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("load-more"));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it("renders nothing once the list is exhausted", async () => {
    await renderWithProviders(<LoadMore hasMore={false} loading={false} onLoadMore={jest.fn()} />);
    expect(screen.queryByTestId("load-more")).toBeNull();
  });

  it("shows a busy state and ignores presses while the next page loads", async () => {
    const onLoadMore = jest.fn();
    await renderWithProviders(<LoadMore hasMore loading onLoadMore={onLoadMore} />);
    await fireEvent.press(screen.getByTestId("load-more"));
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  it("accepts a custom label", async () => {
    await renderWithProviders(
      <LoadMore hasMore loading={false} onLoadMore={jest.fn()} label="Show older" />,
    );
    expect(screen.getByText("Show older")).toBeOnTheScreen();
  });

  it("labels itself as a retry after a failed attempt and keeps the footer", async () => {
    const onLoadMore = jest.fn();
    await renderWithProviders(<LoadMore hasMore loading={false} failed onLoadMore={onLoadMore} />);
    expect(screen.getByText("Couldn't load more — tap to retry")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("load-more"));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
