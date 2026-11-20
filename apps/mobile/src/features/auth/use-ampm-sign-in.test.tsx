import { SIGN_IN_ERRORS } from "@ampm/core";

import { act, renderHook, waitFor } from "../../test/render";
import { useAmpmSignIn } from "./use-ampm-sign-in";

const mockReplace = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: mockReplace, push: jest.fn(), back: jest.fn() }),
}));

const mockClear = jest.fn();
jest.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ clear: mockClear }) }));

const mockSetAccessToken = jest.fn();
jest.mock("@/lib/session", () => ({
  setAccessToken: (token: string | null) => mockSetAccessToken(token),
}));

const mockSignIn = jest.fn();
const mockCode = jest.fn();
jest.mock("@ampm/api-client", () => ({
  useSignIn: () => ({ mutateAsync: (body: unknown) => mockSignIn(body) }),
  useSignInCode: () => ({ mutateAsync: (body: unknown) => mockCode(body) }),
}));

const GRANT = {
  accessToken: "token-1",
  user: { id: "u", name: "Sana", email: "sana@ampm.example" },
};

beforeEach(() => {
  jest.clearAllMocks();
});

async function signedInWithPassword() {
  mockSignIn.mockResolvedValue({ kind: "totp", challenge: "challenge-1" });
  const hook = await renderHook(() => useAmpmSignIn());
  await act(() => hook.result.current.setEmail("sana@ampm.example"));
  await act(() => hook.result.current.signIn("a long enough passphrase"));
  await waitFor(() => expect(hook.result.current.phase.kind).not.toBe("credentials"));
  return hook;
}

describe("useAmpmSignIn", () => {
  it("asks for the code after the password, then starts the session", async () => {
    const { result } = await signedInWithPassword();
    expect(mockSignIn).toHaveBeenCalledWith({
      email: "sana@ampm.example",
      password: "a long enough passphrase",
    });
    expect(result.current.phase).toEqual({ kind: "totpCode" });
    mockCode.mockResolvedValue(GRANT);
    await act(() => result.current.submitChallenge("123456"));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"));
    expect(mockCode).toHaveBeenCalledWith({ challenge: "challenge-1", code: "123456" });
    expect(mockSetAccessToken).toHaveBeenCalledWith("token-1");
    expect(mockClear).toHaveBeenCalled();
  });

  it("takes a recovery code instead of the authenticator code", async () => {
    const { result } = await signedInWithPassword();
    await act(() => result.current.toggleRecoveryCode?.());
    expect(result.current.phase).toEqual({ kind: "recoveryCode" });
    mockCode.mockResolvedValue(GRANT);
    await act(() => result.current.submitRecoveryCode?.("ABCDE-23456"));
    await waitFor(() => expect(mockSetAccessToken).toHaveBeenCalledWith("token-1"));
    expect(mockCode).toHaveBeenCalledWith({
      challenge: "challenge-1",
      recoveryCode: "ABCDE-23456",
    });
  });

  it("goes back to the password when the challenge has timed out", async () => {
    const { result } = await signedInWithPassword();
    mockCode.mockRejectedValue(new Error(SIGN_IN_ERRORS.challengeExpired));
    await act(() => result.current.submitChallenge("123456"));
    await waitFor(() => expect(result.current.phase).toEqual({ kind: "credentials" }));
    expect(result.current.error).toBe(SIGN_IN_ERRORS.challengeExpired);
    expect(mockSetAccessToken).not.toHaveBeenCalled();
  });
});
