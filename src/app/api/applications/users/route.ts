import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyClientSecret } from "@/lib/crypto";

export const runtime = "nodejs";
import { z } from "zod";

const getUsersByRoleSchema = z
  .object({
    role: z.string().optional(),
    permission: z.string().optional(),
    applicationId: z.string().optional(),
  })
  .refine((data) => data.role || data.permission, {
    message: "Either 'role' or 'permission' must be provided",
  });

/**
 * Get users by role/permission for distribution lists
 * POST /api/applications/users
 *
 * Authentication: Client ID and Secret via Basic Auth or request body
 *
 * Request body:
 * {
 *   "client_id": "client_xxx" (optional if using Basic Auth),
 *   "client_secret": "xxx" (optional if using Basic Auth),
 *   "role": "role-name" (optional, custom role name),
 *   "permission": "read" (optional, permission string),
 *   "applicationId": "client-id" (optional, filter by application permissions)
 * }
 *
 * Returns:
 * {
 *   "users": [
 *     {
 *       "id": "xxx",
 *       "email": "user@example.com",
 *       "name": "User Name"
 *     }
 *   ]
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

    // Validate query parameters
    const validatedData = getUsersByRoleSchema.parse({
      role: body.role,
      permission: body.permission,
      applicationId: body.applicationId,
    });

    // Query users based on role or permission
    let users: Array<{
      id: string;
      email: string;
      name: string | null;
    }> = [];

    if (validatedData.role) {
      // Find users by custom role name
      users = await prisma.user.findMany({
        where: {
          tenantId: client.tenantId,
          isActive: true,
          customRoles: {
            some: {
              customRole: {
                name: {
                  equals: validatedData.role,
                  mode: "insensitive",
                },
                isActive: true,
              },
            },
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
        orderBy: {
          email: "asc",
        },
      });
    } else if (validatedData.permission) {
      // Find users by permission (case-insensitive)
      const permissionLower = validatedData.permission.toLowerCase();
      const permissionFilter: {
        permissions: {
          has: string;
        };
        applicationId?: string;
      } = {
        permissions: {
          has: permissionLower,
        },
      };

      // If applicationId is specified, filter by application
      if (validatedData.applicationId) {
        permissionFilter.applicationId = validatedData.applicationId;
      }

      users = await prisma.user.findMany({
        where: {
          tenantId: client.tenantId,
          isActive: true,
          customRoles: {
            some: {
              customRole: {
                isActive: true,
                permissions: {
                  some: permissionFilter,
                },
              },
            },
          },
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
        orderBy: {
          email: "asc",
        },
      });
    }

    return NextResponse.json({
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name || undefined,
      })),
      count: users.length,
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

    console.error("Get users by role/permission error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
