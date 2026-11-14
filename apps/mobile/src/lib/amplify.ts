// The SRP flow needs a secure RNG; the polyfill must load before aws-amplify uses crypto.
import "react-native-get-random-values";

import { Amplify } from "aws-amplify";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";
import { Platform } from "react-native";

import { SecureKeyValueStorage } from "./cognito-storage";
import { env } from "./env";

let configured = false;

/**
 * Configure Amplify for Cognito once, before any sign-in — call at the app root. A no-op unless
 * `EXPO_PUBLIC_IDENTITY_PROVIDER=cognito` (the demo keeps dev-login on `local`). On native the token
 * store is the device keychain (SecureStore); on the web export Amplify keeps its own default storage.
 */
export function configureAmplify(): void {
  if (configured || env.EXPO_PUBLIC_IDENTITY_PROVIDER !== "cognito") return;

  const userPoolId = env.EXPO_PUBLIC_COGNITO_USER_POOL_ID;
  const userPoolClientId = env.EXPO_PUBLIC_COGNITO_CLIENT_ID;
  if (userPoolId === undefined || userPoolClientId === undefined) {
    throw new Error(
      "EXPO_PUBLIC_COGNITO_USER_POOL_ID and EXPO_PUBLIC_COGNITO_CLIENT_ID are required when EXPO_PUBLIC_IDENTITY_PROVIDER=cognito",
    );
  }

  if (Platform.OS !== "web") {
    cognitoUserPoolsTokenProvider.setKeyValueStorage(new SecureKeyValueStorage());
  }
  Amplify.configure({ Auth: { Cognito: { userPoolId, userPoolClientId } } });
  configured = true;
}
