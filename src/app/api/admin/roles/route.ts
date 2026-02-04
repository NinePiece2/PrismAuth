import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { z } from "zod";

export const runtime = "nodejs";

const createRoleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

/**
 * List all custom roles in the tenant (Admin only)
 * GET /api/admin/roles
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const roles = await prisma.customRole.findMany({
      where: {
        tenantId: currentUser.tenantId,
      },
      include: {
        _count: {
          select: {
            users: true,
            permissions: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(roles);
  } catch (error) {
    console.error("List roles error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Create a new custom role (Admin only)
 * POST /api/admin/roles
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createRoleSchema.parse(body);

    // Check if role already exists in this tenant
    const existingRole = await prisma.customRole.findUnique({
      where: {
        name_tenantId: {
          name: validatedData.name,
          tenantId: currentUser.tenantId,
        },
      },
    });

    if (existingRole) {
      return NextResponse.json(
        { error: "Role with this name already exists" },
        { status: 409 },
      );
    }

    // Create role
    const role = await prisma.customRole.create({
      data: {
        name: validatedData.name,
        description: validatedData.description,
        tenantId: currentUser.tenantId,
      },
      include: {
        _count: {
          select: {
            users: true,
            permissions: true,
          },
        },
      },
    });

    return NextResponse.json(role, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 },
      );
    }

    console.error("Create role error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
