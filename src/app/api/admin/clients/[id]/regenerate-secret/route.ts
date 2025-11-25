import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { randomBytes } from "crypto";
import { hashPassword } from "@/lib/crypto";

/**
 * Regenerate OAuth Client Secret
 * POST /api/admin/clients/[id]/regenerate-secret
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();

    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const client = await prisma.oAuthClient.findFirst({
      where: {
        id,
        tenantId: user.tenantId,
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Generate new client secret
    const newClientSecret = randomBytes(32).toString("hex");
    const hashedSecret = await hashPassword(newClientSecret);

    // Update client with new secret
    await prisma.oAuthClient.update({
      where: { id },
      data: {
        clientSecret: hashedSecret,
      },
    });

    // Return the plain secret (only time it will be visible)
    return NextResponse.json({
      clientSecret: newClientSecret,
      message: "Client secret regenerated successfully. Save this secret - it won't be shown again.",
    });
  } catch (error) {
    console.error("Regenerate secret error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
