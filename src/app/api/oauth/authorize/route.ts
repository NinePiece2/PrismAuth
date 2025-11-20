import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { authorizeSchema } from "@/lib/validators";
import { getCurrentUser } from "@/lib/session";
import { ZodError } from "zod";

/**
 * OAuth2 Authorization Endpoint
 * GET /api/oauth/authorize
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const params = {
      response_type: searchParams.get("response_type"),
      client_id: searchParams.get("client_id"),
      redirect_uri: searchParams.get("redirect_uri"),
      scope: searchParams.get("scope") || "openid profile email",
      state: searchParams.get("state") || undefined,
      code_challenge: searchParams.get("code_challenge") || undefined,
      code_challenge_method:
        searchParams.get("code_challenge_method") || undefined,
      nonce: searchParams.get("nonce") || undefined,
    };

    // Validate input
    const validatedParams = authorizeSchema.parse(params);

    // Check if user is authenticated
    const user = await getCurrentUser();
    if (!user) {
      // Redirect to login with return URL
      const loginUrl = new URL("/auth/login", request.url);
      loginUrl.searchParams.set("returnTo", request.url);
      return NextResponse.redirect(loginUrl);
    }

    // Verify client exists and is active
    const client = await prisma.oAuthClient.findFirst({
      where: {
        clientId: validatedParams.client_id,
        tenantId: user.tenantId,
        isActive: true,
      },
    });

    if (!client) {
      return NextResponse.json(
        {
          error: "invalid_client",
          error_description: "Client not found or inactive",
        },
        { status: 400 },
      );
    }

    // Verify redirect URI
    if (!client.redirectUris.includes(validatedParams.redirect_uri)) {
      return NextResponse.json(
        { error: "invalid_request", error_description: "Invalid redirect URI" },
        { status: 400 },
      );
    }

    // Verify scopes
    const requestedScopes = validatedParams.scope.split(" ");
    const invalidScopes = requestedScopes.filter(
      (scope) => !client.allowedScopes.includes(scope),
    );

    if (invalidScopes.length > 0) {
      return NextResponse.json(
        {
          error: "invalid_scope",
          error_description: `Invalid scopes: ${invalidScopes.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Redirect to consent page
    const consentUrl = new URL("/auth/consent", request.url);
    consentUrl.searchParams.set("client_id", validatedParams.client_id);
    consentUrl.searchParams.set("redirect_uri", validatedParams.redirect_uri);
    consentUrl.searchParams.set("scope", validatedParams.scope);
    consentUrl.searchParams.set("response_type", validatedParams.response_type);
    if (validatedParams.state)
      consentUrl.searchParams.set("state", validatedParams.state);
    if (validatedParams.code_challenge)
      consentUrl.searchParams.set(
        "code_challenge",
        validatedParams.code_challenge,
      );
    if (validatedParams.code_challenge_method)
      consentUrl.searchParams.set(
        "code_challenge_method",
        validatedParams.code_challenge_method,
      );
    if (validatedParams.nonce)
      consentUrl.searchParams.set("nonce", validatedParams.nonce);

    return NextResponse.redirect(consentUrl);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          error: "invalid_request",
          error_description: error.issues[0].message,
        },
        { status: 400 },
      );
    }

    console.error("Authorization error:", error);
    return NextResponse.json(
      { error: "server_error", error_description: "Internal server error" },
      { status: 500 },
    );
  }
}
