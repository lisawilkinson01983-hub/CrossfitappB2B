import crypto from "crypto";

/** A URL-safe random token for email verification / password reset links. */
export function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}
