import { ForgotPasswordScreen } from "@/features/auth/forgot-password-screen";

/** `/forgot-password`: ask for a password-reset link (AMPM's own sign-in, D-142). Reachable signed out. */
export default function ForgotPasswordRoute() {
  return <ForgotPasswordScreen />;
}
