import { Redirect } from "expo-router";

import { isSignedIn } from "@/lib/session";

/** Entry: a signed-in visitor goes to the Sales workspace, otherwise to the dev sign-in. */
export default function IndexRoute() {
  return <Redirect href={isSignedIn() ? "/leads" : "/sign-in"} />;
}
