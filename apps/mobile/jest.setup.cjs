// Safe-area insets without a native host; the mock reports zero insets and a phone-sized frame.
jest.mock(
  "react-native-safe-area-context",
  () => require("react-native-safe-area-context/jest/mock").default,
);

// Amazon Cognito through Amplify: the app's session/auth modules import aws-amplify, whose SDK does not
// load under jest-expo. Stub the surfaces the app uses so any suite that transitively imports them loads;
// a suite that actually exercises Cognito overrides these per file.
jest.mock("aws-amplify", () => ({ Amplify: { configure: jest.fn() } }));
jest.mock("aws-amplify/auth", () => ({
  signIn: jest.fn(),
  confirmSignIn: jest.fn(),
  signOut: jest.fn(),
  fetchAuthSession: jest.fn(async () => ({ tokens: undefined })),
  fetchMFAPreference: jest.fn(async () => ({})),
  setUpTOTP: jest.fn(),
  verifyTOTPSetup: jest.fn(),
  updateMFAPreference: jest.fn(),
}));
jest.mock("aws-amplify/auth/cognito", () => ({
  cognitoUserPoolsTokenProvider: { setKeyValueStorage: jest.fn() },
}));
jest.mock("aws-amplify/utils", () => ({ Hub: { listen: jest.fn(() => jest.fn()) } }));
jest.mock("react-native-get-random-values", () => ({}));
jest.mock("react-native-qrcode-svg", () => ({ __esModule: true, default: () => null }));
jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));
