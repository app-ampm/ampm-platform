// @vitest-environment jsdom
import {
  ApiProvider,
  createQueryClient,
  HOTEL_FORM_DRAFT_QUERY_KEY,
  HOTEL_FORM_ME_QUERY_KEY,
} from "@ampm/api-client";
import { buttonNamed, mount, press, type Mounted } from "@ampm/web-forms/testing";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FlowEvent } from "./flow";
import type { SessionStore } from "./hotel-form-link";
import type { SessionRefusal } from "./refusal";
import { ME } from "./screen.test-utils";
import { useSessionRefused } from "./use-hotel-form-flow";

/*
 * A refused session as the flow takes it (D-189 §5, D-190 §5): the session is forgotten for the tab; when
 * the refusal ends at HF-08 every query of the form is forgotten too, while a new code asked for in place
 * keeps the page's data until the code reads it again.
 */

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
});

/** A page that hands the flow one refusal when its button is pressed. */
function Refuses({
  refusal,
  dispatch,
}: {
  readonly refusal: SessionRefusal;
  readonly dispatch: (event: FlowEvent) => void;
}) {
  const storage = { current: null as SessionStore | null };
  const refused = useSessionRefused(dispatch, storage);
  return (
    <button type="button" onClick={() => refused(refusal, ME.person)}>
      Refuse
    </button>
  );
}

async function refuse(refusal: SessionRefusal) {
  const queryClient = createQueryClient();
  queryClient.setQueryData(HOTEL_FORM_ME_QUERY_KEY, ME);
  queryClient.setQueryData(HOTEL_FORM_DRAFT_QUERY_KEY, { contributors: [] });
  const dispatch = vi.fn<(event: FlowEvent) => void>();
  mounted = await mount(
    <ApiProvider baseUrl="https://api.example.test" queryClient={queryClient}>
      <Refuses refusal={refusal} dispatch={dispatch} />
    </ApiProvider>,
  );
  await press(buttonNamed(mounted.host, "Refuse"));
  return { queryClient, dispatch };
}

describe("a refused session", () => {
  it("that ends at HF-08 forgets every query of the form, the person no longer to see them", async () => {
    const { queryClient, dispatch } = await refuse({ kind: "gone", message: null });
    expect(queryClient.getQueryData(HOTEL_FORM_DRAFT_QUERY_KEY)).toBeUndefined();
    expect(queryClient.getQueryData(HOTEL_FORM_ME_QUERY_KEY)).toBeUndefined();
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: "session_refused" }));
  });

  it("that asks for a new code in place keeps the page's data until the code reads it again", async () => {
    const message = "Your session timed out. Enter a new code to continue.";
    const { queryClient, dispatch } = await refuse({ kind: "new_code", message });
    expect(queryClient.getQueryData(HOTEL_FORM_DRAFT_QUERY_KEY)).toEqual({ contributors: [] });
    expect(dispatch).toHaveBeenCalledTimes(1);
  });
});
