import { useRouter } from "expo-router";

import { StaffSignInScreen } from "./staff-sign-in-screen";
import { useAmpmSignIn } from "./use-ampm-sign-in";

/**
 * Staff sign-in with AMPM's own sign-in (`EXPO_PUBLIC_IDENTITY_PROVIDER=ampm`, D-142): the work email
 * and password, then the 6-digit authenticator code or a recovery code, with a forgotten-password link.
 */
export function AmpmSignInScreen() {
  const router = useRouter();
  return (
    <StaffSignInScreen
      session={useAmpmSignIn()}
      onForgot={() => {
        router.push("/forgot-password");
      }}
    />
  );
}
