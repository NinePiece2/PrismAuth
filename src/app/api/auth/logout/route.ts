import { NextResponse } from "next/server";
import { destroySession, getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/**
 * User Logout
 * POST /api/auth/logout
 *
 * Logs out the user by:
 * 1. Destroying their session
 * 2. Revoking all their active OAuth access tokens
 * 3. Revoking all their active OAuth refresh tokens
 */
export async function POST() {
  try {
    // Get user before destroying session
    const user = await getCurrentUser();

    // Destroy session
    await destroySession();

    // If user was logged in, revoke all their OAuth tokens
    if (user) {
      // Revoke all access tokens for this user
      await prisma.accessToken.updateMany({
        where: {
          userId: user.userId,
          revoked: false,
        },
        data: {
          revoked: true,
        },
      });

      // Revoke all refresh tokens for this user
      await prisma.refreshToken.updateMany({
        where: {
          userId: user.userId,
          revoked: false,
        },
        data: {
          revoked: true,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
