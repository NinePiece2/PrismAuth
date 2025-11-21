/**
 * Check if initial setup is required
 * Returns true if no tenants exist in the database
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const tenantCount = await prisma.tenant.count();

    return NextResponse.json({
      setupRequired: tenantCount === 0,
    });
  } catch (error) {
    console.error("Error checking setup status:", error);
    return NextResponse.json(
      { error: "Failed to check setup status" },
      { status: 500 },
    );
  }
}
