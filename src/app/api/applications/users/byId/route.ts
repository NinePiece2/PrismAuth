import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyClientSecret } from "@/lib/crypto";
import { z } from "zod";

export const runtime = "nodejs";

const getUserByIdSchema = z.object({
  sub: z.string(), // user id
  applicationId: z.string().optional(),
});

/**
 * Get user information by ID
 * POST /api/applications/users/byId
 *
 * Authentication: Client ID and Secret via Basic Auth or request body
 *
 * Request body:
 * {
 *   "client_id": "client_xxx" (optional if using Basic Auth),
 *   "client_secret": "xxx" (optional if using Basic Auth),
 *   "applicationId": "client-id" (filter by application),
 *   "sub": "user-id" (information for this user)
 * }
 *
 * Returns:
 * {
 *   "user": {
 *     "id": "xxx",
 *     "email": "user@example.com",
 *     "name": "User Name",
 *     "image": "base64-encoded-image-string" (can be null)
 *   }
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Extract client credentials from Authorization header or body
    let clientId: string | undefined;
    let clientSecret: string | undefined;

    // Try Basic Auth first
    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Basic ")) {
      const base64Credentials = authHeader.slice(6);
      const credentials = Buffer.from(base64Credentials, "base64").toString(
        "utf-8",
      );
      [clientId, clientSecret] = credentials.split(":");
    }

    // Parse body
    const body = await request.json();

    // Use body credentials if Basic Auth not provided
    if (!clientId || !clientSecret) {
      clientId = body.client_id;
      clientSecret = body.client_secret;
    }

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        {
          error: "Authentication required",
          message:
            "Provide client_id and client_secret in request body or via Basic Auth header",
        },
        { status: 401 },
      );
    }

    // Validate client credentials
    const client = await prisma.oAuthClient.findUnique({
      where: { clientId },
      include: { tenant: true },
    });

    if (!client || !client.isActive) {
      return NextResponse.json(
        { error: "Invalid client credentials" },
        { status: 401 },
      );
    }

    const isValidSecret = await verifyClientSecret(
      clientSecret,
      client.clientSecret,
    );

    if (!isValidSecret) {
      return NextResponse.json(
        { error: "Invalid client credentials" },
        { status: 401 },
      );
    }

    // Validate input
    const validatedData = getUserByIdSchema.parse({
      sub: body.sub,
      applicationId: body.applicationId,
    });

    // Find user by id and tenant
    const user = await prisma.user.findFirst({
      where: {
        id: validatedData.sub,
        tenantId: client.tenantId,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: "Validation error",
          details: error.issues,
        },
        { status: 400 },
      );
    }

    console.error("Get user by id error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
