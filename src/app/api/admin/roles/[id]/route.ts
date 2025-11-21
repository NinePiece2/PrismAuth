import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { z } from "zod";

const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Get a specific role (Admin only)
 * GET /api/admin/roles/[id]
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const role = await prisma.customRole.findFirst({
      where: {
        id,
        tenantId: currentUser.tenantId,
      },
      include: {
        permissions: {
          include: {
            application: {
              select: {
                id: true,
                name: true,
                clientId: true,
              },
            },
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    return NextResponse.json(role);
  } catch (error) {
    console.error("Get role error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Update a role (Admin only)
 * PATCH /api/admin/roles/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = updateRoleSchema.parse(body);

    // Verify role belongs to tenant
    const existingRole = await prisma.customRole.findFirst({
      where: {
        id,
        tenantId: currentUser.tenantId,
      },
    });

    if (!existingRole) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Check name uniqueness if updating name
    if (validatedData.name && validatedData.name !== existingRole.name) {
      const duplicateName = await prisma.customRole.findUnique({
        where: {
          name_tenantId: {
            name: validatedData.name,
            tenantId: currentUser.tenantId,
          },
        },
      });

      if (duplicateName) {
        return NextResponse.json(
          { error: "Role with this name already exists" },
          { status: 409 },
        );
      }
    }

    // Update role
    const role = await prisma.customRole.update({
      where: { id },
      data: validatedData,
      include: {
        _count: {
          select: {
            users: true,
            permissions: true,
          },
        },
      },
    });

    return NextResponse.json(role);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 },
      );
    }

    console.error("Update role error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Delete a role (Admin only)
 * DELETE /api/admin/roles/[id]
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Verify role belongs to tenant
    const role = await prisma.customRole.findFirst({
      where: {
        id,
        tenantId: currentUser.tenantId,
      },
      include: {
        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!role) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Check if role is in use
    if (role._count.users > 0) {
      return NextResponse.json(
        { error: "Cannot delete role that is assigned to users" },
        { status: 400 },
      );
    }

    // Delete role (permissions will be cascade deleted)
    await prisma.customRole.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete role error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
