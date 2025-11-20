import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import crypto from "crypto";

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a secure random token
 */
export function generateToken(length: number = 32): string {
  return nanoid(length);
}

/**
 * Generate a cryptographically secure authorization code
 */
export function generateAuthorizationCode(): string {
  return nanoid(43); // Base64-URL safe, ~256 bits of entropy
}

/**
 * Generate client credentials
 */
export function generateClientCredentials(): {
  clientId: string;
  clientSecret: string;
} {
  return {
    clientId: `client_${nanoid(24)}`,
    clientSecret: nanoid(48),
  };
}

/**
 * Verify PKCE code challenge
 */
export function verifyPKCE(
  codeVerifier: string,
  codeChallenge: string,
  method: "plain" | "S256",
): boolean {
  if (method === "plain") {
    return codeVerifier === codeChallenge;
  }

  // S256 method
  const hash = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return hash === codeChallenge;
}

/**
 * Hash client secret for storage
 */
export async function hashClientSecret(secret: string): Promise<string> {
  return bcrypt.hash(secret, 10);
}

/**
 * Verify client secret
 */
export async function verifyClientSecret(
  secret: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(secret, hash);
}
