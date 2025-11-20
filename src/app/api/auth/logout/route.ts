import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";

/**
 * User Logout
 * POST /api/auth/logout
 */
export async function POST() {
  try {
    await destroySession();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
