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
const mockEnrol = jest.fn();
jest.mock("@ampm/api-client", () => ({
  useSignIn: () => ({ mutateAsync: (body: unknown) => mockSignIn(body) }),
  useSignInCode: () => ({ mutateAsync: (body: unknown) => mockCode(body) }),
  useSignInEnrol: () => ({ mutateAsync: (body: unknown) => mockEnrol(body) }),
}));

const GRANT = {
  accessToken: "token-1",
  user: { id: "u", name: "Sana", email: "sana@ampm.example" },
};

beforeEach(() => {
  jest.clearAllMocks();
});

async function signedInWithPassword(kind: "totp" | "enrol") {
  mockSignIn.mockResolvedValue(
    kind === "totp"
      ? { kind, challenge: "challenge-1" }
      : {
          kind,
          challenge: "challenge-1",
          enrolment: { secret: "SECRET", otpauthUri: "otpauth://totp/x" },
        },
  );
  const hook = await renderHook(() => useAmpmSignIn());
  await act(() => hook.result.current.setEmail("sana@ampm.example"));
  await act(() => hook.result.current.signIn("a long enough passphrase"));
  await waitFor(() => expect(hook.result.current.phase.kind).not.toBe("credentials"));
  return hook;
}

describe("useAmpmSignIn", () => {
  it("asks for the code after the password, then starts the session", async () => {
    const { result } = await signedInWithPassword("totp");
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
    const { result } = await signedInWithPassword("totp");
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

  it("shows the recovery codes after enrolling, and starts the session only once they are saved", async () => {
    const { result } = await signedInWithPassword("enrol");
    expect(result.current.phase).toEqual({
      kind: "enrollTotp",
      secret: "SECRET",
      otpauthUri: "otpauth://totp/x",
    });
    const codes = Array.from({ length: 10 }, (_, i) => `CODE${i}-ABCDE`);
    mockEnrol.mockResolvedValue({ ...GRANT, recoveryCodes: codes });
    await act(() => result.current.confirmEnrollment("123456"));
    await waitFor(() => expect(result.current.phase.kind).toBe("recoveryCodes"));
    expect(mockSetAccessToken).not.toHaveBeenCalled();
    await act(() => result.current.finish?.());
    expect(mockSetAccessToken).toHaveBeenCalledWith("token-1");
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("goes back to the password when the challenge has timed out", async () => {
    const { result } = await signedInWithPassword("totp");
    mockCode.mockRejectedValue(new Error(SIGN_IN_ERRORS.challengeExpired));
    await act(() => result.current.submitChallenge("123456"));
    await waitFor(() => expect(result.current.phase).toEqual({ kind: "credentials" }));
    expect(result.current.error).toBe(SIGN_IN_ERRORS.challengeExpired);
    expect(mockSetAccessToken).not.toHaveBeenCalled();
  });
});
