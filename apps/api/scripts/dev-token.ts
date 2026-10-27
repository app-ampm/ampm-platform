/**
 * Mints a local development access token: `pnpm --filter api dev:token -- local:admin [email]`.
 * Works only with IDENTITY_PROVIDER=local and the secret from .env; production never accepts these.
 */
import { LocalIdentityAdapter } from "../src/identity/local.adapter.js";

const [subject = "local:admin", email] = process.argv.slice(2);
const secret = process.env["IDENTITY_LOCAL_SECRET"];
if (!secret || secret.length < 32)
  throw new Error("IDENTITY_LOCAL_SECRET (32+ characters) is required");
const token = await new LocalIdentityAdapter(secret).mint(subject, email ? { email } : {});
console.log(token);
