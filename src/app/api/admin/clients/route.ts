import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { createClientSchema } from "@/lib/validators";
import { generateClientCredentials, hashClientSecret } from "@/lib/crypto";
import { ZodError } from "zod";

/**
 * List OAuth Clients
 * GET /api/admin/clients
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admins can manage clients
    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const clients = await prisma.oAuthClient.findMany({
      where: { tenantId: user.tenantId },
      select: {
        id: true,
        clientId: true,
        name: true,
        description: true,
        redirectUris: true,
        allowedScopes: true,
        grantTypes: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(clients);
  } catch (error) {
    console.error("List clients error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Create OAuth Client
 * POST /api/admin/clients
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createClientSchema.parse(body);

    // Generate client credentials
    const { clientId, clientSecret } = generateClientCredentials();
    const hashedSecret = await hashClientSecret(clientSecret);

    // Create client
    const client = await prisma.oAuthClient.create({
      data: {
        clientId,
        clientSecret: hashedSecret,
        name: validatedData.name,
        description: validatedData.description || null,
        redirectUris: validatedData.redirectUris,
        allowedScopes: validatedData.allowedScopes,
        grantTypes: validatedData.grantTypes,
        tenantId: user.tenantId,
        isActive: true,
      },
    });

    // Return client with plain secret (only time it's visible)
    return NextResponse.json({
      id: client.id,
      clientId: client.clientId,
      clientSecret: clientSecret, // Plain secret for user to save
      name: client.name,
      description: client.description,
      redirectUris: client.redirectUris,
      allowedScopes: client.allowedScopes,
      grantTypes: client.grantTypes,
      isActive: client.isActive,
      createdAt: client.createdAt,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 },
      );
    }

    console.error("Create client error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
