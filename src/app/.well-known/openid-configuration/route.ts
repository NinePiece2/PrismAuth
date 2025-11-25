import { NextResponse } from "next/server";
import { config } from "@/lib/config";

/**
 * OpenID Connect Discovery Endpoint
 * GET /.well-known/openid-configuration
 */
export async function GET() {
  const issuer = config.oauth2.issuer;

  const configuration = {
    issuer,
    authorization_endpoint: `${issuer}/api/oauth/authorize`,
    token_endpoint: `${issuer}/api/oauth/token`,
    userinfo_endpoint: `${issuer}/api/oauth/userinfo`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    response_types_supported: ["code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    scopes_supported: ["openid", "profile", "email"],
    token_endpoint_auth_methods_supported: [
      "client_secret_post",
      "client_secret_basic",
    ],
    claims_supported: [
      "sub",
      "email",
      "email_verified",
      "name",
      "picture",
      "tenant_id",
    ],
    code_challenge_methods_supported: ["plain", "S256"],
    grant_types_supported: ["authorization_code", "refresh_token"],
  };

  return NextResponse.json(configuration);
}
