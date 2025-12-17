import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { tokenSchema } from "@/lib/validators";
import { verifyClientSecret, verifyPKCE, generateToken } from "@/lib/crypto";
import { randomBytes } from "crypto";
import { createAccessToken, createIDToken } from "@/lib/jwt";
import { Prisma } from "@prisma/client";
// Helper to create a unique access token, retrying on collision
import type { AccessTokenPayload as JWTAccessTokenPayload } from "@/lib/jwt";

type AccessTokenPayload = JWTAccessTokenPayload;

async function createUniqueDbToken(
  clientId: string,
  userId: string,
  scope: string[],
  expiresAt: Date,
  maxRetries = 5,
): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const dbToken = randomBytes(48).toString("base64url");
    try {
      await prisma.accessToken.create({
        data: {
          token: dbToken,
          client: { connect: { clientId } },
          user: { connect: { id: userId } },
          scope,
          expiresAt,
        },
      });
      return dbToken;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        // Token collision, try again
        continue;
      }
      throw error;
    }
  }
  throw new Error(
    "Failed to generate a unique DB access token after several attempts",
  );
}
import { config } from "@/lib/config";
import { ZodError } from "zod";

/**
 * OAuth2 Token Endpoint
 * POST /api/oauth/token
 * Accepts both application/json and application/x-www-form-urlencoded
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body - support both JSON and form-urlencoded
    let body: Record<string, unknown>;
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      // Parse form data
      const formData = await request.formData();
      body = {};
      formData.forEach((value, key) => {
        body[key] = value;
      });
    } else {
      // Parse as JSON (default)
      body = await request.json();
    }

    const validatedParams = tokenSchema.parse(body);

    // Verify client credentials
    const client = await prisma.oAuthClient.findUnique({
      where: { clientId: validatedParams.client_id },
      include: { tenant: true },
    });

    if (!client || !client.isActive) {
      return NextResponse.json(
        {
          error: "invalid_client",
          error_description: "Client not found or inactive",
        },
        { status: 401 },
      );
    }

    const isValidSecret = await verifyClientSecret(
      validatedParams.client_secret,
      client.clientSecret,
    );
    if (!isValidSecret) {
      return NextResponse.json(
        {
          error: "invalid_client",
          error_description: "Invalid client credentials",
        },
        { status: 401 },
      );
    }

    // Handle authorization_code grant
    if (validatedParams.grant_type === "authorization_code") {
      if (!validatedParams.code || !validatedParams.redirect_uri) {
        return NextResponse.json(
          {
            error: "invalid_request",
            error_description: "Missing code or redirect_uri",
          },
          { status: 400 },
        );
      }

      // Find and validate authorization code
      const authCode = await prisma.authorizationCode.findUnique({
        where: { code: validatedParams.code },
        include: {
          user: {
            include: {
              customRoles: {
                include: {
                  customRole: {
                    include: {
                      permissions: {
                        include: {
                          application: {
                            select: {
                              clientId: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (
        !authCode ||
        authCode.used ||
        authCode.clientId !== validatedParams.client_id
      ) {
        return NextResponse.json(
          {
            error: "invalid_grant",
            error_description: "Invalid authorization code",
          },
          { status: 400 },
        );
      }

      if (authCode.expiresAt < new Date()) {
        return NextResponse.json(
          {
            error: "invalid_grant",
            error_description: "Authorization code expired",
          },
          { status: 400 },
        );
      }

      if (authCode.redirectUri !== validatedParams.redirect_uri) {
        return NextResponse.json(
          {
            error: "invalid_grant",
            error_description: "Redirect URI mismatch",
          },
          { status: 400 },
        );
      }

      // Verify PKCE if present
      if (authCode.codeChallenge) {
        if (!validatedParams.code_verifier) {
          return NextResponse.json(
            {
              error: "invalid_request",
              error_description: "Missing code_verifier",
            },
            { status: 400 },
          );
        }

        const isValidPKCE = verifyPKCE(
          validatedParams.code_verifier,
          authCode.codeChallenge,
          (authCode.codeChallengeMethod as "plain" | "S256") || "plain",
        );

        if (!isValidPKCE) {
          return NextResponse.json(
            {
              error: "invalid_grant",
              error_description: "Invalid PKCE code_verifier",
            },
            { status: 400 },
          );
        }
      }

      // Mark code as used
      await prisma.authorizationCode.update({
        where: { id: authCode.id },
        data: { used: true },
      });

      // Generate tokens
      const accessTokenExpiry = config.oauth2.accessTokenExpiry;
      const refreshTokenExpiry = config.oauth2.refreshTokenExpiry;

      // Map custom roles with permissions
      const customRoles = authCode.user.customRoles.map((ur) => ({
        id: ur.customRole.id,
        name: ur.customRole.name,
        permissions: ur.customRole.permissions.map((p) => ({
          clientId: p.application.clientId,
          permissions: p.permissions,
        })),
      }));

      // Generate access token string
      const accessTokenPayload: AccessTokenPayload = {
        sub: authCode.userId,
        tenant_id: authCode.user.tenantId,
        client_id: client.clientId,
        scope: authCode.scope,
        email: authCode.user.email,
        name: authCode.user.name || undefined,
        role: authCode.user.role,
        custom_roles: customRoles.length > 0 ? customRoles : undefined,
      };
      const refreshTokenString = generateToken(48);
      const expiresAt = new Date(Date.now() + accessTokenExpiry * 1000);
      const refreshExpiresAt = new Date(Date.now() + refreshTokenExpiry * 1000);

      // Store a random DB token, return JWT to client
      await createUniqueDbToken(
        client.clientId,
        authCode.userId,
        authCode.scope,
        expiresAt,
      );

      await prisma.refreshToken.create({
        data: {
          token: refreshTokenString,
          client: { connect: { clientId: client.clientId } },
          user: { connect: { id: authCode.userId } },
          scope: authCode.scope,
          expiresAt: refreshExpiresAt,
        },
      });

      // Generate ID token if openid scope is present
      let idToken: string | undefined;
      if (authCode.scope.includes("openid")) {
        idToken = await createIDToken(
          {
            sub: authCode.userId,
            email: authCode.user.email,
            email_verified: authCode.user.emailVerified !== null,
            name: authCode.user.name || undefined,
            picture: authCode.user.image || undefined,
            tenant_id: authCode.user.tenantId,
            role: authCode.user.role,
            custom_roles: customRoles.length > 0 ? customRoles : undefined,
          },
          client.clientId,
        );
      }

      // Return JWT as access_token
      const jwtAccessToken = await createAccessToken(accessTokenPayload);
      const response: Record<string, unknown> = {
        access_token: jwtAccessToken,
        token_type: "Bearer",
        expires_in: accessTokenExpiry,
        refresh_token: refreshTokenString,
        scope: authCode.scope.join(" "),
      };

      if (idToken) {
        response.id_token = idToken;
      }

      return NextResponse.json(response);
    }

    // Handle refresh_token grant
    if (validatedParams.grant_type === "refresh_token") {
      if (!validatedParams.refresh_token) {
        return NextResponse.json(
          {
            error: "invalid_request",
            error_description: "Missing refresh_token",
          },
          { status: 400 },
        );
      }

      const refreshToken = await prisma.refreshToken.findUnique({
        where: { token: validatedParams.refresh_token },
        include: {
          user: {
            include: {
              customRoles: {
                include: {
                  customRole: {
                    include: {
                      permissions: {
                        include: {
                          application: {
                            select: {
                              clientId: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (
        !refreshToken ||
        refreshToken.revoked ||
        refreshToken.clientId !== validatedParams.client_id
      ) {
        return NextResponse.json(
          {
            error: "invalid_grant",
            error_description: "Invalid refresh token",
          },
          { status: 400 },
        );
      }

      if (refreshToken.expiresAt < new Date()) {
        return NextResponse.json(
          {
            error: "invalid_grant",
            error_description: "Refresh token expired",
          },
          { status: 400 },
        );
      }

      // Generate new access token
      const accessTokenExpiry = config.oauth2.accessTokenExpiry;

      // Map custom roles with permissions
      const refreshCustomRoles = refreshToken.user.customRoles.map((ur) => ({
        id: ur.customRole.id,
        name: ur.customRole.name,
        permissions: ur.customRole.permissions.map((p) => ({
          clientId: p.application.clientId,
          permissions: p.permissions,
        })),
      }));

      const refreshAccessTokenPayload: AccessTokenPayload = {
        sub: refreshToken.userId,
        tenant_id: refreshToken.user.tenantId,
        client_id: client.clientId,
        scope: refreshToken.scope,
        email: refreshToken.user.email,
        name: refreshToken.user.name || undefined,
        role: refreshToken.user.role,
        custom_roles:
          refreshCustomRoles.length > 0 ? refreshCustomRoles : undefined,
      };
      const expiresAt = new Date(Date.now() + accessTokenExpiry * 1000);
      await createUniqueDbToken(
        client.clientId,
        refreshToken.userId,
        refreshToken.scope,
        expiresAt,
      );

      // Return JWT as access_token
      const jwtAccessToken = await createAccessToken(refreshAccessTokenPayload);
      return NextResponse.json({
        access_token: jwtAccessToken,
        token_type: "Bearer",
        expires_in: accessTokenExpiry,
        scope: refreshToken.scope.join(" "),
      });
    }

    return NextResponse.json(
      {
        error: "unsupported_grant_type",
        error_description: "Grant type not supported",
      },
      { status: 400 },
    );
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

    console.error("Token error:", error);
    return NextResponse.json(
      { error: "server_error", error_description: "Internal server error" },
      { status: 500 },
    );
  }
}
