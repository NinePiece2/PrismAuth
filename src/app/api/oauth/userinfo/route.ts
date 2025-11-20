import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyToken } from "@/lib/jwt";

/**
 * OAuth2 UserInfo Endpoint (OpenID Connect)
 * GET /api/oauth/userinfo
 */
export async function GET(request: NextRequest) {
  try {
    // Get access token from Authorization header
    const authorization = request.headers.get("authorization");
    if (!authorization || !authorization.startsWith("Bearer ")) {
      return NextResponse.json(
        {
          error: "invalid_token",
          error_description: "Missing or invalid authorization header",
        },
        { status: 401 },
      );
    }

    const token = authorization.substring(7);

    // Verify token from database
    const accessToken = await prisma.accessToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!accessToken || accessToken.revoked) {
      return NextResponse.json(
        {
          error: "invalid_token",
          error_description: "Token not found or revoked",
        },
        { status: 401 },
      );
    }

    if (accessToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "invalid_token", error_description: "Token expired" },
        { status: 401 },
      );
    }

    // Verify JWT signature
    try {
      await verifyToken(token);
    } catch {
      return NextResponse.json(
        {
          error: "invalid_token",
          error_description: "Invalid token signature",
        },
        { status: 401 },
      );
    }

    // Build response based on requested scopes
    const user = accessToken.user;
    const scopes = accessToken.scope;

    const claims: Record<string, unknown> = {
      sub: user.id,
      tenant_id: user.tenantId,
    };

    if (scopes.includes("email")) {
      claims.email = user.email;
      claims.email_verified = user.emailVerified !== null;
    }

    if (scopes.includes("profile")) {
      if (user.name) claims.name = user.name;
      if (user.image) claims.picture = user.image;
    }

    return NextResponse.json(claims);
  } catch {
    console.error("UserInfo error");
    return NextResponse.json(
      { error: "server_error", error_description: "Internal server error" },
      { status: 500 },
    );
  }
}
