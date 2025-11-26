import { SignJWT, jwtVerify, importPKCS8, importSPKI } from "jose";
import { config } from "./config";

let privateKey: CryptoKey | null = null;
let publicKey: CryptoKey | null = null;

async function getPrivateKey(): Promise<CryptoKey> {
  if (!privateKey && config.jwt.privateKey) {
    privateKey = await importPKCS8(config.jwt.privateKey, "RS256");
  }
  if (!privateKey) {
    throw new Error("JWT private key not configured");
  }
  return privateKey;
}

async function getPublicKey(): Promise<CryptoKey> {
  if (!publicKey && config.jwt.publicKey) {
    publicKey = await importSPKI(config.jwt.publicKey, "RS256");
  }
  if (!publicKey) {
    throw new Error("JWT public key not configured");
  }
  return publicKey;
}

export interface AccessTokenPayload {
  sub: string; // user ID
  tenant_id: string;
  client_id: string;
  scope: string[];
  email?: string;
  name?: string;
  role?: string;
  custom_roles?: Array<{
    id: string;
    name: string;
    permissions?: Array<{
      clientId: string;
      permissions: string[];
    }>;
  }>;
}

export interface IDTokenPayload {
  sub: string; // user ID
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  tenant_id: string;
  role?: string;
  custom_roles?: Array<{
    id: string;
    name: string;
    permissions?: Array<{
      clientId: string;
      permissions: string[];
    }>;
  }>;
}

/**
 * Create an access token (JWT)
 */
export async function createAccessToken(
  payload: AccessTokenPayload,
  expiresIn: number = config.oauth2.accessTokenExpiry,
): Promise<string> {
  const key = await getPrivateKey();

  return new SignJWT({
    ...payload,
    token_type: "access_token",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt()
    .setIssuer(config.oauth2.issuer)
    .setSubject(payload.sub)
    .setAudience(payload.client_id)
    .setExpirationTime(`${expiresIn}s`)
    .sign(key);
}

/**
 * Create an ID token (OpenID Connect)
 */
export async function createIDToken(
  payload: IDTokenPayload,
  clientId: string,
  nonce?: string,
): Promise<string> {
  const key = await getPrivateKey();

  const jwt = new SignJWT({
    ...payload,
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt()
    .setIssuer(config.oauth2.issuer)
    .setSubject(payload.sub)
    .setAudience(clientId)
    .setExpirationTime("1h");

  if (nonce) {
    jwt.setJti(nonce);
  }

  return jwt.sign(key);
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(
  token: string,
): Promise<Record<string, unknown>> {
  const key = await getPublicKey();

  const { payload } = await jwtVerify(token, key, {
    issuer: config.oauth2.issuer,
  });

  return payload;
}

/**
 * Get JWKs for public key discovery
 */
export async function getJWKS() {
  const key = await getPublicKey();

  // Export the key to JWK format - KeyLike is either CryptoKey or KeyObject
  const jwk = await crypto.subtle.exportKey("jwk", key as CryptoKey);

  return {
    keys: [
      {
        ...jwk,
        use: "sig",
        alg: "RS256",
        kid: "1", // Key ID
      },
    ],
  };
}
