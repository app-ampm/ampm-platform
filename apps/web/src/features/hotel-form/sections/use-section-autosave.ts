import { useEffect, useRef, type RefObject } from "react";
import { useSaveHotelFormSection } from "@ampm/api-client";
import type { HotelFormSectionKey } from "@ampm/core";

import type { HotelFormSite } from "../hotel-form-provider";
import {
  createSectionAutosave,
  type SaveState,
  type SectionAutosave,
  type SectionPayload,
} from "./section-autosave";
import { saveRefusalOf } from "./section-save";

/** A save asked for while the flow holds no session (a new code is being asked for). */
const NO_SESSION = new Error("No form session");

/** The section as the page opened it: its version and what the API held. */
export interface OpenedSection<K extends HotelFormSectionKey> {
  readonly version: number;
  readonly saved: SectionPayload<K>;
}

/**
 * A section page's autosave (D-190 §5), made once the page is in the browser and flushed when it goes:
 * each save goes as `PUT /hotel-form/draft/sections/:key` inside the flow's session; a session refused on
 * the way is handed to the flow, which asks for a new code in place, and the save waiting meanwhile goes
 * once the new session is there. The page is also saved when it is hidden (another tab, the phone locked).
 *
 *   const autosave = useSectionAutosave("rooms", site, opened, setSaveState);
 *   autosave.current?.change(payload);
 */
export function useSectionAutosave<K extends HotelFormSectionKey>(
  key: K,
  site: HotelFormSite,
  opened: OpenedSection<K>,
  onState: (state: SaveState<K>) => void,
): RefObject<SectionAutosave<K> | null> {
  const { mutateAsync } = useSaveHotelFormSection();
  const live = useRef({ site, mutateAsync, opened });
  useEffect(() => {
    live.current = { site, mutateAsync, opened };
  });
  const run = useRef<SectionAutosave<K> | null>(null);
  useEffect(() => {
    const autosave = createSectionAutosave<K>({
      ...live.current.opened,
      send: (payload, expectedVersion) => {
        const sessionToken = live.current.site.flow.state.session;
        if (sessionToken === null) return Promise.reject(NO_SESSION);
        const save = { answers: payload.answers, expectedVersion, noChanges: payload.noChanges };
        return live.current.mutateAsync({ sessionToken, section: key, save });
      },
      refusalOf: (error) => {
        if (error === NO_SESSION) return { kind: "session" };
        const refusal = saveRefusalOf(error, key);
        if (refusal.kind === "session") live.current.site.flow.refuseSession(error);
        return refusal;
      },
      onState,
    });
    run.current = autosave;
    return () => {
      autosave.dispose();
      run.current = null;
    };
  }, [key, onState]);
  useResumeAndHide(run, site.flow.state.session);
  return run;
}

/** Saves what waited once a new session is there, and saves at once when the page is hidden. */
function useResumeAndHide<K extends HotelFormSectionKey>(
  run: RefObject<SectionAutosave<K> | null>,
  session: string | null,
) {
  useEffect(() => {
    if (session !== null) run.current?.resume();
  }, [run, session]);
  useEffect(() => {
    const flush = () => run.current?.flush();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
    };
  }, [run]);
}
