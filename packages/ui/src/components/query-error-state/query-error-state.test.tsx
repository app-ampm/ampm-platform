import { Text } from "react-native";

import { errors } from "@ampm/core";

import { uiCopy } from "../../copy";
import { classes, fireEvent, renderWithProviders, screen } from "../../test/render";
import { QueryErrorState } from "./query-error-state";

const LEAD_GONE = { title: "Lead not found", description: "It may have been removed." };
const NOT_YOURS = { title: "Not available for your role" };
const SIGN_OUT = "Sign out";

describe("QueryErrorState", () => {
  it("shows the offline state with a retry when the request never reached the API", async () => {
    const onRetry = jest.fn();
    await renderWithProviders(<QueryErrorState error={errors.network()} onRetry={onRetry} />);
    expect(screen.getByText(uiCopy.offline.title)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("button", { name: uiCopy.retry }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("asks a signed-out person to sign in through the gold action, not a retry", async () => {
    const onSignIn = jest.fn();
    await renderWithProviders(
      <QueryErrorState error={errors.unauthenticated()} onRetry={jest.fn()} onSignIn={onSignIn} />,
    );
    expect(screen.getByRole("header", { name: uiCopy.queryError.signIn.title })).toBeOnTheScreen();
    const action = screen.getByRole("button", { name: uiCopy.queryError.signIn.action });
    expect(classes(action.props.className)).toContain("bg-brand");
    // A retry would only be refused again.
    expect(screen.queryByRole("button", { name: uiCopy.retry })).toBeNull();
    await fireEvent.press(action);
    expect(onSignIn).toHaveBeenCalled();
  });

  it("takes the screen's words for the sign-in", async () => {
    await renderWithProviders(
      <QueryErrorState
        error={errors.unauthenticated()}
        onSignIn={jest.fn()}
        signIn={{
          title: "Sign in to view leads",
          description: "Your session has ended.",
          actionLabel: "Sign in again",
        }}
      />,
    );
    expect(screen.getByText("Sign in to view leads")).toBeOnTheScreen();
    expect(screen.getByText("Your session has ended.")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Sign in again" })).toBeOnTheScreen();
  });

  it("says what a 404 means on the screen, with nothing to retry", async () => {
    await renderWithProviders(
      <QueryErrorState error={errors.notFound()} onRetry={jest.fn()} notFound={LEAD_GONE} />,
    );
    expect(screen.getByRole("header", { name: LEAD_GONE.title })).toBeOnTheScreen();
    expect(screen.getByText(LEAD_GONE.description)).toBeOnTheScreen();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("says what a 403 means on the screen, with nothing to retry", async () => {
    await renderWithProviders(
      <QueryErrorState
        error={errors.forbidden()}
        onRetry={jest.fn()}
        notFound={LEAD_GONE}
        forbidden={NOT_YOURS}
      />,
    );
    expect(screen.getByRole("header", { name: NOT_YOURS.title })).toBeOnTheScreen();
    expect(screen.queryByText(LEAD_GONE.title)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each([
    ["a 401 the screen cannot sign in from", errors.unauthenticated()],
    ["a 404 the screen gives no meaning", errors.notFound()],
    ["a 403 the screen gives no meaning", errors.forbidden()],
    ["a server failure", errors.internal('relation "leads" does not exist')],
    ["a failure that is not the API's", new Error("Unexpected token < in JSON")],
  ])("shows the generic error with a retry for %s, never its message", async (_case, error) => {
    const onRetry = jest.fn();
    await renderWithProviders(<QueryErrorState error={error} onRetry={onRetry} />);
    expect(screen.getByText(uiCopy.error.title)).toBeOnTheScreen();
    expect(screen.queryByText(error.message)).toBeNull();
    await fireEvent.press(screen.getByRole("button", { name: uiCopy.retry }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("puts the footer under the generic error", async () => {
    await renderWithProviders(
      <QueryErrorState
        error={errors.internal()}
        onRetry={jest.fn()}
        errorFooter={<Text>{SIGN_OUT}</Text>}
      />,
    );
    expect(screen.getByText(uiCopy.error.title)).toBeOnTheScreen();
    expect(screen.getByText(SIGN_OUT)).toBeOnTheScreen();
  });

  it.each([
    ["offline", errors.network()],
    ["signed out", errors.unauthenticated()],
    ["on a 404 the screen gives a meaning", errors.notFound()],
  ])("leaves the footer out when %s", async (_case, error) => {
    await renderWithProviders(
      <QueryErrorState
        error={error}
        onSignIn={jest.fn()}
        notFound={LEAD_GONE}
        errorFooter={<Text>{SIGN_OUT}</Text>}
      />,
    );
    expect(screen.queryByText(SIGN_OUT)).toBeNull();
  });

  it("hands testID and className to the state it draws", async () => {
    await renderWithProviders(
      <QueryErrorState error={errors.network()} testID="failed" className="mt-4" />,
    );
    expect(screen.getByText(uiCopy.offline.title)).toBeOnTheScreen();
    expect(classes(screen.getByTestId("failed").props.className)).toContain("mt-4");
  });
});
