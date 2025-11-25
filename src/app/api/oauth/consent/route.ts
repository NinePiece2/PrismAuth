import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { generateAuthorizationCode } from "@/lib/crypto";
import { config } from "@/lib/config";

/**
 * OAuth2 Consent Endpoint
 * POST /api/oauth/consent
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      client_id,
      redirect_uri,
      scope,
      state,
      code_challenge,
      code_challenge_method,
      approved,
    } = body;

    // If user denied consent
    if (!approved) {
      const redirectUrl = new URL(redirect_uri);
      redirectUrl.searchParams.set("error", "access_denied");
      redirectUrl.searchParams.set(
        "error_description",
        "User denied authorization",
      );
      if (state) redirectUrl.searchParams.set("state", state);

      return NextResponse.json({ redirect_uri: redirectUrl.toString() });
    }

    // Verify client
    const client = await prisma.oAuthClient.findFirst({
      where: {
        clientId: client_id,
        tenantId: user.tenantId,
        isActive: true,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Invalid client" }, { status: 400 });
    }

    // Store or update user consent
    const scopes = scope.split(" ");
    await prisma.userConsent.upsert({
      where: {
        userId_clientId: {
          userId: user.userId,
          clientId: client_id,
        },
      },
      update: {
        scope: scopes,
        updatedAt: new Date(),
      },
      create: {
        userId: user.userId,
        clientId: client_id,
        scope: scopes,
      },
    });

    // Generate authorization code
    const code = generateAuthorizationCode();
    const expiresAt = new Date(
      Date.now() + config.oauth2.authorizationCodeExpiry * 1000,
    );

    await prisma.authorizationCode.create({
      data: {
        code,
        clientId: client_id,
        userId: user.userId,
        redirectUri: redirect_uri,
        scope: scopes,
        expiresAt,
        codeChallenge: code_challenge || null,
        codeChallengeMethod: code_challenge_method || null,
      },
    });

    // Build redirect URL with authorization code
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.set("code", code);
    if (state) redirectUrl.searchParams.set("state", state);

    return NextResponse.json({ redirect_uri: redirectUrl.toString() });
  } catch (error) {
    console.error("Consent error:", error);
    return NextResponse.json(
      { error: "server_error", error_description: "Internal server error" },
      { status: 500 },
    );
  }
}
