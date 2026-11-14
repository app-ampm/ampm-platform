import { CognitoSignInScreen } from "@/features/auth/cognito-sign-in-screen";
import { SignInScreen } from "@/features/auth/sign-in-screen";
import { env } from "@/lib/env";

export default function SignInRoute() {
  return env.EXPO_PUBLIC_IDENTITY_PROVIDER === "cognito" ? (
    <CognitoSignInScreen />
  ) : (
    <SignInScreen />
  );
}
