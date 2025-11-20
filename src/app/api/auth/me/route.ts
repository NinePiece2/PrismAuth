import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";

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

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.userId,
        email: user.email,
        name: user.name,
        tenantId: user.tenantId,
        role: user.role,
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
