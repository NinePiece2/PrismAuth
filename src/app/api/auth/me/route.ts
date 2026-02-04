import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Get current user session
 * GET /api/auth/me
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // Fetch additional user data from database (including fresh role data)
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      select: {
        mfaEnabled: true,
        role: true,
        customRoles: {
          select: {
            customRole: {
              select: {
                id: true,
                name: true,
                permissions: {
                  select: {
                    applicationId: true,
                    permissions: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!dbUser) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.userId,
        email: user.email,
        name: user.name,
        tenantId: user.tenantId,
        role: dbUser.role, // Use role from database instead of session
        customRoles: dbUser.customRoles.map((ur) => ur.customRole),
        mfaEnabled: dbUser.mfaEnabled,
      },
    });
  } catch (error) {
    console.error("Auth check error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
