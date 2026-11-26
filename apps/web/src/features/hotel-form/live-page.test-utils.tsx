import { act, useState, type ComponentType } from "react";
import { mount, type Mounted } from "@ampm/web-forms/testing";

import { HotelFormSiteContext, type HotelFormSite } from "./hotel-form-provider";

/*
 * A page of the form mounted under a site the test can replace while the page stays mounted, as the
 * layout's flow does on every render: a draft read again, a new code entered in place, someone else
 * signing in. Imported by tests only.
 */

/** A page mounted under a site `rerender` replaces. */
export interface LivePage extends Mounted {
  /** Draws the page again under `site`. */
  readonly rerender: (site: HotelFormSite) => Promise<void>;
}

/**
 * `Page` under `site`, which `rerender` replaces while the page stays mounted.
 *
 *   const page = await mountLivePage(HotelFormReviewPage, reviewSite(READY));
 *   await page.rerender(reviewSite(later));
 */
export async function mountLivePage(Page: ComponentType, site: HotelFormSite): Promise<LivePage> {
  let replace: (next: HotelFormSite) => void = () => undefined;
  function Live() {
    const [current, setCurrent] = useState(site);
    replace = setCurrent;
    return (
      <HotelFormSiteContext.Provider value={current}>
        <Page />
      </HotelFormSiteContext.Provider>
    );
  }
  const mounted = await mount(<Live />);
  return {
    ...mounted,
    rerender: async (next) => {
      await act(async () => replace(next));
    },
  };
}
