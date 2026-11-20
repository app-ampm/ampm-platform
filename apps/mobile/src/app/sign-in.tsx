import { AmpmSignInScreen } from "@/features/auth/ampm-sign-in-screen";
import { SignInScreen } from "@/features/auth/sign-in-screen";
import { env } from "@/lib/env";

/** Sign-in for the provider the build was made for: AMPM's own (D-142), or the dev sign-in. */
export default function SignInRoute() {
  switch (env.EXPO_PUBLIC_IDENTITY_PROVIDER) {
    case "ampm":
      return <AmpmSignInScreen />;
    case "local":
      return <SignInScreen />;
  }
}
